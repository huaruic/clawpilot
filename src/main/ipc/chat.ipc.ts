import { ipcMain, BrowserWindow } from 'electron'
import { randomUUID } from 'node:crypto'
import type { WsGatewayClient } from '../services/WsGatewayClient'
import { ChatSendSchema, ChatHistorySchema } from './schemas/chat.schema'
import { mainLogger } from '../utils/logger'

interface Deps {
  getWsClient: () => WsGatewayClient
  getMainWindow: () => BrowserWindow | null
}

export const DEFAULT_SESSION_KEY = 'agent:default:default'
const runSessions = new Map<string, string>()

export function registerChatIpc({ getWsClient, getMainWindow }: Deps): void {
  ipcMain.handle('chat:send', async (_, raw) => {
    const params = ChatSendSchema.parse(raw)
    const result = await getWsClient().request<{ runId?: string }>('chat.send', {
      sessionKey: params.sessionKey,
      message: params.message,
      idempotencyKey: randomUUID(),
    })
    if (typeof result?.runId === 'string' && result.runId.trim()) {
      runSessions.set(result.runId, params.sessionKey)
    }
    return result
  })

  ipcMain.handle('chat:history', async (_, raw) => {
    const params = ChatHistorySchema.parse(raw)
    try {
      return await getWsClient().request('chat.history', {
        sessionKey: params.sessionKey,
        limit: params.limit ?? 50,
      })
    } catch (err) {
      mainLogger.warn('[chat.history] failed:', String(err))
      return []
    }
  })

  ipcMain.handle('chat:sessions', async () => {
    try {
      return await getWsClient().request('sessions.list', {})
    } catch (err) {
      mainLogger.warn('[chat:sessions] failed:', String(err))
      return []
    }
  })
}

// Register chat event forwarding once the WsGatewayClient is connected
export function registerChatEventForwarding(wsClient: WsGatewayClient, getMainWindow: () => BrowserWindow | null): void {
  wsClient.on('agent', (payload) => {
    const normalized = normalizeAgentPayload(payload)
    if (!normalized) return
    getMainWindow()?.webContents.send('chat:chunk', normalized)

    if (normalized.state === 'final' || normalized.state === 'error' || normalized.state === 'aborted') {
      runSessions.delete(normalized.runId)
    }
  })
}

function normalizeAgentPayload(payload: unknown): {
  runId: string
  sessionKey: string
  seq: number
  state: 'delta' | 'final' | 'aborted' | 'error'
  message?: unknown
  errorMessage?: string
} | null {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const event = payload as {
    runId?: unknown
    seq?: unknown
    stream?: unknown
    data?: Record<string, unknown>
  }

  const runId = typeof event.runId === 'string' ? event.runId.trim() : ''
  if (!runId) {
    return null
  }

  const sessionKey = runSessions.get(runId)
  if (!sessionKey) {
    return null
  }

  const seq = typeof event.seq === 'number' ? event.seq : 0
  const stream = typeof event.stream === 'string' ? event.stream : ''
  const data = event.data ?? {}

  if (stream === 'assistant') {
    const text = typeof data.text === 'string'
      ? data.text
      : typeof data.delta === 'string'
      ? data.delta
      : ''
    if (!text) {
      return null
    }
    return {
      runId,
      sessionKey,
      seq,
      state: 'delta',
      message: { text },
    }
  }

  if (stream === 'error') {
    return {
      runId,
      sessionKey,
      seq,
      state: 'error',
      errorMessage: firstString(data.reason, data.message, 'Agent failed before reply'),
    }
  }

  if (stream === 'lifecycle') {
    const phase = firstString(data.phase)
    if (phase === 'end') {
      return {
        runId,
        sessionKey,
        seq,
        state: 'final',
      }
    }
    if (phase === 'error') {
      return {
        runId,
        sessionKey,
        seq,
        state: 'error',
        errorMessage: firstString(data.reason, 'Agent failed before reply'),
      }
    }
  }

  return null
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }
  return ''
}
