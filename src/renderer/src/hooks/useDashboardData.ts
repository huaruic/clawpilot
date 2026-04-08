import { useState, useEffect, useCallback, useMemo } from 'react'
import type {
  TimeRange,
  DashboardStats,
  TrendPoint,
  ModelSlice,
  SessionUsageSnapshot,
  RunRecord,
  DashboardData,
} from '../types/dashboard'

function getRangeSince(range: TimeRange): number | undefined {
  const now = Date.now()
  const dayMs = 86_400_000
  switch (range) {
    case 'today': {
      const d = new Date()
      d.setHours(0, 0, 0, 0)
      return d.getTime()
    }
    case '7d':
      return now - 7 * dayMs
    case '30d':
      return now - 30 * dayMs
    case 'all':
      return undefined
  }
}

function getPreviousPeriodSince(range: TimeRange): { since: number; until: number } | null {
  const now = Date.now()
  const dayMs = 86_400_000
  switch (range) {
    case 'today': {
      const d = new Date()
      d.setHours(0, 0, 0, 0)
      return { since: d.getTime() - dayMs, until: d.getTime() }
    }
    case '7d':
      return { since: now - 14 * dayMs, until: now - 7 * dayMs }
    case '30d':
      return { since: now - 60 * dayMs, until: now - 30 * dayMs }
    case 'all':
      return null
  }
}

function computeStats(
  sessions: SessionUsageSnapshot[],
  previousSessions: SessionUsageSnapshot[],
): DashboardStats {
  const totalTokens = sessions.reduce((sum, s) => sum + s.totalTokens, 0)
  const totalSessions = sessions.length

  // Weighted average latency from dailyLatency
  let totalLatencyWeighted = 0
  let totalLatencyCount = 0
  for (const s of sessions) {
    for (const d of s.dailyLatency) {
      totalLatencyWeighted += d.avgMs * d.count
      totalLatencyCount += d.count
    }
  }
  const avgLatencyMs = totalLatencyCount > 0 ? totalLatencyWeighted / totalLatencyCount : 0

  // Previous period
  const prevTokens = previousSessions.reduce((sum, s) => sum + s.totalTokens, 0)
  const prevSessions = previousSessions.length
  let prevLatencyWeighted = 0
  let prevLatencyCount = 0
  for (const s of previousSessions) {
    for (const d of s.dailyLatency) {
      prevLatencyWeighted += d.avgMs * d.count
      prevLatencyCount += d.count
    }
  }
  const prevAvgLatency = prevLatencyCount > 0 ? prevLatencyWeighted / prevLatencyCount : 0

  const delta = (cur: number, prev: number): number | null => {
    if (prev === 0) return cur > 0 ? 100 : null
    return Math.round(((cur - prev) / prev) * 100)
  }

  return {
    totalTokens,
    totalSessions,
    avgLatencyMs,
    tokensDelta: previousSessions.length > 0 ? delta(totalTokens, prevTokens) : null,
    sessionsDelta: previousSessions.length > 0 ? delta(totalSessions, prevSessions) : null,
    latencyDelta: prevLatencyCount > 0 ? delta(avgLatencyMs, prevAvgLatency) : null,
  }
}

function buildTrendData(sessions: SessionUsageSnapshot[]): { data: TrendPoint[]; providers: string[] } {
  // Aggregate dailyModelUsage across all sessions by date+provider
  const providerSet = new Set<string>()
  const byDate = new Map<string, Map<string, number>>()

  for (const s of sessions) {
    for (const dm of s.dailyModelUsage) {
      providerSet.add(dm.provider)
      if (!byDate.has(dm.date)) byDate.set(dm.date, new Map())
      const dateMap = byDate.get(dm.date)!
      dateMap.set(dm.provider, (dateMap.get(dm.provider) ?? 0) + dm.tokens)
    }
  }

  const providers = Array.from(providerSet).sort()
  const dates = Array.from(byDate.keys()).sort()

  const data: TrendPoint[] = dates.map((date) => {
    const point: TrendPoint = { date: date.slice(5) } // "MM-DD"
    const dateMap = byDate.get(date)!
    for (const p of providers) {
      point[p] = dateMap.get(p) ?? 0
    }
    return point
  })

  return { data, providers }
}

function buildModelDistribution(sessions: SessionUsageSnapshot[]): ModelSlice[] {
  const byModel = new Map<string, number>()
  for (const s of sessions) {
    byModel.set(s.model, (byModel.get(s.model) ?? 0) + s.totalTokens)
  }

  const total = Array.from(byModel.values()).reduce((a, b) => a + b, 0)
  return Array.from(byModel.entries())
    .map(([model, tokens]) => ({
      model,
      totalTokens: tokens,
      percentage: total > 0 ? Math.round((tokens / total) * 100) : 0,
    }))
    .sort((a, b) => b.totalTokens - a.totalTokens)
}

export function useDashboardData(range: TimeRange): DashboardData {
  const [allSessions, setAllSessions] = useState<SessionUsageSnapshot[]>([])
  const [allRuns, setAllRuns] = useState<RunRecord[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const data = await window.catclaw.dashboard.getUsage()
      setAllSessions(data.sessions)
      setAllRuns(data.runs ?? [])
    } catch {
      // keep previous data
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // 1. Read cache immediately (instant)
    fetchData()

    // 2. Refresh from gateway in background, then update
    window.catclaw.dashboard.refresh()
      .then(() => fetchData())
      .catch(() => {})

    // 3. Listen for push updates from main process
    const unsub = window.catclaw.dashboard.onUpdated(() => fetchData())

    return () => unsub()
  }, [fetchData])

  return useMemo(() => {
    const since = getRangeSince(range)
    const filtered = since
      ? allSessions.filter((s) => s.lastActivity >= since)
      : allSessions

    // Previous period for comparison
    const prev = getPreviousPeriodSince(range)
    const previousSessions = prev
      ? allSessions.filter((s) => s.lastActivity >= prev.since && s.lastActivity < prev.until)
      : []

    const stats = computeStats(filtered, previousSessions)
    const { data: trendData, providers } = buildTrendData(filtered)
    const modelDistribution = buildModelDistribution(filtered)

    // Filter runs by time range
    const filteredRuns = since
      ? allRuns.filter((r) => r.timestamp >= since)
      : allRuns
    const recentRuns = filteredRuns.slice(0, 30) // already sorted desc by timestamp

    return {
      loading,
      stats,
      trendData,
      modelDistribution,
      recentRuns,
      providers,
    }
  }, [range, allSessions, allRuns, loading])
}

// ── Formatting helpers ───────────────────────────────────────────

export function formatTokenCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

export function formatLatency(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.round(ms)}ms`
}

export function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
