/**
 * Chat Store — central state management for chat sessions and messages.
 *
 * Architecture:
 * - Types live in types/chat.ts (shared across renderer)
 * - Pure helpers live in ./helpers.ts (extractContent, normalize*, format*)
 * - Event state machine lives in ./chunkProcessor.ts (processChunk)
 * - IPC calls live in services/chatService.ts
 * - This file orchestrates state transitions using the above modules
 *
 * Persistence:
 * - activeSession + drafts are persisted to localStorage via zustand/persist
 * - messages/streaming/activeRuns are ephemeral (rebuilt from Gateway on load)
 *
 * Multi-session:
 * - messages are keyed by sessionKey: Record<string, ChatMessage[]>
 * - Switching sessions does NOT clear other sessions' messages (no flash)
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ChatMessage, ChatEvent, DraftState, AttachedFile, SessionSummary } from '../../types'
import { processChunk } from './chunkProcessor'
import { normalizeSessions as normalizeSessionsHelper } from './helpers'

// ─── Constants ──────────────────────────────────────────────────

export const DEFAULT_SESSION = 'agent:default:default'

const SAFETY_TIMEOUT_MS = 60_000
const SAFETY_CHECK_INTERVAL_MS = 10_000
const SAFETY_INITIAL_DELAY_MS = 15_000

// ─── Store Interface ────────────────────────────────────────────

interface ChatStore {
  // ── State ──
  messages: Record<string, ChatMessage[]>
  streaming: Record<string, boolean>
  activeSession: string
  sessionListVersion: number
  drafts: Record<string, DraftState>
  activeRuns: Record<string, string> // sessionKey → runId
  /** Local session titles derived from first user message (overrides Gateway's displayName) */
  sessionLabels: Record<string, string>
  /** Shared session list — single source of truth for sidebar + AllChatsPage */
  sessions: SessionSummary[]

  // ── Session Actions ──
  setActiveSession: (key: string) => void
  bumpSessionList: () => void
  /** Create a new session, switch to it, and return the key */
  newSession: (agentId?: string) => string
  /** Set a local label for a session (e.g. first user message) */
  setSessionLabel: (sessionKey: string, label: string) => void
  /** Fetch sessions from gateway and update shared state */
  fetchSessions: () => Promise<void>
  /** Remove a session from the local list (after deletion) */
  removeSession: (sessionKey: string) => void

  // ── Message Actions ──
  hydrateSession: (sessionKey: string, entries: ChatMessage[]) => void
  addUserMessage: (sessionKey: string, content: string, attachments?: AttachedFile[]) => void
  addSystemMessage: (sessionKey: string, content: string) => void
  applyChunk: (chunk: ChatEvent) => void
  clearSession: (sessionKey: string) => void

  // ── Streaming Actions ──
  setStreaming: (sessionKey: string, value: boolean) => void
  setActiveRun: (sessionKey: string, runId: string) => void
  clearActiveRun: (sessionKey: string) => void
  markRunError: (sessionKey: string, runId: string, errorMessage: string) => void

  // ── Draft Actions ──
  saveDraft: (sessionKey: string, text: string, attachments?: AttachedFile[]) => void
  clearDraft: (sessionKey: string) => void

  // ── Derived ──
  getSessionMessages: (sessionKey: string) => ChatMessage[]
  isSessionStreaming: (sessionKey: string) => boolean
}

// ─── Store Creation ─────────────────────────────────────────────

