import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { getOpenClawStateDir } from './RuntimeLocator'

export interface SessionUsageSummary {
  agentId: string
  sessionId: string
  sessionKey?: string
  model?: string
  startedAt?: number
  updatedAt: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
  costCny: number
  entries: number
}

export interface ModelUsageSummary {
  model: string
  sessionCount: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
  costCny: number
  lastUpdatedAt: number
}

export interface MessageUsageEntry {
  agentId: string
  sessionId: string
  sessionKey?: string
  messageId?: string
  role?: string
  model?: string
  timestamp: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
  cacheReadTokens: number
  costCny: number
  textPreview?: string
}

export interface MessageUsagePage {
  total: number
  items: MessageUsageEntry[]
}

export interface UsageBreakdownRow {
  key: string
  label: string
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  totalTokens: number
}

interface UsageDelta {
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
  costCny?: number
  cacheReadTokens?: number
}

interface SessionFileInfo {
  agentId: string
  sessionId: string
  filePath: string
  mtime: number
}

export class UsageService {
  private readonly agentsDir: string

  constructor() {
    this.agentsDir = path.join(getOpenClawStateDir(), 'agents')
  }

  async listSessionUsage(options?: {
    agentId?: string
    limit?: number
    since?: number
    until?: number
  }): Promise<SessionUsageSummary[]> {
    const { agentId, limit, since, until } = options || {}
    const maxItems = typeof limit === 'number' ? limit : Number.POSITIVE_INFINITY
    const sessionFiles = await this.listSessionFiles(agentId)
    const summaries: SessionUsageSummary[] = []

    for (const file of sessionFiles) {
      try {
        const summary = await this.parseSessionFile(file)
        if (summary.entries === 0) continue

        if (since && summary.updatedAt < since) continue
        if (until && summary.updatedAt > until) continue

        summaries.push(summary)
        if (summaries.length >= maxItems) break
      } catch {
        continue
      }
    }

    return summaries.sort((a, b) => b.updatedAt - a.updatedAt)
  }

  async aggregateByModel(options?: {
    agentId?: string
    since?: number
    until?: number
  }): Promise<ModelUsageSummary[]> {
    const sessions = await this.listSessionUsage({
      agentId: options?.agentId,
      since: options?.since,
      until: options?.until,
    })

    const map = new Map<string, ModelUsageSummary>()

    for (const session of sessions) {
      const modelKey = session.model ?? 'unknown'
      const current = map.get(modelKey) ?? {
        model: modelKey,
        sessionCount: 0,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        costCny: 0,
        lastUpdatedAt: 0,
      }

      current.sessionCount += 1
      current.inputTokens += session.inputTokens
      current.outputTokens += session.outputTokens
      current.totalTokens += session.totalTokens
      current.costCny += session.costCny
      current.lastUpdatedAt = Math.max(current.lastUpdatedAt, session.updatedAt)

      map.set(modelKey, current)
    }

    return Array.from(map.values()).sort((a, b) => b.totalTokens - a.totalTokens)
  }

  async listMessageUsage(options?: {
    agentId?: string
    limit?: number
    offset?: number
    since?: number
    until?: number
  }): Promise<MessageUsagePage> {
    const { agentId, limit = 50, offset = 0, since, until } = options || {}
    const entries = await this.readAllMessageEntries(agentId)

    const filtered = entries.filter((entry) => {
      if (since && entry.timestamp < since) return false
      if (until && entry.timestamp > until) return false
      return true
    })

    filtered.sort((a, b) => b.timestamp - a.timestamp)
    const items = filtered.slice(offset, offset + limit)

    return {
      total: filtered.length,
      items,
    }
  }

