/**
 * UsageStore — persists token usage data from OpenClaw gateway RPCs.
 *
 * Data sources:
 *   - `usage.cost`      → daily token totals (input/output/cache/total)
 *   - `sessions.usage`  → per-session usage with dailyModelUsage, latency, etc.
 *
 * Stored in electron-store so data survives session deletion and app restarts.
 */

import { app } from 'electron'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { mainLogger } from '../utils/logger'

// ── Types ────────────────────────────────────────────────────────

export interface DailyTokenRecord {
  date: string // "YYYY-MM-DD"
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
  id: string             // unique: sessionKey + timestamp
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

const DEFAULT_DATA: UsageStoreData = {
  schemaVersion: 1,
  lastSyncAt: 0,
  dailyTotals: [],
  sessions: [],
  runs: [],
}

// ── Store ────────────────────────────────────────────────────────

function getStorePath(): string {
  return join(app.getPath('userData'), 'catclaw-usage.json')
}

async function readStore(): Promise<UsageStoreData> {
  try {
    const raw = await readFile(getStorePath(), 'utf-8')
    const parsed = JSON.parse(raw) as Partial<UsageStoreData>
    if (parsed.schemaVersion !== 1) return DEFAULT_DATA
    return {
      schemaVersion: 1,
      lastSyncAt: typeof parsed.lastSyncAt === 'number' ? parsed.lastSyncAt : 0,
      dailyTotals: Array.isArray(parsed.dailyTotals) ? parsed.dailyTotals : [],
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      runs: Array.isArray(parsed.runs) ? parsed.runs : [],
    }
  } catch {
    return DEFAULT_DATA
  }
}

async function writeStore(data: UsageStoreData): Promise<void> {
  const path = getStorePath()
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, JSON.stringify(data, null, 2), 'utf-8')
}

// ── Public API ───────────────────────────────────────────────────

/**
 * Sync usage data from `usage.cost` RPC response.
 */
export async function syncDailyTotals(costResponse: unknown): Promise<void> {
  const resp = costResponse as { daily?: unknown[]; totals?: unknown }
  if (!resp || !Array.isArray(resp.daily)) return

  const records: DailyTokenRecord[] = resp.daily.map((d: unknown) => {
    const r = d as Record<string, unknown>
    return {
      date: String(r.date ?? ''),
      input: num(r.input),
      output: num(r.output),
      cacheRead: num(r.cacheRead),
      cacheWrite: num(r.cacheWrite),
      totalTokens: num(r.totalTokens),
    }
  }).filter((r) => r.date && r.totalTokens > 0)

  const store = await readStore()

  // Merge: replace existing dates, append new ones
  const byDate = new Map(store.dailyTotals.map((d) => [d.date, d]))
  for (const r of records) {
    byDate.set(r.date, r)
  }
  store.dailyTotals = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date))
  store.lastSyncAt = Date.now()

  await writeStore(store)
  mainLogger.info(`[UsageStore] synced ${records.length} daily totals`)
}

/**
 * Sync usage data from `sessions.usage` RPC response.
 */