export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => ({
      // ── Initial State ──
      messages: {},
      streaming: {},
      activeSession: DEFAULT_SESSION,
      sessionListVersion: 0,
      drafts: {},
      activeRuns: {},
      sessionLabels: {},
      sessions: [],

      // ── Session Actions ──

      setActiveSession: (key) => set({ activeSession: key }),

      bumpSessionList: () => set((s) => ({ sessionListVersion: s.sessionListVersion + 1 })),

      newSession: (agentId = 'default') => {
        const key = `agent:${agentId}:chat-${Date.now()}`
        set((s) => ({
          activeSession: key,
          messages: { ...s.messages, [key]: [] },
          streaming: { ...s.streaming, [key]: false },
        }))
        return key
      },

      setSessionLabel: (sessionKey, label) =>
        set((s) => ({
          sessionLabels: { ...s.sessionLabels, [sessionKey]: label },
        })),

      fetchSessions: async () => {
        try {
          const raw = await window.catclaw.chat.sessions()
          const list = normalizeSessionsHelper(raw, get().sessionLabels)
          set({ sessions: list })
        } catch {
          // non-fatal — keep existing sessions
        }
      },

      removeSession: (sessionKey) =>
        set((s) => ({
          sessions: s.sessions.filter((sess) => sess.key !== sessionKey),
        })),

      // ── Message Actions ──

      hydrateSession: (sessionKey, entries) =>
        set((s) => ({
          messages: { ...s.messages, [sessionKey]: entries },
          streaming: { ...s.streaming, [sessionKey]: false },
        })),

      addUserMessage: (sessionKey, content, attachments) => {
        const msg: ChatMessage = {
          id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          role: 'user',
          content,
          attachments: attachments?.length ? attachments : undefined,
          state: 'done',
          timestamp: Date.now(),
        }
        set((s) => {
          const existing = s.messages[sessionKey] ?? []
          const isFirstMessage = existing.length === 0
          return {
            messages: {
              ...s.messages,
              [sessionKey]: [...existing, msg],
            },
            streaming: { ...s.streaming, [sessionKey]: true },
            // Auto-derive session label from first user message
            ...(isFirstMessage && !s.sessionLabels[sessionKey]
              ? { sessionLabels: { ...s.sessionLabels, [sessionKey]: content.slice(0, 50) } }
              : {}),
          }
        })
      },

      addSystemMessage: (sessionKey, content) => {
        const msg: ChatMessage = {
          id: `system-${Date.now()}`,
          role: 'system',
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
        const { sessionKey, runId } = chunk
        if (!sessionKey || !runId) return

        const current = get().messages[sessionKey] ?? []
        const { messages: updated, isTerminal } = processChunk(current, chunk)

        const nextActiveRuns = isTerminal
          ? omitKey(get().activeRuns, sessionKey)
          : get().activeRuns

        set({
          messages: { ...get().messages, [sessionKey]: updated },
          streaming: { ...get().streaming, [sessionKey]: !isTerminal },
          activeRuns: nextActiveRuns,
        })

        // When a run finishes, bump session list so the sidebar refreshes
        // with proper title and preview from the gateway.
        if (isTerminal) {
          set((s) => ({ sessionListVersion: s.sessionListVersion + 1 }))
        }
      },

      clearSession: (sessionKey) =>
        set((s) => ({
          messages: { ...s.messages, [sessionKey]: [] },
          streaming: { ...s.streaming, [sessionKey]: false },
          activeRuns: omitKey(s.activeRuns, sessionKey),
        })),

      // ── Streaming Actions ──

      setStreaming: (sessionKey, value) =>
        set((s) => ({ streaming: { ...s.streaming, [sessionKey]: value } })),

      setActiveRun: (sessionKey, runId) =>
        set((s) => ({ activeRuns: { ...s.activeRuns, [sessionKey]: runId } })),

      clearActiveRun: (sessionKey) =>
        set((s) => ({ activeRuns: omitKey(s.activeRuns, sessionKey) })),

      markRunError: (sessionKey, runId, errorMessage) => {
        set((s) => {
          const msgs = (s.messages[sessionKey] ?? []).map((m) =>
            m.id === runId && m.state === 'streaming'
              ? { ...m, state: 'error' as const, content: m.content || errorMessage, completedAt: Date.now() }
              : m,
          )
          return {
            messages: { ...s.messages, [sessionKey]: msgs },
            streaming: { ...s.streaming, [sessionKey]: false },
            activeRuns: omitKey(s.activeRuns, sessionKey),
          }
        })
      },

      // ── Draft Actions ──

      saveDraft: (sessionKey, text, attachments) =>
        set((s) => ({
          drafts: {
            ...s.drafts,
            [sessionKey]: { text, attachments: attachments?.length ? attachments : undefined },
          },
        })),

      clearDraft: (sessionKey) =>
        set((s) => ({
          drafts: omitKey(s.drafts, sessionKey),
        })),

      // ── Derived ──

      getSessionMessages: (sessionKey) => get().messages[sessionKey] ?? [],

      isSessionStreaming: (sessionKey) => get().streaming[sessionKey] ?? false,
    }),
    {
      name: 'catclaw-chat',
      partialize: (state) => ({
        activeSession: state.activeSession,
        drafts: state.drafts,
        sessionLabels: state.sessionLabels,
      }),
    },
  ),
)

// ─── Safety Timeout ─────────────────────────────────────────────

/**
 * Start a safety timeout that marks a run as errored if no events arrive
 * within SAFETY_TIMEOUT_MS. Returns a cleanup function.
 */
export function startSafetyTimeout(sessionKey: string, runId: string): () => void {
  const sendStartedAt = Date.now()
  let timer: ReturnType<typeof setTimeout> | null = null

  const check = (): void => {
    const state = useChatStore.getState()
    if (!state.streaming[sessionKey]) return // already ended
    if (state.activeRuns[sessionKey] !== runId) return // different run

    if (Date.now() - sendStartedAt >= SAFETY_TIMEOUT_MS) {
      state.markRunError(
        sessionKey,
        runId,
        'No response received. The provider may be unavailable.',
      )
      return
    }
    timer = setTimeout(check, SAFETY_CHECK_INTERVAL_MS)
  }

  timer = setTimeout(check, SAFETY_INITIAL_DELAY_MS)
  return () => {
    if (timer) clearTimeout(timer)
  }
}

// ─── Re-exports for convenience ─────────────────────────────────

export type { ChatMessage, ChatEvent, DraftState, AttachedFile } from '../../types'
export { normalizeHistory, normalizeSessions, groupSessions, buildSessionKey } from './helpers'

// ─── Utilities ──────────────────────────────────────────────────

function omitKey<V>(record: Record<string, V>, key: string): Record<string, V> {
  const { [key]: _, ...rest } = record
  return rest
}
