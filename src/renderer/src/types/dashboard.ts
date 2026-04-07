// ── Types mirroring UsageStore data ──────────────────────────────

export interface DailyTokenRecord {
  date: string
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
  totalTokens: number
}

export interface DailyModelRecord {
  date: string
  provider: string
  model: string
  tokens: number
  count: number
}

export interface DailyLatencyRecord {
  date: string
  count: number
  avgMs: number
  p95Ms: number
  minMs: number
  maxMs: number
}

export interface SessionUsageSnapshot {
  sessionKey: string
  sessionId: string
  agentId: string
  channel: string
  modelProvider: string
  model: string
  firstActivity: number
  lastActivity: number
  totalTokens: number
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  messageCount: number
  userMessages: number
  assistantMessages: number
  toolCalls: number
  dailyModelUsage: DailyModelRecord[]
  dailyLatency: DailyLatencyRecord[]
}

export interface RunRecord {
  id: string
  sessionKey: string
  timestamp: number
  model: string
  modelProvider: string
  inputTokens: number
  outputTokens: number
  runtimeMs: number
  channel: string
}

export interface UsageStoreData {
  schemaVersion: number
  lastSyncAt: number
  dailyTotals: DailyTokenRecord[]
  sessions: SessionUsageSnapshot[]
  runs: RunRecord[]
}

// ── Dashboard computed types ─────────────────────────────────────

export type TimeRange = 'today' | '7d' | '30d' | 'all'

export interface DashboardStats {
  totalTokens: number
  totalSessions: number
  avgLatencyMs: number
  tokensDelta: number | null
  sessionsDelta: number | null
  latencyDelta: number | null
}

export interface TrendPoint {
  date: string
  [provider: string]: number | string
}

export interface ModelSlice {
  model: string
  totalTokens: number
  percentage: number
}

export interface DashboardData {
  loading: boolean
  stats: DashboardStats
  trendData: TrendPoint[]
  modelDistribution: ModelSlice[]
  recentRuns: RunRecord[]
  providers: string[]
}
