import { describe, it, expect } from 'vitest'
import {
  extractContent,
  extractToolResultText,
  normalizeRole,
  normalizeHistory,
  resolveToolDisplayName,
  formatToolArgs,
  truncate,
  normalizeSessions,
  groupSessions,
  extractAgentId,
  buildSessionKey,
  isDefaultSession,
  isCronSession,
} from '../../renderer/src/stores/chat/helpers'

// ── extractContent ──────────────────────────────────────────────

describe('extractContent', () => {
  it('returns string as-is', () => {
    expect(extractContent('hello')).toBe('hello')
  })

  it('extracts from { content: string }', () => {
    expect(extractContent({ content: 'hi' })).toBe('hi')
  })

  it('extracts from { content: [{ type: "text", text }] }', () => {
    expect(
      extractContent({
        content: [
          { type: 'text', text: 'hello ' },
          { type: 'text', text: 'world' },
        ],
      }),
    ).toBe('hello world')
  })

  it('extracts from { text: string }', () => {
    expect(extractContent({ text: 'fallback' })).toBe('fallback')
  })

  it('returns empty for null/undefined', () => {
    expect(extractContent(null)).toBe('')
    expect(extractContent(undefined)).toBe('')
  })

  it('filters out non-text blocks', () => {
    expect(
      extractContent({
        content: [
          { type: 'image', url: 'x' },
          { type: 'text', text: 'only text' },
        ],
      }),
    ).toBe('only text')
  })
})

// ── extractToolResultText ───────────────────────────────────────

describe('extractToolResultText', () => {
  it('returns string as-is', () => {
    expect(extractToolResultText('result')).toBe('result')
  })

  it('extracts from content array', () => {
    expect(
      extractToolResultText({
        content: [{ type: 'text', text: 'line1' }, { type: 'text', text: 'line2' }],
      }),
    ).toBe('line1\nline2')
  })

  it('extracts from { output: string }', () => {
    expect(extractToolResultText({ output: 'out' })).toBe('out')
  })

  it('extracts from { stdout: string }', () => {
    expect(extractToolResultText({ stdout: 'std' })).toBe('std')
  })

  it('falls back to JSON.stringify for unknown objects', () => {
    const result = extractToolResultText({ foo: 'bar' })
    expect(result).toContain('"foo"')
    expect(result).toContain('"bar"')
  })

  it('returns undefined for null/undefined', () => {
    expect(extractToolResultText(null)).toBeUndefined()
    expect(extractToolResultText(undefined)).toBeUndefined()
  })
})

// ── normalizeRole ───────────────────────────────────────────────

describe('normalizeRole', () => {
  it('passes through user and assistant', () => {
    expect(normalizeRole('user')).toBe('user')
    expect(normalizeRole('assistant')).toBe('assistant')
  })

  it('maps human to user', () => {
    expect(normalizeRole('human')).toBe('user')
  })

  it('maps model to assistant', () => {
    expect(normalizeRole('model')).toBe('assistant')
  })

  it('returns null for unknown roles', () => {
    expect(normalizeRole('system')).toBeNull()
    expect(normalizeRole('tool')).toBeNull()
    expect(normalizeRole(42)).toBeNull()
    expect(normalizeRole(null)).toBeNull()
  })
})

// ── normalizeHistory ────────────────────────────────────────────

