/**
 * Pure helper functions for chat data transformation.
 * No side effects, no store access — pure in, pure out.
 */

import type { ChatMessage, ToolCall, SessionSummary, GroupedSessions } from '../../types'

// ─── Content Extraction ─────────────────────────────────────────

/**
 * Extract plain text content from various message formats.
 * Handles: string, { content: string }, { content: [{ type: 'text', text }] }, { text: string }
 */
export function extractContent(message: unknown): string {
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

/**
 * Extract text from a tool result payload.
 * Handles multiple formats from different providers.
 */
export function extractToolResultText(result: unknown): string | undefined {
  if (!result) return undefined
  if (typeof result === 'string') return result
  if (typeof result === 'object' && result !== null) {
    const r = result as Record<string, unknown>
    if (Array.isArray(r.content)) {
      const texts = r.content
        .filter(
          (b: unknown): b is { type: string; text: string } =>
            typeof b === 'object' && b !== null && (b as Record<string, unknown>).type === 'text',
        )
        .map((b) => b.text)
      if (texts.length > 0) return texts.join('\n')
    }
    if (typeof r.text === 'string') return r.text
    if (typeof r.output === 'string') return r.output
    if (typeof r.stdout === 'string') return r.stdout
    try {
      return JSON.stringify(result, null, 2)
    } catch {
      return undefined
    }
  }
  return String(result)
}

// ─── Role Normalization ─────────────────────────────────────────

export function normalizeRole(role: unknown): 'user' | 'assistant' | null {
  if (role === 'user' || role === 'assistant') return role
  if (role === 'human') return 'user'
  if (role === 'model') return 'assistant'
  return null
}

// ─── History Normalization ──────────────────────────────────────

/**
 * Normalize raw Gateway history response into typed ChatMessage array.
 * Handles different message shapes from various providers.
 */
export function normalizeHistory(sessionKey: string, history: unknown): ChatMessage[] {
  if (!Array.isArray(history)) return []

  return history.flatMap((entry, index) => {
    if (typeof entry !== 'object' || entry === null) return []
    const item = entry as Record<string, unknown>
    const role = normalizeRole(item.role)
    if (!role) return []

    return [
      {
        id: typeof item.id === 'string' ? item.id : `${sessionKey}-history-${index}`,
        role,
        content: extractContent(item),
        state: 'done' as const,
        timestamp: typeof item.timestamp === 'number' ? item.timestamp : Date.now(),
      },
    ]
  })
}

// ─── Tool Display ───────────────────────────────────────────────

const TOOL_DISPLAY_NAMES: Record<string, string> = {
  exec: 'Bash',
  process: 'Process',
  read: 'Read File',
  write: 'Write File',
  edit: 'Edit File',
  glob: 'Search Files',
  grep: 'Search Content',
  web_search: 'Web Search',
  message: 'Send Message',
  cron: 'Scheduled Task',
  spawn: 'Sub Agent',
  sessions_yield: 'Yield',
}

export function resolveToolDisplayName(name: string): string {
  if (TOOL_DISPLAY_NAMES[name]) return TOOL_DISPLAY_NAMES[name]
  if (name.startsWith('mcp__')) {
    const parts = name.replace(/^mcp__/, '').split('__')
    return parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(': ')
  }
  return name.charAt(0).toUpperCase() + name.slice(1)
}

export function formatToolArgs(toolName: string, args: unknown): string | undefined {
  if (!args || typeof args !== 'object') return undefined
  const a = args as Record<string, unknown>

  if (toolName === 'exec' || toolName === 'process') {
    const cmd = typeof a.command === 'string' ? a.command : typeof a.cmd === 'string' ? a.cmd : undefined
    return cmd ? truncate(cmd, 120) : undefined
  }
  if (toolName === 'read' || toolName === 'write' || toolName === 'edit') {
    const p = typeof a.path === 'string' ? a.path : typeof a.file_path === 'string' ? a.file_path : undefined
    return p ?? undefined
  }
  if (toolName === 'glob' || toolName === 'grep') {
    const pat = typeof a.pattern === 'string' ? a.pattern : undefined
    return pat ?? undefined
  }
  if (toolName === 'web_search' || toolName === 'search') {
    const q = typeof a.query === 'string' ? a.query : undefined
    return q ?? undefined
  }
  try {
    return truncate(JSON.stringify(args), 100)
  } catch {
    return undefined
  }
}

export function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + '\u2026' : s
}

// ─── Session Normalization ──────────────────────────────────────

