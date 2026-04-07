import React, { useState, useEffect, useRef } from 'react'
import { Search, X, MessageSquare } from 'lucide-react'
import type { SessionSummary } from '../../types'

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

interface SearchDialogProps {
  open: boolean
  onClose: () => void
  sessions: SessionSummary[]
  onSelectSession: (key: string) => void
}

export function SearchDialog({ open, onClose, sessions, onSelectSession }: SearchDialogProps): React.ReactElement | null {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  if (!open) return null

  const filtered = query.trim()
    ? sessions.filter((s) => {
        const q = query.toLowerCase()
        return s.title.toLowerCase().includes(q) || (s.preview ?? '').toLowerCase().includes(q)
      })
    : sessions

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      {/* Dialog */}
      <div className="relative w-full max-w-[560px] rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search chats..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-[400px] overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              {query.trim() ? 'No chats found' : 'No chats yet'}
            </p>
          ) : (
            filtered.map((session) => (
              <button
                key={session.key}
                onClick={() => {
                  onSelectSession(session.key)
                  onClose()
                }}
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-accent/50 transition-colors border-b border-border/30 last:border-b-0"
              >
                <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate text-sm text-foreground">{session.title}</span>
                {session.updatedAt && (
                  <span className="shrink-0 text-xs text-muted-foreground">{formatRelativeTime(session.updatedAt)}</span>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
