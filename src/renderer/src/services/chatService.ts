/**
 * Chat service — typed wrapper over IPC calls.
 *
 * Encapsulates all communication with the main process for chat operations.
 * The renderer store and hooks should call this service instead of raw IPC.
 *
 * Benefits:
 * - Single place to add retry logic, error normalization, logging
 * - Testable via dependency injection (swap the IPC bridge in tests)
 * - Decouples store logic from transport details
 */

import type { AttachmentPayload, SessionSummary, ChatMessage, AgentSummary } from '../types'
import { normalizeHistory, normalizeSessions } from '../stores/chat/helpers'

// ─── IPC Bridge Access ──────────────────────────────────────────

function getApi(): typeof window.catclaw {
  return window.catclaw
}

// ─── Chat Operations ────────────────────────────────────────────

export interface SendMessageParams {
  sessionKey: string
  message: string
  attachments?: AttachmentPayload[]
}

export interface SendMessageResult {
  runId?: string
}

export async function sendMessage(params: SendMessageParams): Promise<SendMessageResult> {
  const result = await getApi().chat.send(params)
  return (result ?? {}) as SendMessageResult
}

export async function abortRun(sessionKey: string, runId?: string): Promise<void> {
  await getApi().chat.abort({ sessionKey, runId })
}

// ─── History ────────────────────────────────────────────────────

export async function loadHistory(
  sessionKey: string,
  limit: number = 100,
): Promise<ChatMessage[]> {
  const raw = await getApi().chat.history({ sessionKey, limit })
  if (!raw) return []
  const messages = (raw as Record<string, unknown>).messages ?? raw
  return normalizeHistory(sessionKey, messages)
}

// ─── Sessions ───────────────────────────────────────────────────

export async function loadSessions(
  sessionLabels: Record<string, string> = {},
): Promise<SessionSummary[]> {
  const raw = await getApi().chat.sessions()
  return normalizeSessions(raw, sessionLabels)
}

export async function resetSession(sessionKey: string): Promise<void> {
  await getApi().chat.resetSession({ sessionKey })
}

export async function deleteSession(sessionKey: string): Promise<void> {
  await getApi().chat.deleteSession({ sessionKey })
}

// ─── Agents ─────────────────────────────────────────────────────

export async function loadAgents(): Promise<AgentSummary[]> {
  const raw = await getApi().chat.agents()
  if (!Array.isArray(raw)) return []
  return raw.map((item: Record<string, unknown>) => ({
    id: String(item.id ?? 'default'),
    name: typeof item.name === 'string' ? item.name : undefined,
    description: typeof item.description === 'string' ? item.description : undefined,
    isDefault: item.default === true || item.isDefault === true,
  }))
}

// ─── File Operations ────────────────────────────────────────────

export interface FileReadResult {
  content: string
  mimeType: string
  fileName: string
  fileSize: number
}

export async function readFileAsBase64(filePath: string): Promise<FileReadResult> {
  return await getApi().file.readAsBase64(filePath)
}

// ─── Stream Subscription ────────────────────────────────────────

import type { ChatEvent } from '../types'

/**
 * Subscribe to chat chunk events from the main process.
 * Returns an unsubscribe function.
 */
export function subscribeToChunks(callback: (chunk: ChatEvent) => void): () => void {
  return getApi().chat.onChunk(callback)
}
