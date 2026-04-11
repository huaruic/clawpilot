import { ipcMain, BrowserWindow } from 'electron'
import { randomUUID } from 'node:crypto'
import { readFile, access, rename, writeFile } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import type { WsGatewayClient } from '../services/WsGatewayClient'
import { ChatSendSchema, ChatHistorySchema, ChatAbortSchema, SessionDeleteSchema, SessionResetSchema } from './schemas/chat.schema'
import { mainLogger } from '../utils/logger'
import { firstString, extractAgentErrorMessage } from '../utils/agentEvents'
import { getOpenClawStateDir } from '../services/RuntimeLocator'

interface Deps {
  getWsClient: () => WsGatewayClient
  getMainWindow: () => BrowserWindow | null
}

export const DEFAULT_SESSION_KEY = 'agent:default:default'

/**
 * Maps runId → sessionKey for routing incoming agent events to the correct session.
 * Entries are added on chat:send success and removed on terminal events.
 */
const runSessions = new Map<string, string>()

export function registerChatIpc({ getWsClient, getMainWindow }: Deps): void {
  // ── Send Message (with optional attachments) ──────────────────

  ipcMain.handle('chat:send', async (_, raw) => {
    const params = ChatSendSchema.parse(raw)
    const rpcParams: Record<string, unknown> = {
      sessionKey: params.sessionKey,
      message: params.message,
      idempotencyKey: randomUUID(),
    }
    if (params.attachments?.length) {
      rpcParams.attachments = params.attachments
    }
    const result = await getWsClient().request<{ runId?: string }>('chat.send', rpcParams)
    if (typeof result?.runId === 'string' && result.runId.trim()) {
      runSessions.set(result.runId, params.sessionKey)
    }
    return result
  })

  // ── Chat History ──────────────────────────────────────────────

  ipcMain.handle('chat:history', async (_, raw) => {
    const params = ChatHistorySchema.parse(raw)
    try {
      return await getWsClient().request('chat.history', {
        sessionKey: params.sessionKey,
        limit: params.limit ?? 100,
      })
    } catch (err) {
      mainLogger.warn('[chat.history] failed:', String(err))
      return []
    }
  })

  // ── Session List (with derived titles) ────────────────────────

  ipcMain.handle('chat:sessions', async () => {
    try {
      return await getWsClient().request('sessions.list', {
        includeDerivedTitles: true,
        includeLastMessage: true,
      })
    } catch (err) {
      mainLogger.warn('[chat:sessions] failed:', String(err))
      return []
    }
  })

  // ── Abort Run ─────────────────────────────────────────────────

  ipcMain.handle('chat:abort', async (_, raw) => {
    const params = ChatAbortSchema.parse(raw)
    try {
      return await getWsClient().request('chat.abort', {
        sessionKey: params.sessionKey,
        ...(params.runId ? { runId: params.runId } : {}),
      })
    } catch (err) {
      mainLogger.warn('[chat:abort] failed:', String(err))
      throw err
    }
  })

  // ── Reset Session (clear context) ─────────────────────────────

  ipcMain.handle('chat:resetSession', async (_, raw) => {
    const params = SessionResetSchema.parse(raw)
    try {
      return await getWsClient().request('sessions.reset', {
        key: params.sessionKey,
      })
    } catch (err) {
      mainLogger.warn('[chat:resetSession] failed:', String(err))
      throw err
    }
  })

  // ── Delete Session ────────────────────────────────────────────
  //
  // The OpenClaw Gateway does NOT expose a sessions.delete RPC.
  // Deletion is a local file-system operation: rename the JSONL transcript
  // to .deleted.jsonl so sessions.list skips it, then remove the entry
  // from sessions.json.

  ipcMain.handle('chat:deleteSession', async (_, raw) => {
    const params = SessionDeleteSchema.parse(raw)
    const sessionKey = params.sessionKey
    try {
      if (!sessionKey || !sessionKey.startsWith('agent:')) {
        return { success: false, error: `Invalid sessionKey: ${sessionKey}` }
      }
      const parts = sessionKey.split(':')
      if (parts.length < 3) {
        return { success: false, error: `sessionKey has too few parts: ${sessionKey}` }
      }

      const agentId = parts[1]
      const stateDir = getOpenClawStateDir()
      const sessionsDir = join(stateDir, 'agents', agentId, 'sessions')
      const sessionsJsonPath = join(sessionsDir, 'sessions.json')

      mainLogger.info(`[chat:deleteSession] key=${sessionKey} agentId=${agentId}`)

      // Step 1: read sessions.json to find the JSONL file for this session
      let sessionsJson: Record<string, unknown> = {}
      try {
        const raw2 = await readFile(sessionsJsonPath, 'utf8')
        sessionsJson = JSON.parse(raw2) as Record<string, unknown>
      } catch (e) {
        mainLogger.warn(`[chat:deleteSession] Could not read sessions.json: ${String(e)}`)
        return { success: false, error: `Could not read sessions.json: ${String(e)}` }
      }

      // Find the session file path
      let resolvedSrcPath: string | undefined

      // Shape A: { "agent:x:y": { sessionFile: "...", sessionId: "..." } }
      const entry = sessionsJson[sessionKey] as Record<string, unknown> | undefined
      if (entry) {
        if (typeof entry.sessionFile === 'string') {
          resolvedSrcPath = entry.sessionFile
        } else if (typeof entry.sessionId === 'string') {
          const id = entry.sessionId
          resolvedSrcPath = join(sessionsDir, id.endsWith('.jsonl') ? id : `${id}.jsonl`)
        }
      }

      // Shape B: { sessions: [{ key, file/sessionId }] }
      if (!resolvedSrcPath && Array.isArray(sessionsJson.sessions)) {
        const arr = sessionsJson.sessions as Array<Record<string, unknown>>
        const match = arr.find((s) => s.key === sessionKey || s.sessionKey === sessionKey)
        if (match) {
          if (typeof match.file === 'string') {
            resolvedSrcPath = match.file.startsWith('/') ? match.file : join(sessionsDir, match.file)
          } else {
            const uuid = (match.id ?? match.sessionId) as string | undefined
            if (uuid) resolvedSrcPath = join(sessionsDir, uuid.endsWith('.jsonl') ? uuid : `${uuid}.jsonl`)
          }
        }
      }

      if (!resolvedSrcPath) {
        mainLogger.warn(`[chat:deleteSession] Cannot resolve file for "${sessionKey}"`)
        return { success: false, error: `Cannot resolve file for session: ${sessionKey}` }
      }

      // Step 2: rename the JSONL file to .deleted.jsonl
      const dstPath = resolvedSrcPath.replace(/\.jsonl$/, '.deleted.jsonl')
      try {
        await access(resolvedSrcPath)
        await rename(resolvedSrcPath, dstPath)
        mainLogger.info(`[chat:deleteSession] Renamed ${resolvedSrcPath} → ${dstPath}`)
      } catch (e) {
        mainLogger.warn(`[chat:deleteSession] Could not rename file: ${String(e)}`)
      }

      // Step 3: remove the entry from sessions.json
      try {
        const raw3 = await readFile(sessionsJsonPath, 'utf8')
        const json3 = JSON.parse(raw3) as Record<string, unknown>

        if (Array.isArray(json3.sessions)) {
          json3.sessions = (json3.sessions as Array<Record<string, unknown>>)
            .filter((s) => s.key !== sessionKey && s.sessionKey !== sessionKey)
        } else if (json3[sessionKey]) {
          delete json3[sessionKey]
        }

        await writeFile(sessionsJsonPath, JSON.stringify(json3, null, 2), 'utf8')
        mainLogger.info(`[chat:deleteSession] Removed "${sessionKey}" from sessions.json`)
      } catch (e) {
        mainLogger.warn(`[chat:deleteSession] Could not update sessions.json: ${String(e)}`)
      }

      return { success: true }
    } catch (err) {
      mainLogger.error(`[chat:deleteSession] Unexpected error for ${sessionKey}:`, err)
      return { success: false, error: String(err) }
    }
  })

  // ── Agents List ───────────────────────────────────────────────

  ipcMain.handle('chat:agents', async () => {
    try {
      const result = await getWsClient().request<{ agents?: unknown[] }>('agents.list', {})
      return (result as Record<string, unknown>)?.agents ?? result ?? []
    } catch (err) {
      mainLogger.warn('[chat:agents] failed:', String(err))
      return []
    }
  })

  // ── Read File as Base64 (for attachments) ─────────────────────

  ipcMain.handle('file:readAsBase64', async (_, filePath: string) => {
    const data = await readFile(filePath)
    const mimeType = mimeFromExtension(filePath)
    return {
      content: data.toString('base64'),
      mimeType,
      fileName: basename(filePath),
      fileSize: data.length,
    }
  })
}

