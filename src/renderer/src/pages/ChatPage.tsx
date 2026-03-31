import React, { useEffect, useMemo, useRef, useState } from 'react'
import { MessageBubble } from '../components/chat/MessageBubble'
import { useChatStreamSubscription, useSendMessage } from '../hooks/useChatStream'
import { DEFAULT_SESSION, normalizeHistory, useChatStore } from '../stores/chatStore'
import { useRuntimeStore } from '../stores/runtimeStore'

interface SessionSummary {
  key: string
  title: string
  preview: string
  updatedAt?: number
}

export function ChatPage(): React.ReactElement {
  useChatStreamSubscription()

  const { snapshot } = useRuntimeStore()
  const {
    activeSession,
    setActiveSession,
    hydrateSession,
    messages,
    streaming,
  } = useChatStore()

  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [input, setInput] = useState('')
  const [sendError, setSendError] = useState<string | null>(null)
  const [refreshNonce, setRefreshNonce] = useState(0)
  const endRef = useRef<HTMLDivElement | null>(null)

  const sendMessage = useSendMessage(activeSession)
  const activeMessages = messages[activeSession] ?? []
  const isStreaming = streaming[activeSession] ?? false

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [activeMessages.length, isStreaming])

  useEffect(() => {
    if (snapshot.status !== 'RUNNING') return

    let cancelled = false
    setSessionsLoading(true)

    window.clawpilot.chat.sessions()
      .then((raw) => {
        if (cancelled) return
        const nextSessions = normalizeSessions(raw)
        const current = nextSessions.find((entry) => entry.key === activeSession)
        const fallback = nextSessions[0]?.key ?? activeSession ?? DEFAULT_SESSION
        const ensured = current ? nextSessions : ensureSession(nextSessions, fallback)

        setSessions(ensured)
        if (!current && fallback !== activeSession) {
          setActiveSession(fallback)
        }
      })
      .catch(() => {
        if (cancelled) return
        const fallback = activeSession || DEFAULT_SESSION
        setSessions(ensureSession([], fallback))
      })
      .finally(() => {
        if (!cancelled) {
          setSessionsLoading(false)
        }
      })

    return () => { cancelled = true }
  }, [snapshot.status, snapshot.startedAt, refreshNonce, activeSession, setActiveSession])

  useEffect(() => {
    if (snapshot.status !== 'RUNNING' || !activeSession) return

    let cancelled = false
    setHistoryLoading(true)

    window.clawpilot.chat.history({ sessionKey: activeSession, limit: 80 })
      .then((history) => {
        if (cancelled) return
        const normalized = normalizeHistory(activeSession, history)
        if (normalized.length > 0 || (messages[activeSession]?.length ?? 0) === 0) {
          hydrateSession(activeSession, normalized)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setHistoryLoading(false)
        }
      })

    return () => { cancelled = true }
  }, [activeSession, hydrateSession, messages, snapshot.status, snapshot.startedAt])

  const activeSessionLabel = useMemo(() => {
    return sessions.find((entry) => entry.key === activeSession)?.title ?? activeSession
  }, [activeSession, sessions])

  if (snapshot.status !== 'RUNNING') {
    return (
      <CenteredState
        title="OpenClaw is not running"
        body="Start the local runtime from Status before opening a chat session."
      />
    )
  }

  if (!snapshot.setup.hasProvider || !snapshot.setup.hasDefaultModel) {
    return (
      <CenteredState
        title="Model setup required"
        body="Add a provider and choose a default model on the Providers page before starting a conversation."
        footer={snapshot.setup.configPath}
      />
    )
  }

  async function handleSend(): Promise<void> {
    const text = input.trim()
    if (!text || isStreaming) return

    setSendError(null)
    setInput('')

    try {
      ensureSessionSelected(activeSession)
      await sendMessage(text)
      setRefreshNonce((value) => value + 1)
    } catch (err) {
      setSendError(err instanceof Error ? err.message : String(err))
    }
  }

  function ensureSessionSelected(sessionKey: string): void {
    setSessions((current) => ensureSession(current, sessionKey))
  }

  function handleNewSession(): void {
    const sessionKey = `agent:default:chat-${Date.now()}`
    setSessions((current) => ensureSession(current, sessionKey))
    setActiveSession(sessionKey)
    hydrateSession(sessionKey, [])
    setSendError(null)
  }

  return (
    <div className="flex h-full">
      <aside className="w-80 shrink-0 border-r border-border bg-surface flex flex-col">
        <div className="px-5 py-4 border-b border-border">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-sm font-medium text-foreground">Chat</h1>
              <p className="text-xs text-muted-foreground mt-1">
                ClawPilot chat client on top of the local OpenClaw runtime
              </p>
            </div>
            <button
              onClick={handleNewSession}
              className="cp-btn cp-btn-primary px-3 py-1.5 text-xs"
            >
              New Session
            </button>
          </div>
        </div>

        <div className="px-5 py-3 border-b border-border text-xs text-muted-foreground space-y-1">
          <p>Workspace</p>
          <p className="font-mono text-foreground/80 break-all">{snapshot.setup.workspaceRoot}</p>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {sessionsLoading && sessions.length === 0 && (
            <p className="text-sm text-muted-foreground px-2 py-4">Loading sessions…</p>
          )}

          {sessions.map((session) => (
            <button
              key={session.key}
              onClick={() => setActiveSession(session.key)}
              className={`w-full rounded-2xl border px-3 py-3 text-left transition-colors ${
                activeSession === session.key
                  ? 'border-primary bg-primary/10'
                  : 'border-border bg-surface-2 hover:bg-surface-2/80'
              }`}
            >
              <p className="text-sm font-medium text-foreground truncate">{session.title}</p>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2 min-h-8">
                {session.preview || session.key}
              </p>
            </button>
          ))}
        </div>
      </aside>

      <section className="flex-1 min-w-0 flex flex-col">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-medium text-foreground">{activeSessionLabel}</h2>
            <p className="text-xs text-muted-foreground mt-1 font-mono">{activeSession}</p>
          </div>
          <button
            onClick={() => setRefreshNonce((value) => value + 1)}
            className="cp-btn cp-btn-muted px-3 py-1.5 text-xs"
          >
            Refresh
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {historyLoading && activeMessages.length === 0 ? (
            <p className="text-sm text-muted-foreground">Loading history…</p>
          ) : activeMessages.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="max-w-lg text-center space-y-3">
                <p className="text-foreground text-base font-medium">No messages yet</p>
                <p className="text-sm text-muted-foreground">
                  Start a new conversation. Messages are sent through the local OpenClaw gateway and use the currently selected default model.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {activeMessages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}
              <div ref={endRef} />
            </div>
          )}
        </div>

        <div className="border-t border-border px-6 py-4 space-y-3">
          {sendError && (
            <div className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {sendError}
            </div>
          )}
          <div className="flex gap-3">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  void handleSend()
                }
              }}
              placeholder="Send a message to OpenClaw…"
              className="cp-input flex-1 min-h-28 resize-none"
            />
            <div className="w-28 shrink-0 flex flex-col gap-2">
              <button
                onClick={() => void handleSend()}
                disabled={!input.trim() || isStreaming}
                className="cp-btn cp-btn-primary px-4 py-3 text-sm"
              >
                {isStreaming ? 'Streaming…' : 'Send'}
              </button>
              <div className="rounded-2xl border border-border bg-surface-2 px-3 py-2 text-xs text-muted-foreground">
                <p>Model</p>
                <p className="mt-1 text-foreground/80 font-mono break-words">
                  {snapshot.setup.hasDefaultModel ? 'Default from Providers' : 'Not set'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

function normalizeSessions(raw: unknown): SessionSummary[] {
  const sessionsRaw = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as { sessions?: unknown })?.sessions)
    ? ((raw as { sessions: unknown[] }).sessions)
    : []

  return sessionsRaw.flatMap((entry, index) => {
    if (typeof entry === 'string') {
      return [{ key: entry, title: entry, preview: '', updatedAt: undefined }]
    }

    if (!entry || typeof entry !== 'object') {
      return []
    }

    const item = entry as Record<string, unknown>
    const key = typeof item.key === 'string' ? item.key : typeof item.sessionKey === 'string' ? item.sessionKey : `session-${index}`
    const title = firstString(item.derivedTitle, item.displayName, item.label, item.subject, key)
    const preview = firstString(item.lastMessagePreview, item.preview, '')
    const updatedAt = typeof item.updatedAt === 'number'
      ? item.updatedAt
      : typeof item.updatedAtMs === 'number'
      ? item.updatedAtMs
      : undefined

    return [{ key, title, preview, updatedAt }]
  }).sort((left, right) => (right.updatedAt ?? 0) - (left.updatedAt ?? 0))
}

function ensureSession(list: SessionSummary[], sessionKey: string): SessionSummary[] {
  if (!sessionKey.trim()) {
    return list
  }

  if (list.some((entry) => entry.key === sessionKey)) {
    return list
  }

  return [{ key: sessionKey, title: sessionKey, preview: '', updatedAt: Date.now() }, ...list]
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }
  return ''
}

function CenteredState({
  title,
  body,
  footer,
}: {
  title: string
  body: string
  footer?: string
}): React.ReactElement {
  return (
    <div className="flex items-center justify-center h-full px-6">
      <div className="max-w-xl text-center space-y-3">
        <p className="text-foreground text-base font-medium">{title}</p>
        <p className="text-muted-foreground text-sm">{body}</p>
        {footer && <p className="text-muted-foreground text-xs font-mono break-all">{footer}</p>}
      </div>
    </div>
  )
}
