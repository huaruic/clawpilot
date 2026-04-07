import React, { useEffect, useState, useCallback } from 'react'
import { Search, Plus } from 'lucide-react'
import { useChatStore } from '../stores/chat'
import { deleteSession } from '../services/chatService'
import { useRuntimeStore } from '../stores/runtimeStore'
import type { Page } from '../components/layout/AppSidebar'

const PAGE_SIZE = 10

function formatRelativeTime(ts?: number): string {
  if (!ts) return ''
  const now = Date.now()
  const diff = now - ts
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  if (days < 30) return 'Past week'
  if (days < 90) return 'Past month'
  return `${Math.floor(days / 30)} months ago`
}

export function AllChatsPage({ onNavigate }: { onNavigate: (page: Page) => void }): React.ReactElement {
  const { snapshot } = useRuntimeStore()
  const { activeSession, setActiveSession, sessionListVersion, sessionLabels, newSession, bumpSessionList, sessions, fetchSessions, removeSession } = useChatStore()

  const [searchQuery, setSearchQuery] = useState('')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  // Ensure sessions are fresh when this page mounts or list version changes
  useEffect(() => {
    if (snapshot.status !== 'RUNNING') return
    void fetchSessions()
  }, [snapshot.status, snapshot.startedAt, sessionListVersion, fetchSessions])

  const mergedSessions = React.useMemo(() => {
    let base = sessions
    if (base.length === 0 && Object.keys(sessionLabels).length > 0) {
      base = Object.entries(sessionLabels)
        .filter(([, label]) => label)
        .map(([key, label]) => ({ key, title: label, preview: '', updatedAt: undefined }))
    }
    if (activeSession && !base.some((s) => s.key === activeSession)) {
      const label = sessionLabels[activeSession]
      if (label || useChatStore.getState().messages[activeSession]?.length) {
        base = [{ key: activeSession, title: label || 'New Chat', preview: '', updatedAt: Date.now() }, ...base]
      }
    }
    return base
  }, [sessions, activeSession, sessionLabels])

  const isSearching = searchQuery.trim().length > 0
  const filtered = isSearching
    ? mergedSessions.filter((s) => {
        const q = searchQuery.toLowerCase()
        return s.title.toLowerCase().includes(q) || (s.preview ?? '').toLowerCase().includes(q)
      })
    : mergedSessions

  const displayed = isSearching ? filtered : filtered.slice(0, visibleCount)
  const hasMore = !isSearching && filtered.length > visibleCount

  const handleSelect = useCallback((key: string) => {
    setActiveSession(key)
    onNavigate('chat')
  }, [setActiveSession, onNavigate])

  const handleNewChat = useCallback(() => {
    newSession('default')
    onNavigate('chat')
  }, [newSession, onNavigate])

  const handleDelete = useCallback(async (key: string) => {
    try { await deleteSession(key) } catch { /* non-fatal */ }
    removeSession(key)
    useChatStore.getState().setSessionLabel(key, '')
    if (key === activeSession) newSession('default')
    bumpSessionList()
  }, [activeSession, newSession, bumpSessionList, removeSession])

  return (
    <div className="mx-auto max-w-[720px] px-6 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground">Chats</h1>
        <button
          onClick={handleNewChat}
          className="flex items-center gap-2 rounded-xl bg-foreground px-4 py-2 text-sm font-medium text-card transition-colors hover:bg-foreground/90"
        >
          <Plus className="h-4 w-4" />
          New chat
        </button>
      </div>

      {/* Search bar */}
      <div className="relative mb-6">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search your chats..."
          className="h-12 w-full rounded-xl border border-border bg-card pl-11 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
        />
      </div>

      {/* Subheader */}
      <div className="mb-4 flex items-center gap-3 px-1">
        <span className="text-sm text-muted-foreground">Your chats with ClawPilot</span>
      </div>

      {/* Chat list */}
      <div className="divide-y divide-border/50">
        {displayed.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            {isSearching ? 'No chats found' : 'No chats yet'}
          </p>
        ) : (
          displayed.map((session) => (
            <button
              key={session.key}
              onClick={() => handleSelect(session.key)}
              className="group flex w-full items-center gap-4 py-4 px-2 text-left transition-colors hover:bg-accent/30 rounded-lg"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{session.title}</p>
                {session.updatedAt && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Last message {formatRelativeTime(session.updatedAt)}
                  </p>
                )}
              </div>
            </button>
          ))
        )}
      </div>

      {/* Show more */}
      {hasMore && (
        <button
          onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
          className="mt-4 flex w-full items-center justify-center rounded-xl border border-border py-3 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          Show more
        </button>
      )}
    </div>
  )
}
