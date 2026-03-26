import { create } from 'zustand'
import type { ChatEvent } from '../api/ipc'

export interface ChatMessage {
  id: string        // runId or local id
  role: 'user' | 'assistant'
  content: string
  state: 'sending' | 'streaming' | 'done' | 'error'
  timestamp: number
}

interface ChatStore {
  messages: Record<string, ChatMessage[]>  // sessionKey → messages
  streaming: Record<string, boolean>       // sessionKey → isStreaming
  activeSession: string
  setActiveSession: (key: string) => void
  hydrateSession: (sessionKey: string, entries: ChatMessage[]) => void
  addUserMessage: (sessionKey: string, content: string) => void
  applyChunk: (chunk: ChatEvent) => void
  clearSession: (sessionKey: string) => void
}

export const DEFAULT_SESSION = 'agent:default:default'

export const useChatStore = create<ChatStore>((set, get) => ({
  messages: {},
  streaming: {},
  activeSession: DEFAULT_SESSION,

  setActiveSession: (key) => set({ activeSession: key }),

  hydrateSession: (sessionKey, entries) =>
    set((s) => ({
      messages: { ...s.messages, [sessionKey]: entries },
      streaming: { ...s.streaming, [sessionKey]: false },
    })),

  addUserMessage: (sessionKey, content) => {
    const msg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
      state: 'done',
      timestamp: Date.now(),
    }
    set((s) => ({
      messages: {
        ...s.messages,
        [sessionKey]: [...(s.messages[sessionKey] ?? []), msg],
      },
    }))
  },

  applyChunk: (chunk: ChatEvent) => {
    const { sessionKey, runId, state, message } = chunk
    const content = extractContent(message)

    set((s) => {
      const msgs = [...(s.messages[sessionKey] ?? [])]
      const idx = msgs.findIndex((m) => m.id === runId)

      if (state === 'delta') {
        if (idx >= 0) {
          msgs[idx] = { ...msgs[idx], content, state: 'streaming' }
        } else {
          msgs.push({ id: runId, role: 'assistant', content, state: 'streaming', timestamp: Date.now() })
        }
      } else if (state === 'final') {
        if (idx >= 0) {
          msgs[idx] = { ...msgs[idx], content: content || msgs[idx].content, state: 'done' }
        } else {
          msgs.push({ id: runId, role: 'assistant', content, state: 'done', timestamp: Date.now() })
        }
      } else if (state === 'error' || state === 'aborted') {
        if (idx >= 0) {
          msgs[idx] = { ...msgs[idx], state: 'error', content: msgs[idx].content || (chunk.errorMessage ?? 'Error') }
        } else {
          msgs.push({ id: runId, role: 'assistant', content: chunk.errorMessage ?? 'Error', state: 'error', timestamp: Date.now() })
        }
      }

      return {
        messages: { ...s.messages, [sessionKey]: msgs },
        streaming: {
          ...s.streaming,
          [sessionKey]: state === 'delta' || state === 'streaming',
        },
      }
    })
  },

  clearSession: (sessionKey) =>
    set((s) => ({
      messages: { ...s.messages, [sessionKey]: [] },
    })),
}))

function extractContent(message: unknown): string {
  if (!message) return ''
  if (typeof message === 'string') return message
  if (typeof message === 'object' && message !== null) {
    // OpenClaw message format: { content: string | Array }
    const m = message as Record<string, unknown>
    if (typeof m.content === 'string') return m.content
    if (Array.isArray(m.content)) {
      return m.content
        .filter((b): b is { type: string; text: string } => b?.type === 'text')
        .map((b) => b.text)
        .join('')
    }
    if (typeof m.text === 'string') return m.text
  }
  return ''
}

export function normalizeHistory(sessionKey: string, history: unknown): ChatMessage[] {
  if (!Array.isArray(history)) return []

  return history.flatMap((entry, index) => {
    if (typeof entry !== 'object' || entry === null) return []
    const item = entry as Record<string, unknown>
    const role = normalizeRole(item.role)
    if (!role) return []

    return [{
      id: typeof item.id === 'string' ? item.id : `${sessionKey}-history-${index}`,
      role,
      content: extractContent(item),
      state: 'done' as const,
      timestamp: typeof item.timestamp === 'number' ? item.timestamp : Date.now(),
    }]
  })
}

function normalizeRole(role: unknown): 'user' | 'assistant' | null {
  if (role === 'user' || role === 'assistant') return role
  if (role === 'human') return 'user'
  if (role === 'model') return 'assistant'
  return null
}