describe('normalizeHistory', () => {
  it('converts raw array to ChatMessage[]', () => {
    const history = [
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi' },
    ]
    const msgs = normalizeHistory('test-session', history)
    expect(msgs).toHaveLength(2)
    expect(msgs[0].role).toBe('user')
    expect(msgs[0].content).toBe('hello')
    expect(msgs[1].role).toBe('assistant')
  })

  it('skips entries with unknown roles', () => {
    const history = [
      { role: 'user', content: 'hello' },
      { role: 'tool', content: 'result' },
      { role: 'system', content: 'prompt' },
    ]
    const msgs = normalizeHistory('s', history)
    expect(msgs).toHaveLength(1)
  })

  it('returns empty for non-array input', () => {
    expect(normalizeHistory('s', null as unknown)).toEqual([])
    expect(normalizeHistory('s', 'not array' as unknown)).toEqual([])
    expect(normalizeHistory('s', {} as unknown)).toEqual([])
  })

  it('generates stable IDs from session key and index', () => {
    const msgs = normalizeHistory('sess-1', [{ role: 'user', content: 'hi' }])
    expect(msgs[0].id).toBe('sess-1-history-0')
  })

  it('uses provided id if present', () => {
    const msgs = normalizeHistory('s', [{ id: 'custom-id', role: 'user', content: 'hi' }])
    expect(msgs[0].id).toBe('custom-id')
  })
})

// ── resolveToolDisplayName ──────────────────────────────────────

describe('resolveToolDisplayName', () => {
  it('returns known display names', () => {
    expect(resolveToolDisplayName('exec')).toBe('Bash')
    expect(resolveToolDisplayName('read')).toBe('Read File')
    expect(resolveToolDisplayName('grep')).toBe('Search Content')
  })

  it('handles mcp__ prefix', () => {
    expect(resolveToolDisplayName('mcp__github__list_issues')).toBe('Github: List_issues')
  })

  it('capitalizes unknown names', () => {
    expect(resolveToolDisplayName('custom_tool')).toBe('Custom_tool')
  })
})

// ── formatToolArgs ──────────────────────────────────────────────

describe('formatToolArgs', () => {
  it('extracts command for exec/process', () => {
    expect(formatToolArgs('exec', { command: 'ls -la' })).toBe('ls -la')
    expect(formatToolArgs('process', { cmd: 'npm test' })).toBe('npm test')
  })

  it('extracts path for read/write/edit', () => {
    expect(formatToolArgs('read', { path: '/foo/bar.ts' })).toBe('/foo/bar.ts')
    expect(formatToolArgs('write', { file_path: '/a/b.ts' })).toBe('/a/b.ts')
  })

  it('extracts pattern for glob/grep', () => {
    expect(formatToolArgs('glob', { pattern: '**/*.ts' })).toBe('**/*.ts')
    expect(formatToolArgs('grep', { pattern: 'TODO' })).toBe('TODO')
  })

  it('extracts query for web_search', () => {
    expect(formatToolArgs('web_search', { query: 'vitest docs' })).toBe('vitest docs')
  })

  it('returns undefined for null/non-object args', () => {
    expect(formatToolArgs('exec', null)).toBeUndefined()
    expect(formatToolArgs('exec', 'string')).toBeUndefined()
  })

  it('falls back to JSON for unknown tools', () => {
    const result = formatToolArgs('unknown', { x: 1 })
    expect(result).toContain('"x"')
  })
})

// ── truncate ────────────────────────────────────────────────────

describe('truncate', () => {
  it('returns short strings unchanged', () => {
    expect(truncate('hi', 10)).toBe('hi')
  })

  it('truncates long strings with ellipsis', () => {
    const result = truncate('hello world foo', 10)
    expect(result).toHaveLength(11) // 10 + ellipsis char
    expect(result.endsWith('\u2026')).toBe(true)
  })
})

// ── normalizeSessions ───────────────────────────────────────────