export async function syncSessionUsage(sessionsResponse: unknown): Promise<void> {
  const resp = sessionsResponse as { sessions?: unknown[] }
  if (!resp || !Array.isArray(resp.sessions)) return

  const snapshots: SessionUsageSnapshot[] = resp.sessions.map((s: unknown) => {
    const sess = s as Record<string, unknown>
    const usage = (sess.usage ?? {}) as Record<string, unknown>
    const messageCounts = (usage.messageCounts ?? {}) as Record<string, unknown>
    const modelUsage = Array.isArray(usage.modelUsage) ? usage.modelUsage : []

    // Compute totals from modelUsage
    let totalInput = 0, totalOutput = 0, totalCache = 0, totalTokens = 0
    for (const mu of modelUsage) {
      const totals = ((mu as Record<string, unknown>).totals ?? {}) as Record<string, unknown>
      totalInput += num(totals.input)
      totalOutput += num(totals.output)
      totalCache += num(totals.cacheRead)
      totalTokens += num(totals.totalTokens)
    }

    // Derive model/provider from modelUsage if top-level fields are empty
    let derivedModel = String(sess.model ?? '')
    let derivedProvider = String(sess.modelProvider ?? '')
    if ((!derivedModel || !derivedProvider) && modelUsage.length > 0) {
      // Pick the model with the highest token count
      let best = modelUsage[0] as Record<string, unknown>
      for (const mu of modelUsage) {
        const muR = mu as Record<string, unknown>
        const muTotals = (muR.totals ?? {}) as Record<string, unknown>
        const bestTotals = (best.totals ?? {}) as Record<string, unknown>
        if (num(muTotals.totalTokens) > num(bestTotals.totalTokens)) best = muR
      }
      if (!derivedModel) derivedModel = String(best.model ?? '')
      if (!derivedProvider) derivedProvider = String(best.provider ?? '')
    }

    const origin = (sess.origin ?? {}) as Record<string, unknown>

    return {
      sessionKey: String(sess.key ?? ''),
      sessionId: String(usage.sessionId ?? sess.sessionId ?? ''),
      agentId: String(sess.agentId ?? ''),
      channel: String(sess.channel ?? origin.surface ?? 'unknown'),
      modelProvider: derivedProvider,
      model: derivedModel,
      firstActivity: num(usage.firstActivity),
      lastActivity: num(usage.lastActivity),
      totalTokens,
      inputTokens: totalInput,
      outputTokens: totalOutput,
      cacheReadTokens: totalCache,
      messageCount: num(messageCounts.total),
      userMessages: num(messageCounts.user),
      assistantMessages: num(messageCounts.assistant),
      toolCalls: num(messageCounts.toolCalls),
      dailyModelUsage: Array.isArray(usage.dailyModelUsage)
        ? (usage.dailyModelUsage as Record<string, unknown>[]).map((d) => ({
            date: String(d.date ?? ''),
            provider: String(d.provider ?? ''),
            model: String(d.model ?? ''),
            tokens: num(d.tokens),
            count: num(d.count),
          }))
        : [],
      dailyLatency: Array.isArray(usage.dailyLatency)
        ? (usage.dailyLatency as Record<string, unknown>[]).map((d) => ({
            date: String(d.date ?? ''),
            count: num(d.count),
            avgMs: num(d.avgMs),
            p95Ms: num(d.p95Ms),
            minMs: num(d.minMs),
            maxMs: num(d.maxMs),
          }))
        : [],
    }
  }).filter((s) => s.sessionKey)

  const store = await readStore()

  // Merge by sessionKey
  const byKey = new Map(store.sessions.map((s) => [s.sessionKey, s]))
  for (const snap of snapshots) {
    byKey.set(snap.sessionKey, snap)
  }
  store.sessions = Array.from(byKey.values()).sort((a, b) => b.lastActivity - a.lastActivity)
  store.lastSyncAt = Date.now()

  await writeStore(store)
  mainLogger.info(`[UsageStore] synced ${snapshots.length} sessions`)
}

/**
 * Sync usage data from `sessions.list` RPC response.
 * This is the primary data source — unconditionally updates all sessions.
 */