// ─── Event Forwarding ───────────────────────────────────────────

export function registerChatEventForwarding(
  wsClient: WsGatewayClient,
  getMainWindow: () => BrowserWindow | null,
): void {
  wsClient.on('agent', (payload) => {
    const normalized = normalizeAgentPayload(payload)
    if (!normalized) return
    getMainWindow()?.webContents.send('chat:chunk', normalized)

    if (normalized.state === 'final' || normalized.state === 'error' || normalized.state === 'aborted') {
      runSessions.delete(normalized.runId)

    }
  })
}

// ─── Payload Normalization ──────────────────────────────────────

interface NormalizedPayload {
  runId: string
  sessionKey: string
  seq: number
  state: 'delta' | 'final' | 'aborted' | 'error' | 'tool_start' | 'tool_update' | 'tool_result' | 'thinking'
  message?: unknown
  errorMessage?: string
  thinkingText?: string
  thinkingDelta?: string
  toolCallId?: string
  toolName?: string
  toolArgs?: unknown
  toolMeta?: string
  toolIsError?: boolean
  toolResult?: unknown
}

function normalizeAgentPayload(payload: unknown): NormalizedPayload | null {
  if (!payload || typeof payload !== 'object') return null

  const event = payload as {
    runId?: unknown
    seq?: unknown
    stream?: unknown
    data?: Record<string, unknown>
  }

  const runId = typeof event.runId === 'string' ? event.runId.trim() : ''
  if (!runId) return null

  const sessionKey = runSessions.get(runId)
  if (!sessionKey) return null

  const seq = typeof event.seq === 'number' ? event.seq : 0
  const stream = typeof event.stream === 'string' ? event.stream : ''
  const data = event.data ?? {}

  switch (stream) {
    case 'assistant': {
      const text =
        typeof data.text === 'string' ? data.text : typeof data.delta === 'string' ? data.delta : ''
      if (!text) return null
      return { runId, sessionKey, seq, state: 'delta', message: { text } }
    }

    case 'tool': {
      const phase = firstString(data.phase)
      const toolCallId = firstString(data.toolCallId)
      const toolName = firstString(data.name)

      if (phase === 'start') {
        return { runId, sessionKey, seq, state: 'tool_start', toolCallId, toolName, toolArgs: data.args }
      }
      if (phase === 'update') {
        return { runId, sessionKey, seq, state: 'tool_update', toolCallId, toolName, toolResult: data.partialResult }
      }
      if (phase === 'result') {
        return {
          runId, sessionKey, seq, state: 'tool_result',
          toolCallId, toolName,
          toolMeta: firstString(data.meta),
          toolIsError: data.isError === true,
          toolResult: data.result,
        }
      }
      return null
    }

    case 'thinking': {
      const text = typeof data.text === 'string' ? data.text : ''
      const delta = typeof data.delta === 'string' ? data.delta : ''
      if (!text && !delta) return null
      return { runId, sessionKey, seq, state: 'thinking', thinkingText: text, thinkingDelta: delta }
    }

    case 'error': {
      return {
        runId, sessionKey, seq, state: 'error',
        errorMessage: extractAgentErrorMessage(data) || 'Agent failed before reply',
      }
    }

    case 'lifecycle': {
      const phase = firstString(data.phase)
      if (phase === 'end') {
        return { runId, sessionKey, seq, state: 'final' }
      }
      if (phase === 'error') {
        return {
          runId, sessionKey, seq, state: 'error',
          errorMessage: extractAgentErrorMessage(data) || 'Agent failed before reply',
        }
      }
      return null
    }

    default:
      return null
  }
}

// ─── Helpers ────────────────────────────────────────────────────

const MIME_MAP: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.csv': 'text/csv',
  '.json': 'application/json',
}

function mimeFromExtension(filePath: string): string {
  const ext = extname(filePath).toLowerCase()
  return MIME_MAP[ext] || 'application/octet-stream'
}