describe('normalizeSessions', () => {
  it('parses array format', () => {
    const sessions = normalizeSessions([
      { key: 'agent:main:chat-1', updatedAt: Date.now() },
    ])
    expect(sessions).toHaveLength(1)
    expect(sessions[0].key).toBe('agent:main:chat-1')
  })

  it('parses { sessions: [] } wrapper format', () => {
    const sessions = normalizeSessions({
      sessions: [{ key: 'agent:main:chat-1', updatedAt: Date.now() }],
    })
    expect(sessions).toHaveLength(1)
  })

  it('filters out cron sessions', () => {
    const sessions = normalizeSessions([
      { key: 'agent:main:cron:job1', updatedAt: Date.now() },
      { key: 'agent:main:chat-1', updatedAt: Date.now() },
    ])
    expect(sessions).toHaveLength(1)
    expect(sessions[0].key).toBe('agent:main:chat-1')
  })

  it('filters out heartbeat sessions', () => {
    const sessions = normalizeSessions([
      { key: 'agent:main:hb-1', origin: { provider: 'heartbeat' }, updatedAt: Date.now() },
      { key: 'agent:main:chat-1', updatedAt: Date.now() },
    ])
    expect(sessions).toHaveLength(1)
  })

  it('prioritizes local labels over displayName', () => {
    const sessions = normalizeSessions(
      [{ key: 'agent:main:chat-1', displayName: 'CatClaw', updatedAt: Date.now() }],
      { 'agent:main:chat-1': 'My Custom Title' },
    )
    expect(sessions[0].title).toBe('My Custom Title')
  })

  it('returns empty for invalid input', () => {
    expect(normalizeSessions(null)).toEqual([])
    expect(normalizeSessions('not array')).toEqual([])
  })

  it('sorts by updatedAt descending', () => {
    const now = Date.now()
    const sessions = normalizeSessions([
      { key: 'old', updatedAt: now - 1000 },
      { key: 'new', updatedAt: now },
    ])
    expect(sessions[0].key).toBe('new')
    expect(sessions[1].key).toBe('old')
  })
})

// ── groupSessions ───────────────────────────────────────────────

describe('groupSessions', () => {
  it('groups into today/yesterday/earlier', () => {
    const now = Date.now()
    const todayStart = new Date().setHours(0, 0, 0, 0)
    const sessions = [
      { key: 'a', title: 'A', preview: '', updatedAt: now },
      { key: 'b', title: 'B', preview: '', updatedAt: todayStart - 1 }, // yesterday
      { key: 'c', title: 'C', preview: '', updatedAt: todayStart - 86_400_001 }, // earlier
    ]
    const grouped = groupSessions(sessions, 'a')
    expect(grouped.groups.length).toBe(3)
    expect(grouped.groups[0].label).toBe('Today')
    expect(grouped.groups[0].items).toHaveLength(1)
    expect(grouped.groups[1].label).toBe('Yesterday')
    expect(grouped.groups[2].label).toBe('Earlier')
  })

  it('omits empty groups', () => {
    const now = Date.now()
    const grouped = groupSessions(
      [{ key: 'a', title: 'A', preview: '', updatedAt: now }],
      'a',
    )
    expect(grouped.groups).toHaveLength(1)
    expect(grouped.groups[0].label).toBe('Today')
  })
})

// ── Session Key Utilities ───────────────────────────────────────

describe('extractAgentId', () => {
  it('parses agent:ID:rest format', () => {
    expect(extractAgentId('agent:support-bot:chat-123')).toBe('support-bot')
  })

  it('returns default for non-agent keys', () => {
    expect(extractAgentId('some-other-key')).toBe('default')
  })
})

describe('buildSessionKey', () => {
  it('builds key with agent prefix', () => {
    const key = buildSessionKey('my-agent')
    expect(key).toMatch(/^agent:my-agent:chat-\d+$/)
  })

  it('defaults to default agent', () => {
    const key = buildSessionKey()
    expect(key).toMatch(/^agent:default:chat-\d+$/)
  })
})

describe('isDefaultSession', () => {
  it('matches :default suffix', () => {
    expect(isDefaultSession('agent:main:default')).toBe(true)
  })

  it('matches :main suffix', () => {
    expect(isDefaultSession('agent:main:main')).toBe(true)
  })

  it('rejects other keys', () => {
    expect(isDefaultSession('agent:main:chat-123')).toBe(false)
  })
})

describe('isCronSession', () => {
  it('matches cron session format', () => {
    expect(isCronSession('agent:main:cron:job1')).toBe(true)
  })

  it('rejects non-cron keys', () => {
    expect(isCronSession('agent:main:chat-1')).toBe(false)
  })
})