  async aggregateMessagesByModel(options?: {
    agentId?: string
    since?: number
    until?: number
  }): Promise<UsageBreakdownRow[]> {
    const entries = await this.readAllMessageEntries(options?.agentId)
    const map = new Map<string, UsageBreakdownRow>()

    for (const entry of entries) {
      if (options?.since && entry.timestamp < options.since) continue
      if (options?.until && entry.timestamp > options.until) continue

      const modelKey = entry.model ?? 'unknown'
      const current = map.get(modelKey) ?? {
        key: modelKey,
        label: modelKey,
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        totalTokens: 0,
      }

      current.inputTokens += entry.inputTokens
      current.outputTokens += entry.outputTokens
      current.cacheReadTokens += entry.cacheReadTokens
      current.totalTokens += entry.totalTokens

      map.set(modelKey, current)
    }

    return Array.from(map.values()).sort((a, b) => b.totalTokens - a.totalTokens)
  }

  async aggregateMessagesByDay(options?: {
    agentId?: string
    since?: number
    until?: number
  }): Promise<UsageBreakdownRow[]> {
    const entries = await this.readAllMessageEntries(options?.agentId)
    const map = new Map<string, UsageBreakdownRow>()

    for (const entry of entries) {
      if (options?.since && entry.timestamp < options.since) continue
      if (options?.until && entry.timestamp > options.until) continue

      const dayKey = formatDayKey(entry.timestamp)
      const current = map.get(dayKey) ?? {
        key: dayKey,
        label: dayKey,
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        totalTokens: 0,
      }

      current.inputTokens += entry.inputTokens
      current.outputTokens += entry.outputTokens
      current.cacheReadTokens += entry.cacheReadTokens
      current.totalTokens += entry.totalTokens

      map.set(dayKey, current)
    }

    return Array.from(map.values()).sort((a, b) => b.key.localeCompare(a.key))
  }

  private async readAllMessageEntries(agentId?: string): Promise<MessageUsageEntry[]> {
    const sessionFiles = await this.listSessionFiles(agentId)
    const entries: MessageUsageEntry[] = []

    for (const file of sessionFiles) {
      try {
        const messages = await this.parseSessionMessages(file)
        entries.push(...messages)
      } catch {
        continue
      }
    }

    return entries
  }

  private async listSessionFiles(agentId?: string): Promise<SessionFileInfo[]> {
    const results: SessionFileInfo[] = []

    try {
      const agentDirs = agentId ? [agentId] : await fs.readdir(this.agentsDir)

      for (const id of agentDirs) {
        const sessionsDir = path.join(this.agentsDir, id, 'sessions')
        try {
          const files = await fs.readdir(sessionsDir)
          for (const file of files) {
            if (!file.endsWith('.jsonl')) continue
            const filePath = path.join(sessionsDir, file)
            const stat = await fs.stat(filePath)
            results.push({
              agentId: id,
              sessionId: path.parse(file).name,
              filePath,
              mtime: stat.mtimeMs,
            })
          }
        } catch {
          continue
        }
      }
    } catch {
      return []
    }

    return results.sort((a, b) => b.mtime - a.mtime)
  }

