import { create } from 'zustand'
import type { ChatEvent } from '../api/ipc'

export interface ChatMessage {
  id: string        // runId or local id
  role: 'user' | 'assistant' | 'system'
  content: string
  state: 'sending' | 'streaming' | 'done' | 'error' | 'aborted'
  timestamp: number
  kind?: 'tool_call' | 'tool_result' | 'system'
}

interface ChatStore {
  messages: Record<string, ChatMessage[]>  // sessionKey → messages
  streaming: Record<string, boolean>       // sessionKey → isStreaming
  lastEventAt: Record<string, number>
  lastSeqByRun: Record<string, number>
  activeSession: string
  setActiveSession: (key: string) => void
  hydrateSession: (sessionKey: string, entries: ChatMessage[]) => void
  applyHistory: (sessionKey: string, entries: ChatMessage[]) => void
  addUserMessage: (sessionKey: string, content: string) => string
  markMessageState: (sessionKey: string, id: string, state: ChatMessage['state']) => void
  applyChunk: (chunk: ChatEvent) => void
  clearSession: (sessionKey: string) => void
}

export const DEFAULT_SESSION = 'agent:default:default'

export const useChatStore = create<ChatStore>((set, get) => ({
  messages: {},
  streaming: {},
  lastEventAt: {},
  lastSeqByRun: {},
  activeSession: DEFAULT_SESSION,

  setActiveSession: (key) => set({ activeSession: key }),

  hydrateSession: (sessionKey, entries) =>
    set((s) => ({
      messages: { ...s.messages, [sessionKey]: entries },
      streaming: { ...s.streaming, [sessionKey]: false },
      lastEventAt: { ...s.lastEventAt, [sessionKey]: Date.now() },
    })),

  applyHistory: (sessionKey, entries) =>
    set((s) => {
      const existing = s.messages[sessionKey] ?? []
      const entryById = new Map(entries.map((m) => [m.id, m]))
      const merged = [...entries]

      for (const msg of existing) {
        if (!entryById.has(msg.id)) {
          merged.push(msg)
        }
      }

      const sorted = merged.sort((a, b) => a.timestamp - b.timestamp)
      return {
        messages: { ...s.messages, [sessionKey]: sorted },
        streaming: { ...s.streaming, [sessionKey]: false },
        lastEventAt: { ...s.lastEventAt, [sessionKey]: Date.now() },
      }
    }),

  addUserMessage: (sessionKey, content) => {
    const id = `user-${Date.now()}`
    const msg: ChatMessage = {
      id,
      role: 'user',
      content,
      state: 'sending',
      timestamp: Date.now(),
    }
    set((s) => ({
      messages: {
        ...s.messages,
        [sessionKey]: [...(s.messages[sessionKey] ?? []), msg],
      },
    }))
    return id
  },

  markMessageState: (sessionKey, id, state) =>
    set((s) => ({
      messages: {
        ...s.messages,
        [sessionKey]: (s.messages[sessionKey] ?? []).map((msg) =>
          msg.id === id ? { ...msg, state } : msg,
        ),
      },
    })),

  applyChunk: (chunk: ChatEvent) => {
    const { sessionKey, runId, state, message } = chunk
    const delta = extractContent(message)

    set((s) => {
      const lastSeq = s.lastSeqByRun[runId] ?? -1
      if (chunk.seq <= lastSeq) {
        return s
      }

      const msgs = [...(s.messages[sessionKey] ?? [])]
      const idx = msgs.findIndex((m) => m.id === runId)

      if (state === 'delta') {
        if (idx >= 0) {
          msgs[idx] = {
            ...msgs[idx],
            content: msgs[idx].content + delta,
            state: 'streaming',
          }
        } else {
          msgs.push({ id: runId, role: 'assistant', content: delta, state: 'streaming', timestamp: Date.now() })
        }
      } else if (state === 'final') {
        if (idx >= 0) {
          msgs[idx] = { ...msgs[idx], content: msgs[idx].content || delta, state: 'done' }
        } else {
          msgs.push({ id: runId, role: 'assistant', content: delta, state: 'done', timestamp: Date.now() })
        }
      } else if (state === 'error' || state === 'aborted') {
        const errorState = state === 'aborted' ? 'aborted' : 'error'
        if (idx >= 0) {
          msgs[idx] = {
            ...msgs[idx],
            state: errorState,
            content: msgs[idx].content || (chunk.errorMessage ?? 'Error'),
          }
        } else {
          msgs.push({
            id: runId,
            role: 'assistant',
            content: chunk.errorMessage ?? 'Error',
            state: errorState,
            timestamp: Date.now(),
          })
        }
      }

      return {
        messages: { ...s.messages, [sessionKey]: msgs },
        streaming: {
          ...s.streaming,
          [sessionKey]: state === 'delta' || state === 'streaming',
        },
        lastEventAt: { ...s.lastEventAt, [sessionKey]: Date.now() },
        lastSeqByRun: { ...s.lastSeqByRun, [runId]: chunk.seq },
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

    const timestamp = typeof item.timestamp === 'number' ? item.timestamp : Date.now()
    const id = typeof item.id === 'string' ? item.id : `${sessionKey}-history-${index}`

    const blocks = normalizeContentBlocks(item.content)
    const baseText = blocks.text.join('')

    const baseContent = baseText || extractContent(item)
    const toolMessages = blocks.tools.map((tool, toolIndex) => ({
      id: `${id}-tool-${toolIndex}`,
      role: 'system' as const,
      content: tool.content,
      state: 'done' as const,
      timestamp: timestamp + toolIndex + 1,
      kind: tool.kind,
    }))
    const baseMessage = baseContent
      ? [{
          id,
          role,
          content: baseContent,
          state: 'done' as const,
          timestamp,
        }]
      : []

    return [...baseMessage, ...toolMessages]
  })
}

function normalizeRole(role: unknown): 'user' | 'assistant' | 'system' | null {
  if (role === 'user' || role === 'assistant' || role === 'system') return role
  if (role === 'human') return 'user'
  if (role === 'model') return 'assistant'
  if (role === 'error') return 'system'
  return null
}

function normalizeContentBlocks(content: unknown): {
  text: string[]
  tools: Array<{ kind: 'tool_call' | 'tool_result'; content: string }>
} {
  if (!Array.isArray(content)) {
    return { text: [], tools: [] }
  }

  const text: string[] = []
  const tools: Array<{ kind: 'tool_call' | 'tool_result'; content: string }> = []

  for (const block of content) {
    if (!block || typeof block !== 'object') continue
    const item = block as Record<string, unknown>
    const type = typeof item.type === 'string' ? item.type : ''

    if (type === 'text' && typeof item.text === 'string') {
      text.push(item.text)
      continue
    }

    if (type === 'toolCall' || type === 'tool_call') {
      const name = typeof item.name === 'string' ? item.name : 'tool'
      const args = item.arguments ? JSON.stringify(item.arguments) : ''
      tools.push({
        kind: 'tool_call',
        content: `Tool Call · ${name}${args ? ` ${args}` : ''}`,
      })
      continue
    }

    if (type === 'toolResult' || type === 'tool_result') {
      const name = typeof item.name === 'string' ? item.name : 'tool'
      const result = item.content ? JSON.stringify(item.content) : ''
      tools.push({
        kind: 'tool_result',
        content: `Tool Result · ${name}${result ? ` ${result}` : ''}`,
      })
      continue
    }
  }

  return { text, tools }
}
