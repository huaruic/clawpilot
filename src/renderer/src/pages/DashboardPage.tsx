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

type TimeRange = 'today' | '7d' | '30d' | 'all'

const TREND_DATA = [
  { date: '03/25', anthropic: 1.2, openai: 0.4, local: 0.1 },
  { date: '03/26', anthropic: 1.8, openai: 0.6, local: 0.15 },
  { date: '03/27', anthropic: 1.4, openai: 0.5, local: 0.2 },
  { date: '03/28', anthropic: 2.1, openai: 0.8, local: 0.1 },
  { date: '03/29', anthropic: 1.6, openai: 0.7, local: 0.25 },
  { date: '03/30', anthropic: 2.4, openai: 0.9, local: 0.3 },
  { date: '03/31', anthropic: 1.9, openai: 0.6, local: 0.2 },
  { date: '04/01', anthropic: 2.2, openai: 1.0, local: 0.15 },
]

const PIE_DATA = [
  { name: 'claude-sonnet-4-5', value: 8.4, tokens: '2.1M', pct: 67 },
  { name: 'gpt-5-mini', value: 2.25, tokens: '1.5M', pct: 18 },
  { name: 'claude-haiku-4-5', value: 0.8, tokens: '800K', pct: 6 },
  { name: 'ollama/llama3.1', value: 0, tokens: '400K', pct: 0 },
]

const PIE_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#6366F1']

const LEGEND_ITEMS = [
  { color: '#3B82F6', name: 'Anthropic' },
  { color: '#10B981', name: 'OpenAI' },
  { color: '#F59E0B', name: 'Local' },
]

const RECENT_REQUESTS = [
  { model: 'claude-sonnet-4-5', tokensIn: '1,234', tokensOut: '567', cost: '$0.032', latency: '2.3s', time: '10:25' },
  { model: 'gpt-5-mini', tokensIn: '890', tokensOut: '234', cost: '$0.008', latency: '1.1s', time: '10:24' },
  { model: 'claude-sonnet-4-5', tokensIn: '2,100', tokensOut: '890', cost: '$0.058', latency: '3.1s', time: '10:22' },
  { model: 'claude-haiku-4-5', tokensIn: '456', tokensOut: '123', cost: '$0.003', latency: '0.8s', time: '10:20' },
]

interface StatCardProps {
  icon: React.ReactElement
  label: string
  value: string
  change: string
  positive: boolean
}

function StatCard({ icon, label, value, change, positive }: StatCardProps): React.ReactElement {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-2 flex items-center gap-2 text-muted-foreground">
        <span className="h-4 w-4">{icon}</span>
        <span className="text-xs">{label}</span>
      </div>
      <div className="text-2xl font-semibold text-foreground">{value}</div>
      <div className={`mt-1 flex items-center gap-1 text-xs ${positive ? 'text-success' : 'text-destructive'}`}>
        {positive ? <IconTrendUp className="h-3 w-3" /> : <IconTrendDown className="h-3 w-3" />}
        {change}
      </div>
    </div>
  )
}

function DollarIcon(): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
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

  const ranges: { key: TimeRange; label: string }[] = [
    { key: 'today', label: t('app.dashboard.rangeToday') },
    { key: '7d', label: t('app.dashboard.range7d') },
    { key: '30d', label: t('app.dashboard.range30d') },
    { key: 'all', label: t('app.dashboard.rangeAll') },
  ]

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
              className={`rounded-md px-3 py-1.5 text-xs transition-colors ${
                range === key
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          icon={<DollarIcon />}
          label={t('app.dashboard.totalCost')}
          value="$12.45"
          change={`+23% ${t('app.dashboard.vsLastMonth')}`}
          positive
        />
        <StatCard
          icon={<ZapIcon />}
          label={t('app.dashboard.totalTokens')}
          value="4.8M"
          change={`+15% ${t('app.dashboard.vsLastMonth')}`}
          positive
        />
        <StatCard
          icon={<BarChartIcon />}
          label={t('app.dashboard.totalRequests')}
          value="1,247"
          change={`+8% ${t('app.dashboard.vsLastMonth')}`}
          positive
        />
        <StatCard
          icon={<ClockIcon />}
          label={t('app.dashboard.avgLatency')}
          value="1.8s"
          change={`-12% ${t('app.dashboard.vsLastMonth')}`}
          positive
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-3 gap-4">
        {/* Area chart */}
        <div className="col-span-2 rounded-xl border border-border bg-card p-4">
          <h3 className="mb-4 text-sm font-medium text-foreground">{t('app.dashboard.costTrend')}</h3>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={TREND_DATA}>
              <defs>
                <linearGradient id="grad-anthropic" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="grad-openai" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                </linearGradient>
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
                tickFormatter={(v: number) => `$${v}`}
              />
              <RechartsTooltip
                contentStyle={{
                  background: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 8,
                  fontSize: 12,
                  color: 'hsl(var(--foreground))',
                }}
              />
              <Area type="monotone" dataKey="anthropic" stroke="#3B82F6" fill="url(#grad-anthropic)" strokeWidth={2} name="Anthropic" />
              <Area type="monotone" dataKey="openai" stroke="#10B981" fill="url(#grad-openai)" strokeWidth={2} name="OpenAI" />
              <Area type="monotone" dataKey="local" stroke="#F59E0B" fill="transparent" strokeWidth={2} name="Local" />
            </AreaChart>
          </ResponsiveContainer>
          <div className="mt-2 flex gap-4">
            {LEGEND_ITEMS.map((l) => (
              <div key={l.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="h-2 w-2 rounded-full" style={{ background: l.color }} />
                {l.name}
              </div>
            ))}
          </div>
        </div>

        {/* Pie chart */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-4 text-sm font-medium text-foreground">{t('app.dashboard.modelDistribution')}</h3>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie
                data={PIE_DATA}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={65}
                dataKey="value"
                stroke="none"
              >
                {PIE_DATA.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-2 space-y-2">
            {PIE_DATA.map((d, i) => (
              <div key={d.name} className="flex items-center text-xs">
                <span className="mr-2 h-2 w-2 shrink-0 rounded-full" style={{ background: PIE_COLORS[i] }} />
                <span className="flex-1 truncate text-muted-foreground">{d.name}</span>
                <span className="ml-2 font-medium text-foreground">${d.value.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent requests table */}
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="mb-3 text-sm font-medium text-foreground">{t('app.dashboard.recentRequests')}</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="py-2 text-left font-medium">{t('app.dashboard.colModel')}</th>
                <th className="py-2 text-left font-medium">{t('app.dashboard.colTokens')}</th>
                <th className="py-2 text-left font-medium">{t('app.dashboard.colCost')}</th>
                <th className="py-2 text-left font-medium">{t('app.dashboard.colLatency')}</th>
                <th className="py-2 text-right font-medium">{t('app.dashboard.colTime')}</th>
              </tr>
            </thead>
            <tbody>
              {RECENT_REQUESTS.map((r, i) => (
                <tr key={i} className="border-b border-border/50 transition-colors hover:bg-accent/50">
                  <td className="py-2 font-mono text-foreground">{r.model}</td>
                  <td className="py-2 text-muted-foreground">{r.tokensIn} / {r.tokensOut}</td>
                  <td className="py-2 text-foreground">{r.cost}</td>
                  <td className="py-2 text-muted-foreground">{r.latency}</td>
                  <td className="py-2 text-right text-muted-foreground">{r.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