  private async parseSessionFile(file: SessionFileInfo): Promise<SessionUsageSummary> {
    const content = await fs.readFile(file.filePath, 'utf-8')
    const lines = content.split('\n').filter((line) => line.trim())

    let inputTokens = 0
    let outputTokens = 0
    let totalTokens = 0
    let costCny = 0
    let entries = 0
    let sessionKey: string | undefined
    let model: string | undefined
    let startedAt: number | undefined
    let updatedAt = file.mtime

    for (const line of lines) {
      let parsed: Record<string, unknown>
      try {
        parsed = JSON.parse(line) as Record<string, unknown>
      } catch {
        continue
      }

      entries += 1

      const ts = parseTimestamp(parsed.timestamp ?? parsed.time ?? parsed.ts ?? parsed.createdAt)
      if (ts) {
        if (!startedAt || ts < startedAt) startedAt = ts
        if (ts > updatedAt) updatedAt = ts
      }

      const maybeSessionKey = getString(parsed.sessionKey ?? parsed.session)
      if (!sessionKey && maybeSessionKey) sessionKey = maybeSessionKey

      const messageBlock = parsed.message && typeof parsed.message === 'object'
        ? parsed.message as Record<string, unknown>
        : undefined

      const maybeModel = getString(
        messageBlock?.model ??
        parsed.model ??
        (parsed.meta as Record<string, unknown> | undefined)?.model
      )
      if (!model && maybeModel) model = maybeModel

      if (!model && parsed.type === 'custom' && parsed.customType === 'model-snapshot') {
        const data = parsed.data && typeof parsed.data === 'object' ? parsed.data as Record<string, unknown> : undefined
        const snapshotModel = getString(data?.modelId ?? data?.model ?? data?.model_id)
        if (snapshotModel) model = snapshotModel
      }

      const usage = extractUsage(parsed)
      if (!usage) continue

      if (typeof usage.inputTokens === 'number') inputTokens += usage.inputTokens
      if (typeof usage.outputTokens === 'number') outputTokens += usage.outputTokens
      if (typeof usage.totalTokens === 'number') totalTokens += usage.totalTokens
      if (typeof usage.costCny === 'number') costCny += usage.costCny
      if (typeof usage.cacheReadTokens === 'number' && costCny === 0) {
        const estimated = estimateCostCny(
          model,
          usage.inputTokens ?? 0,
          usage.outputTokens ?? 0,
          usage.cacheReadTokens,
        )
        if (estimated > 0) costCny += estimated
      }
    }

    if (totalTokens === 0) {
      totalTokens = inputTokens + outputTokens
    }

    return {
      agentId: file.agentId,
      sessionId: file.sessionId,
      sessionKey,
      model,
      startedAt,
      updatedAt,
      inputTokens,
      outputTokens,
      totalTokens,
      costCny,
      entries,
    }
  }

  private async parseSessionMessages(file: SessionFileInfo): Promise<MessageUsageEntry[]> {
    const content = await fs.readFile(file.filePath, 'utf-8')
    const lines = content.split('\n').filter((line) => line.trim())

    const entries: MessageUsageEntry[] = []
    let sessionKey: string | undefined
    let modelFallback: string | undefined

    for (const line of lines) {
      let parsed: Record<string, unknown>
      try {
        parsed = JSON.parse(line) as Record<string, unknown>
      } catch {
        continue
      }

      const maybeSessionKey = getString(parsed.sessionKey ?? parsed.session)
      if (!sessionKey && maybeSessionKey) sessionKey = maybeSessionKey

      const messageBlock = parsed.message && typeof parsed.message === 'object'
        ? parsed.message as Record<string, unknown>
        : undefined

      if (parsed.type === 'custom' && parsed.customType === 'model-snapshot') {
        const data = parsed.data && typeof parsed.data === 'object' ? parsed.data as Record<string, unknown> : undefined
        const snapshotModel = getString(data?.modelId ?? data?.model ?? data?.model_id)
        if (snapshotModel) modelFallback = snapshotModel
      }

      const usage = extractUsage(parsed)
      if (!usage) continue

      const model = getString(messageBlock?.model ?? parsed.model) ?? modelFallback
      const timestamp =
        parseTimestamp(parsed.timestamp ?? parsed.time ?? parsed.ts ?? parsed.createdAt) ?? file.mtime
      const role = getString(messageBlock?.role)
      const messageId = getString(parsed.id)
      const textPreview = extractPreview(messageBlock?.content)

      const inputTokens = usage.inputTokens ?? 0
      const outputTokens = usage.outputTokens ?? 0
      const totalTokens = usage.totalTokens ?? inputTokens + outputTokens
      const cacheReadTokens = usage.cacheReadTokens ?? 0

      let costCny = usage.costCny ?? 0
      if (costCny === 0 && typeof usage.cacheReadTokens === 'number') {
        costCny = estimateCostCny(model, inputTokens, outputTokens, cacheReadTokens)
      }

      entries.push({
        agentId: file.agentId,
        sessionId: file.sessionId,
        sessionKey,
        messageId,
        role,
        model,
        timestamp,
        inputTokens,
        outputTokens,
        totalTokens,
        cacheReadTokens,
        costCny,
        textPreview,
      })
    }

    return entries
  }
}

