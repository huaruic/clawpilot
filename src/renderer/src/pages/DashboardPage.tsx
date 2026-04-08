import React, { useState } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { IconTrendUp, IconTrendDown } from '../components/icons'
import { useI18n } from '../i18n/I18nProvider'
import { useDashboardData, formatTokenCount, formatLatency, formatRelativeTime } from '../hooks/useDashboardData'
import type { TimeRange } from '../types/dashboard'

const PROVIDER_PALETTE = ['#3B82F6', '#10B981', '#F59E0B', '#6366F1', '#EC4899', '#14B8A6', '#F97316', '#8B5CF6']

interface StatCardProps {
  icon: React.ReactElement
  label: string
  value: string
  change: string | null
  positive: boolean | null
}

function StatCard({ icon, label, value, change, positive }: StatCardProps): React.ReactElement {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-2 flex items-center gap-2 text-muted-foreground">
        <span className="h-4 w-4">{icon}</span>
        <span className="text-xs">{label}</span>
      </div>
      <div className="text-2xl font-semibold text-foreground">{value}</div>
      {change !== null && positive !== null && (
        <div className={`mt-1 flex items-center gap-1 text-xs ${positive ? 'text-success' : 'text-destructive'}`}>
          {positive ? <IconTrendUp className="h-3 w-3" /> : <IconTrendDown className="h-3 w-3" />}
          {change}
        </div>
      )}
    </div>
  )
}

function ZapIcon(): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  )
}

function BarChartIcon(): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <line x1="12" y1="20" x2="12" y2="10" />
      <line x1="18" y1="20" x2="18" y2="4" />
      <line x1="6" y1="20" x2="6" y2="16" />
    </svg>
  )
}

function ClockIcon(): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

