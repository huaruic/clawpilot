import React, { useEffect, useMemo, useState } from 'react'
import type { MessageUsageEntry, MessageUsagePage, UsageBreakdownRow } from '../api/ipc'

const PAGE_SIZE = 10

export function UsagePage(): React.ReactElement {
  const [messages, setMessages] = useState<MessageUsageEntry[]>([])
  const [totalMessages, setTotalMessages] = useState(0)
  const [breakdown, setBreakdown] = useState<UsageBreakdownRow[]>([])
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [timeWindow, setTimeWindow] = useState<'7d' | '30d' | 'all'>('30d')
  const [dimension, setDimension] = useState<'model' | 'day'>('model')

  useEffect(() => {
    setPage(1)
  }, [timeWindow, dimension])

  useEffect(() => {
    void load()
  }, [page, timeWindow, dimension])

  async function load(): Promise<void> {
    setLoading(true)
    setErrorMessage(null)
    try {
      const since = resolveSince(timeWindow)
      const offset = (page - 1) * PAGE_SIZE

      const [messagePage, breakdownRows] = await Promise.all([
        window.clawpilot.usage.listMessages({
          limit: PAGE_SIZE,
          offset,
          since,
        }) as Promise<MessageUsagePage>,
        dimension === 'model'
          ? window.clawpilot.usage.breakdownByModel({ since })
          : window.clawpilot.usage.breakdownByDay({ since }),
      ])

      setMessages(messagePage.items)
      setTotalMessages(messagePage.total)
      setBreakdown(breakdownRows)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setLoading(false)
    }
  }

  const totals = useMemo(() => {
    return messages.reduce(
      (acc, item) => {
        acc.totalTokens += item.totalTokens
        acc.totalCost += item.costCny
        acc.messageCount += 1
        return acc
      },
      { totalTokens: 0, totalCost: 0, messageCount: 0 },
    )
  }, [messages])

  const maxBreakdownTotal = useMemo(() => {
    return breakdown.reduce((max, row) => Math.max(max, row.totalTokens), 0)
  }, [breakdown])

  const totalPages = Math.max(1, Math.ceil(totalMessages / PAGE_SIZE))

  const formatNumber = (value: number): string => value.toLocaleString()

  const formatCost = (value: number): string => {
    if (!value) return '¥0.0000'
    return `¥${value.toFixed(4)}`
  }

  const timeWindowLabel: Record<'7d' | '30d' | 'all', string> = {
    '7d': '近 7 天',
    '30d': '近 30 天',
    all: '全部',
  }

  return (
    <div className="flex flex-col h-full p-6 gap-4 overflow-hidden">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Token / Cost</h1>
          <p className="text-sm text-zinc-500 mt-0.5">按每次输入/回复统计用量与成本</p>
        </div>
        <button
          onClick={() => { void load() }}
          disabled={loading}
          className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-900 disabled:text-zinc-500 text-white rounded-md text-sm"
        >
          {loading ? '刷新中...' : '刷新'}
        </button>
      </div>

      {errorMessage && (
        <div className="p-3 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 text-sm">
          {errorMessage}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-4 rounded-lg border border-zinc-800 bg-zinc-900/60">
          <div className="text-xs text-zinc-500">当前页 Tokens</div>
          <div className="text-2xl font-semibold text-white mt-1">{formatNumber(totals.totalTokens)}</div>
        </div>
        <div className="p-4 rounded-lg border border-zinc-800 bg-zinc-900/60">
          <div className="text-xs text-zinc-500">当前页成本（估算）</div>
          <div className="text-2xl font-semibold text-white mt-1">{formatCost(totals.totalCost)}</div>
        </div>
        <div className="p-4 rounded-lg border border-zinc-800 bg-zinc-900/60">
          <div className="text-xs text-zinc-500">当前页消息数</div>
          <div className="text-2xl font-semibold text-white mt-1">{formatNumber(totals.messageCount)}</div>
        </div>
      </div>

      <div className="border border-zinc-800 rounded-lg bg-zinc-900/60 overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between gap-3 overflow-x-auto">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-white whitespace-nowrap">用量分布</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setDimension('model')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors whitespace-nowrap ${
                  dimension === 'model'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-transparent text-zinc-400 border-zinc-700 hover:text-white'
                }`}
              >
                按模型
              </button>
              <button
                onClick={() => setDimension('day')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors whitespace-nowrap ${
                  dimension === 'day'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-transparent text-zinc-400 border-zinc-700 hover:text-white'
                }`}
              >
                按天
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(Object.keys(timeWindowLabel) as Array<'7d' | '30d' | 'all'>).map((key) => (
              <button
                key={key}
                onClick={() => setTimeWindow(key)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors whitespace-nowrap ${
                  timeWindow === key
                    ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                    : 'bg-transparent text-zinc-400 border-zinc-700 hover:text-white'
                }`}
              >
                {timeWindowLabel[key]}
              </button>
            ))}
          </div>
        </div>

        {loading && (
          <div className="p-6 text-sm text-zinc-500">加载中...</div>
        )}
        {!loading && breakdown.length === 0 && (
          <div className="p-6 text-sm text-zinc-500">暂无用量数据</div>
        )}
        {!loading && breakdown.length > 0 && (
          <div className="divide-y divide-zinc-800">
            {breakdown.map((row) => (
              <div key={row.key} className="px-4 py-3 flex items-center gap-4">
                <div className="w-40 text-sm text-zinc-200 truncate">{row.label}</div>
                <div className="flex-1">
                  <div className="h-3 rounded-full bg-zinc-800 overflow-hidden">
                    <div className="flex h-full">
                      <div
                        className="bg-sky-500"
                        style={{ width: `${percentage(row.inputTokens, row.totalTokens, maxBreakdownTotal)}%` }}
                      />
                      <div
                        className="bg-emerald-500"
                        style={{ width: `${percentage(row.outputTokens, row.totalTokens, maxBreakdownTotal)}%` }}
                      />
                      <div
                        className="bg-amber-500"
                        style={{ width: `${percentage(row.cacheReadTokens, row.totalTokens, maxBreakdownTotal)}%` }}
                      />
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-zinc-400">
                    <span className="text-sky-300">输入 {formatNumber(row.inputTokens)}</span>
                    <span className="text-emerald-300">输出 {formatNumber(row.outputTokens)}</span>
                    <span className="text-amber-300">缓存 {formatNumber(row.cacheReadTokens)}</span>
                  </div>
                </div>
                <div className="w-28 text-right text-sm text-white">{formatNumber(row.totalTokens)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto border border-zinc-800 rounded-lg bg-zinc-900/60">
        {loading && (
          <div className="p-6 text-sm text-zinc-500">加载中...</div>
        )}
        {!loading && messages.length === 0 && (
          <div className="p-6 text-sm text-zinc-500">暂无消息级用量数据</div>
        )}
        {!loading && messages.length > 0 && (
          <table className="w-full text-sm">
            <thead className="text-xs text-zinc-500 uppercase">
              <tr className="border-b border-zinc-800">
                <th className="text-left px-4 py-3">Session</th>
                <th className="text-left px-4 py-3">Role</th>
                <th className="text-left px-4 py-3">Model</th>
                <th className="text-right px-4 py-3">Input</th>
                <th className="text-right px-4 py-3">Output</th>
                <th className="text-right px-4 py-3">Cache</th>
                <th className="text-right px-4 py-3">Total</th>
                <th className="text-right px-4 py-3">Cost</th>
                <th className="text-right px-4 py-3">Time</th>
              </tr>
            </thead>
            <tbody>
              {messages.map((item) => (
                <tr key={`${item.sessionId}-${item.messageId ?? item.timestamp}`} className="border-b border-zinc-800 last:border-b-0">
                  <td className="px-4 py-3 text-zinc-200">
                    <div className="font-medium">{item.sessionKey ?? item.sessionId}</div>
                    {item.textPreview && (
                      <div className="text-xs text-zinc-500 mt-1">{item.textPreview}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-300">{item.role ?? '-'}</td>
                  <td className="px-4 py-3 text-zinc-300">{item.model ?? 'unknown'}</td>
                  <td className="px-4 py-3 text-right text-zinc-200">{formatNumber(item.inputTokens)}</td>
                  <td className="px-4 py-3 text-right text-zinc-200">{formatNumber(item.outputTokens)}</td>
                  <td className="px-4 py-3 text-right text-zinc-200">{formatNumber(item.cacheReadTokens)}</td>
                  <td className="px-4 py-3 text-right text-zinc-200">{formatNumber(item.totalTokens)}</td>
                  <td className="px-4 py-3 text-right text-zinc-200">{formatCost(item.costCny)}</td>
                  <td className="px-4 py-3 text-right text-zinc-500">{new Date(item.timestamp).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex items-center justify-between text-sm text-zinc-400">
        <div>共 {formatNumber(totalMessages)} 条消息</div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={page <= 1}
            className="px-3 py-1.5 rounded-md border border-zinc-700 disabled:opacity-40"
          >
            上一页
          </button>
          <span className="text-xs">{page} / {totalPages}</span>
          <button
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={page >= totalPages}
            className="px-3 py-1.5 rounded-md border border-zinc-700 disabled:opacity-40"
          >
            下一页
          </button>
        </div>
      </div>
    </div>
  )
}

function resolveSince(windowKey: '7d' | '30d' | 'all'): number | undefined {
  const now = Date.now()
  switch (windowKey) {
    case '7d':
      return now - 7 * 24 * 60 * 60 * 1000
    case '30d':
      return now - 30 * 24 * 60 * 60 * 1000
    default:
      return undefined
  }
}

function percentage(value: number, total: number, maxTotal: number): number {
  if (!maxTotal) return 0
  const base = total > 0 ? total : maxTotal
  return Math.max(0, Math.min(100, (value / base) * 100))
}