function getString(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value
  return undefined
}

function getNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const num = Number.parseFloat(value)
    return Number.isFinite(num) ? num : undefined
  }
  return undefined
}

function parseTimestamp(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value > 1_000_000_000_000) return value
    if (value > 1_000_000_000) return value * 1000
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value)
    if (!Number.isNaN(parsed)) return parsed
  }
  return undefined
}

function extractUsage(line: Record<string, unknown>): UsageDelta | null {
  const directUsage = line.usage && typeof line.usage === 'object' ? line.usage as Record<string, unknown> : undefined
  const messageBlock = line.message && typeof line.message === 'object' ? line.message as Record<string, unknown> : undefined
  const nestedUsage = messageBlock?.usage && typeof messageBlock.usage === 'object' ? messageBlock.usage as Record<string, unknown> : undefined
  const usage = directUsage ?? nestedUsage

  const costBlock =
    (line.cost && typeof line.cost === 'object' ? line.cost as Record<string, unknown> : undefined) ??
    (messageBlock?.cost && typeof messageBlock.cost === 'object' ? messageBlock.cost as Record<string, unknown> : undefined) ??
    (usage?.cost && typeof usage.cost === 'object' ? usage.cost as Record<string, unknown> : undefined)

  const inputTokens = getNumber(
    usage?.input_tokens ?? usage?.prompt_tokens ?? usage?.input ?? usage?.promptTokens ?? usage?.inputTokens
  )
  const outputTokens = getNumber(
    usage?.output_tokens ?? usage?.completion_tokens ?? usage?.output ?? usage?.completionTokens ?? usage?.outputTokens
  )
  const totalTokens = getNumber(
    usage?.total_tokens ?? usage?.total ?? usage?.tokens ?? usage?.totalTokens ?? usage?.total_tokens
  )

  const cacheReadTokens = getNumber(
    usage?.cacheRead ?? usage?.cache_read ?? usage?.cache_hit ?? usage?.cacheHit ?? usage?.cacheReadTokens
  )

  const costCny = getNumber(
    usage?.cost ?? usage?.total_cost ?? usage?.totalCost ?? usage?.cost_usd ?? usage?.usd ?? usage?.costUsd ??
    costBlock?.total ?? costBlock?.usd ?? costBlock?.totalUsd ?? costBlock?.amount
  )

  if (
    typeof inputTokens === 'number' ||
    typeof outputTokens === 'number' ||
    typeof totalTokens === 'number' ||
    typeof costCny === 'number' ||
    typeof cacheReadTokens === 'number'
  ) {
    return { inputTokens, outputTokens, totalTokens, costCny, cacheReadTokens }
  }

  return null
}

const PRICING_CNY_PER_1M: Record<string, { cachedInput: number; input: number; output: number }> = {
  'kimi-k2.5': { cachedInput: 0.7, input: 4.0, output: 21.0 },
}

function estimateCostCny(
  model: string | undefined,
  inputTokens: number,
  outputTokens: number,
  cacheReadTokens: number,
): number {
  if (!model) return 0
  const pricing = PRICING_CNY_PER_1M[model]
  if (!pricing) return 0
  const cached = Math.max(cacheReadTokens, 0)
  const uncached = Math.max(inputTokens, 0)
  const output = Math.max(outputTokens, 0)
  return (
    (cached / 1_000_000) * pricing.cachedInput +
    (uncached / 1_000_000) * pricing.input +
    (output / 1_000_000) * pricing.output
  )
}

function extractPreview(content: unknown): string | undefined {
  if (!content) return undefined
  if (typeof content === 'string') return content.slice(0, 120)
  if (Array.isArray(content)) {
    const text = content
      .map((item) => (typeof item === 'object' && item ? (item as { text?: unknown }).text : undefined))
      .filter((value) => typeof value === 'string' && value.trim())
      .join(' ')
    return text ? text.slice(0, 120) : undefined
  }
  return undefined
}

function formatDayKey(timestamp: number): string {
  const date = new Date(timestamp)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