export function DashboardPage(): React.ReactElement {
  const { t } = useI18n()
  const [range, setRange] = useState<TimeRange>('7d')
  const { loading, stats, trendData, modelDistribution, recentRuns, providers } = useDashboardData(range)

  const ranges: { key: TimeRange; label: string }[] = [
    { key: 'today', label: t('app.dashboard.rangeToday') },
    { key: '7d', label: t('app.dashboard.range7d') },
    { key: '30d', label: t('app.dashboard.range30d') },
    { key: 'all', label: t('app.dashboard.rangeAll') },
  ]

  const formatDelta = (delta: number | null): { text: string | null; positive: boolean | null } => {
    if (delta === null) return { text: null, positive: null }
    const sign = delta >= 0 ? '+' : ''
    return {
      text: `${sign}${delta}% ${t('app.dashboard.vsPrev')}`,
      positive: delta >= 0,
    }
  }

  // Empty state
  if (!loading && recentRuns.length === 0 && trendData.length === 0) {
    return (
      <div className="cp-page flex max-w-6xl flex-col items-center justify-center gap-3 py-24">
        <ZapIcon />
        <h2 className="text-lg font-medium text-foreground">{t('app.dashboard.noData')}</h2>
        <p className="text-sm text-muted-foreground">{t('app.dashboard.noDataHint')}</p>
      </div>
    )
  }

  // Loading skeleton
  if (loading && recentRuns.length === 0) {
    return (
      <div className="cp-page max-w-6xl">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-foreground">{t('app.dashboard.title')}</h1>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl border border-border bg-card" />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2 h-72 animate-pulse rounded-xl border border-border bg-card" />
          <div className="h-72 animate-pulse rounded-xl border border-border bg-card" />
        </div>
      </div>
    )
  }

  const tokenDelta = formatDelta(stats.tokensDelta)
  const sessionDelta = formatDelta(stats.sessionsDelta)
  const latencyDelta = formatDelta(stats.latencyDelta)
  // For latency, lower is better, so invert the positive flag
  if (latencyDelta.positive !== null) latencyDelta.positive = !latencyDelta.positive

  return (
    <div className="cp-page max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-foreground">{t('app.dashboard.title')}</h1>
        <div className="flex gap-1">
          {ranges.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setRange(key)}
              className={`btn-active-scale ${`rounded-md px-3 py-1.5 text-xs transition-colors ${
                range === key
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent'
              }`}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          icon={<ZapIcon />}
          label={t('app.dashboard.totalTokens')}
          value={formatTokenCount(stats.totalTokens)}
          change={tokenDelta.text}
          positive={tokenDelta.positive}
        />
        <StatCard
          icon={<BarChartIcon />}
          label={t('app.dashboard.totalSessions')}
          value={String(stats.totalSessions)}
          change={sessionDelta.text}
          positive={sessionDelta.positive}
        />
        <StatCard
          icon={<ClockIcon />}
          label={t('app.dashboard.avgLatency')}
          value={stats.avgLatencyMs > 0 ? formatLatency(stats.avgLatencyMs) : '--'}
          change={latencyDelta.text}
          positive={latencyDelta.positive}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-3 gap-4">
        {/* Area chart — Token trend by provider */}
        <div className="col-span-2 rounded-xl border border-border bg-card p-4 card-hover">
          <h3 className="mb-4 text-sm font-medium text-foreground">{t('app.dashboard.tokenTrend')}</h3>
          {trendData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={trendData}>
                  <defs>
                    {providers.map((p, i) => (
                      <linearGradient key={p} id={`grad-${i}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={PROVIDER_PALETTE[i % PROVIDER_PALETTE.length]} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={PROVIDER_PALETTE[i % PROVIDER_PALETTE.length]} stopOpacity={0} />
                      </linearGradient>
                    ))}
                  </defs>
                  <XAxis
                    dataKey="date"
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => formatTokenCount(v)}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      background: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 8,
                      fontSize: 12,
                      color: 'hsl(var(--foreground))',
                    }}
                    formatter={(value: unknown) => formatTokenCount(Number(value))}
                  />
                  {providers.map((p, i) => (
                    <Area
                      key={p}
                      type="monotone"
                      dataKey={p}
                      stroke={PROVIDER_PALETTE[i % PROVIDER_PALETTE.length]}
                      fill={`url(#grad-${i})`}
                      strokeWidth={2}
                      name={p}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
              <div className="mt-2 flex gap-4">
                {providers.map((p, i) => (
                  <div key={p} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="h-2 w-2 rounded-full" style={{ background: PROVIDER_PALETTE[i % PROVIDER_PALETTE.length] }} />
                    {p}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex h-60 items-center justify-center text-sm text-muted-foreground">
              {t('app.dashboard.noData')}
            </div>
          )}
        </div>

        {/* Pie chart — Model distribution */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-4 text-sm font-medium text-foreground">{t('app.dashboard.modelDistribution')}</h3>
          {modelDistribution.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie
                    data={modelDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={65}
                    dataKey="totalTokens"
                    stroke="none"
                  >
                    {modelDistribution.map((_, i) => (
                      <Cell key={i} fill={PROVIDER_PALETTE[i % PROVIDER_PALETTE.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 space-y-2">
                {modelDistribution.map((d, i) => (
                  <div key={d.model} className="flex items-center text-xs">
                    <span className="mr-2 h-2 w-2 shrink-0 rounded-full" style={{ background: PROVIDER_PALETTE[i % PROVIDER_PALETTE.length] }} />
                    <span className="flex-1 truncate text-muted-foreground">{d.model}</span>
                    <span className="ml-2 font-medium text-foreground">{formatTokenCount(d.totalTokens)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
              {t('app.dashboard.noData')}
            </div>
          )}
        </div>
      </div>

      {/* Recent runs table */}
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="mb-3 text-sm font-medium text-foreground">{t('app.dashboard.recentSessions')}</h3>
        {recentRuns.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="py-2 text-left font-medium">{t('app.dashboard.colModel')}</th>
                  <th className="py-2 text-left font-medium">{t('app.dashboard.colTokens')}</th>
                  <th className="py-2 text-left font-medium">{t('app.dashboard.colLatency')}</th>
                  <th className="py-2 text-left font-medium">{t('app.dashboard.colChannel')}</th>
                  <th className="py-2 text-right font-medium">{t('app.dashboard.colTime')}</th>
                </tr>
              </thead>
              <tbody>
                {recentRuns.map((r) => (
                  <tr key={r.id} className="border-b border-border/50 transition-colors hover:bg-accent/50">
                    <td className="py-2 font-mono text-foreground">{r.model || '--'}</td>
                    <td className="py-2 text-muted-foreground">
                      {formatTokenCount(r.inputTokens)} / {formatTokenCount(r.outputTokens)}
                    </td>
                    <td className="py-2 text-muted-foreground">
                      {r.runtimeMs > 0 ? formatLatency(r.runtimeMs) : '--'}
                    </td>
                    <td className="py-2">
                      <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] text-muted-foreground">
                        {r.channel}
                      </span>
                    </td>
                    <td className="py-2 text-right text-muted-foreground">
                      {formatRelativeTime(r.timestamp)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-8 text-center text-sm text-muted-foreground">
            {t('app.dashboard.noData')}
          </div>
        )}
      </div>
    </div>
  )
}