function firstStr(...values: unknown[]): string {
  for (const v of values) {
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return ''
}

/**
 * Normalize raw Gateway sessions.list response into typed SessionSummary array.
 * Handles multiple response shapes defensively.
 *
 * @param sessionLabels — local labels derived from first user message. These take
 *   priority over Gateway's displayName (which is always "ClawPilot" for webchat).
 */
export function normalizeSessions(
  raw: unknown,
  sessionLabels: Record<string, string> = {},
): SessionSummary[] {
  let items: unknown[]
  if (Array.isArray(raw)) {
    items = raw
  } else if (raw && typeof raw === 'object' && Array.isArray((raw as Record<string, unknown>).sessions)) {
    items = (raw as Record<string, unknown>).sessions as unknown[]
  } else {
    return []
  }

  return items
    .map((item, i) => {
      if (!item || typeof item !== 'object') return null
      const o = item as Record<string, unknown>
      const key = firstStr(o.key, o.sessionKey) || `session-${i}`

      // Filter out cron sessions (key format agent:<id>:cron:<jobId>)
      // and heartbeat sessions (origin.provider === 'heartbeat')
      if (isCronSession(key) || isHeartbeatSession(o)) return null
      const preview = firstStr(o.lastMessagePreview, o.preview)
      const updatedAt =
        typeof o.updatedAt === 'number'
          ? o.updatedAt
          : typeof o.updatedAtMs === 'number'
            ? o.updatedAtMs
            : undefined
      const agentId = typeof o.agentId === 'string' ? o.agentId : extractAgentId(key)

      // Title priority: local label → derivedTitle → origin label (non-generic) → displayName (non-generic) → friendly fallback
      const originLabel = typeof o.origin === 'object' && o.origin !== null
        ? firstStr((o.origin as Record<string, unknown>).label)
        : ''
      const genericNames = new Set(['ClawPilot', 'webchat', ''])
      const title = sessionLabels[key]
        || firstStr(o.derivedTitle, o.subject)
        || (!genericNames.has(originLabel) ? originLabel : '')
        || (!genericNames.has(firstStr(o.displayName)) ? firstStr(o.displayName) : '')
        || formatSessionFallbackTitle(key, updatedAt)

      return { key, title, preview, updatedAt, agentId } satisfies SessionSummary
    })
    .filter((s): s is SessionSummary => s !== null)
    .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
}

// ─── Session Grouping ───────────────────────────────────────────

export function groupSessions(sessions: SessionSummary[], _activeSession: string): GroupedSessions {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const yesterdayStart = todayStart - 86_400_000

  // Active session stays in its time group (highlighted by the UI), NOT separated into a "pinned" section.
  const today = sessions.filter((s) => (s.updatedAt ?? 0) >= todayStart)
  const yesterday = sessions.filter((s) => {
    const t = s.updatedAt ?? 0
    return t >= yesterdayStart && t < todayStart
  })
  const earlier = sessions.filter((s) => (s.updatedAt ?? 0) < yesterdayStart)

  const groups = [
    { label: 'Today', items: today },
    { label: 'Yesterday', items: yesterday },
    { label: 'Earlier', items: earlier },
  ].filter((g) => g.items.length > 0)

  return { groups }
}

// ─── Session Key Utilities ──────────────────────────────────────

/** Extract agentId from session key format: agent:<agentId>:<rest> */
export function extractAgentId(sessionKey: string): string {
  if (!sessionKey.startsWith('agent:')) return 'default'
  const parts = sessionKey.split(':')
  return parts[1] || 'default'
}

/** Build a new session key for a given agent */
export function buildSessionKey(agentId: string = 'default'): string {
  return `agent:${agentId}:chat-${Date.now()}`
}

/** Check if a session key represents the default/main session */
export function isDefaultSession(key: string): boolean {
  return key.endsWith(':default') || key.endsWith(':main')
}

/** Check if a session key represents a cron session (agent:<id>:cron:<jobId>) */
export function isCronSession(key: string): boolean {
  const parts = key.split(':')
  return parts.length >= 4 && parts[2] === 'cron'
}

/** Check if a session entry originates from the heartbeat system */
function isHeartbeatSession(entry: Record<string, unknown>): boolean {
  if (typeof entry.origin === 'object' && entry.origin !== null) {
    const origin = entry.origin as Record<string, unknown>
    if (origin.provider === 'heartbeat' || origin.label === 'heartbeat') return true
  }
  if (typeof entry.deliveryContext === 'object' && entry.deliveryContext !== null) {
    const dc = entry.deliveryContext as Record<string, unknown>
    if (dc.to === 'heartbeat') return true
  }
  return false
}

/** Generate a human-friendly fallback title when no label or displayName is available */
function formatSessionFallbackTitle(_key: string, updatedAt?: number): string {
  if (!updatedAt) return 'Chat'
  const d = new Date(updatedAt)
  const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  return `Chat ${time}`
}