export async function syncFromSessionsList(sessionsListResponse: unknown): Promise<void> {
  const resp = sessionsListResponse as { sessions?: unknown[] }
  const sessions = Array.isArray(resp?.sessions) ? resp.sessions : Array.isArray(resp) ? resp : []

  mainLogger.info(`[UsageStore] sessions.list: received ${sessions.length} sessions`)
  if (sessions.length === 0) return

  const store = await readStore()
  const existing = new Map(store.sessions.map((s) => [s.sessionKey, s]))

  for (const raw of sessions) {
    const s = raw as Record<string, unknown>
    const key = String(s.key ?? '')
    if (!key) continue

    const totalTokens = num(s.totalTokens)
    const updatedAt = num(s.updatedAt)
    const startedAt = num(s.startedAt)
    const runtimeMs = num(s.runtimeMs)
    const model = String(s.model ?? '')
    const modelProvider = String(s.modelProvider ?? '')
    const origin = (s.origin ?? {}) as Record<string, unknown>
    const channel = String(s.lastChannel ?? origin.surface ?? 'unknown')
    const dateStr = updatedAt ? new Date(updatedAt).toISOString().slice(0, 10) : ''

    const prev = existing.get(key)
    const inputTokens = num(s.inputTokens)
    const outputTokens = num(s.outputTokens)

    // Record a new run if this session's updatedAt changed (means a new run completed)
    if (prev && updatedAt > prev.lastActivity && (inputTokens > 0 || outputTokens > 0)) {
      const runId = `${key}:${updatedAt}`
      // Avoid duplicates
      if (!store.runs.some((r) => r.id === runId)) {
        store.runs.push({
          id: runId,
          sessionKey: key,
          timestamp: updatedAt,
          model: model || prev.model,
          modelProvider: modelProvider || prev.modelProvider,
          inputTokens,
          outputTokens,
          runtimeMs,
          channel: channel !== 'unknown' ? channel : prev.channel,
        })
      }
    }

    if (prev) {
      // Unconditionally update session data
      prev.totalTokens = totalTokens
      prev.inputTokens = inputTokens
      prev.outputTokens = outputTokens
      prev.lastActivity = updatedAt || prev.lastActivity
      if (model) prev.model = model
      if (modelProvider) prev.modelProvider = modelProvider
      if (channel !== 'unknown') prev.channel = channel
      existing.set(key, prev)
    } else {
      // Record run for new session too
      if (inputTokens > 0 || outputTokens > 0) {
        const runId = `${key}:${updatedAt}`
        if (!store.runs.some((r) => r.id === runId)) {
          store.runs.push({
            id: runId,
            sessionKey: key,
            timestamp: updatedAt,
            model,
            modelProvider,
            inputTokens,
            outputTokens,
            runtimeMs,
            channel,
          })
        }
      }
      // New session
      existing.set(key, {
        sessionKey: key,
        sessionId: String(s.sessionId ?? ''),
        agentId: key.split(':')[1] ?? '',
        channel,
        modelProvider,
        model,
        firstActivity: startedAt || updatedAt,
        lastActivity: updatedAt,
        totalTokens,
        inputTokens: num(s.inputTokens),
        outputTokens: num(s.outputTokens),
        cacheReadTokens: 0,
        messageCount: 0,
        userMessages: 0,
        assistantMessages: 0,
        toolCalls: 0,
        dailyModelUsage: dateStr && modelProvider ? [{
          date: dateStr, provider: modelProvider, model, tokens: totalTokens, count: 1,
        }] : [],
        dailyLatency: dateStr && runtimeMs ? [{
          date: dateStr, count: 1, avgMs: runtimeMs, p95Ms: runtimeMs, minMs: runtimeMs, maxMs: runtimeMs,
        }] : [],
      })
    }
  }

  // Always write
  store.sessions = Array.from(existing.values()).sort((a, b) => b.lastActivity - a.lastActivity)
  store.runs.sort((a, b) => b.timestamp - a.timestamp)
  // Keep last 500 runs to avoid unbounded growth
  if (store.runs.length > 500) store.runs = store.runs.slice(0, 500)
  store.lastSyncAt = Date.now()
  await writeStore(store)
  mainLogger.info(`[UsageStore] sessions.list: ${existing.size} sessions, ${store.runs.length} runs`)
}

/**
 * Get all stored data for dashboard rendering.
 */
export async function getUsageData(opts?: { since?: number }): Promise<UsageStoreData> {
  const store = await readStore()

  if (opts?.since) {
    const sinceDate = new Date(opts.since).toISOString().slice(0, 10)
    store.dailyTotals = store.dailyTotals.filter((d) => d.date >= sinceDate)
    store.sessions = store.sessions.filter((s) => s.lastActivity >= opts.since!)
    store.runs = store.runs.filter((r) => r.timestamp >= opts.since!)
  }

  return store
}

/**
 * Get the last sync timestamp.
 */
export async function getLastSyncAt(): Promise<number> {
  const store = await readStore()
  return store.lastSyncAt
}

// ── Helpers ──────────────────────────────────────────────────────

function num(v: unknown): number {
  return typeof v === 'number' && isFinite(v) ? v : 0
}
