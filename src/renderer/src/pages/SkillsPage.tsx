import React, { useEffect, useMemo, useState } from 'react'
import type { RegistrySkill, RegistryResult, SkillInfo, SkillsListResult } from '../api/ipc'
import {
  Database,
  PenTool,
  Lightbulb,
  BarChart3,
  Palette,
  Zap,
  Briefcase,
  Package,
  type LucideIcon,
} from 'lucide-react'
import * as LucideIcons from 'lucide-react'

const CATEGORY_ICON_MAP: Record<string, LucideIcon> = {
  '\u6570\u636e\u91c7\u96c6': Database,
  '\u5185\u5bb9\u521b\u4f5c': PenTool,
  '\u9009\u9898\u7b56\u5212': Lightbulb,
  '\u6570\u636e\u5206\u6790': BarChart3,
  '\u8bbe\u8ba1\u5236\u4f5c': Palette,
  '\u6548\u7387\u5de5\u5177': Zap,
  '\u529e\u516c\u96c6\u6210': Briefcase,
}

function getSkillIcon(skill: RegistrySkill): LucideIcon {
  if (skill.icon) {
    const pascalName = skill.icon
      .split('-')
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join('')
    const icon = (LucideIcons as Record<string, unknown>)[pascalName] as LucideIcon | undefined
    if (icon) return icon
  }
  return CATEGORY_ICON_MAP[skill.category] ?? Package
}

function getSkillsApi(): Window['catclaw']['skills'] {
  const api = window.catclaw?.skills
  if (!api) {
    throw new Error('Skills API is not available. Restart CatClaw to load the latest preload bridge.')
  }
  return api
}

export function SkillsPage(): React.ReactElement {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [busySkillKey, setBusySkillKey] = useState<string | null>(null)
  const [installingKey, setInstallingKey] = useState<string | null>(null)
  const [skillsResult, setSkillsResult] = useState<SkillsListResult | null>(null)
  const [registryResult, setRegistryResult] = useState<RegistryResult | null>(null)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void loadAll(true)
  }, [])

  const installedSkills = useMemo(() => {
    const query = search.trim().toLowerCase()
    const list = skillsResult?.skills ?? []
    if (!query) return list
    return list.filter((skill) => {
      const haystack = [
        skill.skillKey,
        skill.name,
        skill.description ?? '',
        skill.source,
      ].join(' ').toLowerCase()
      return haystack.includes(query)
    })
  }, [search, skillsResult?.skills])

  const installedKeySet = useMemo(
    () => new Set((skillsResult?.skills ?? []).map((s) => s.skillKey)),
    [skillsResult?.skills],
  )

  const categories = useMemo(() => {
    const cats = new Set((registryResult?.skills ?? []).map((s) => s.category))
    return Array.from(cats).sort()
  }, [registryResult?.skills])

  const filteredRegistrySkills = useMemo(() => {
    const skills = registryResult?.skills ?? []
    if (!categoryFilter) return skills
    return skills.filter((s) => s.category === categoryFilter)
  }, [registryResult?.skills, categoryFilter])

  async function loadAll(initial = false): Promise<void> {
    if (initial) setLoading(true)
    else setRefreshing(true)
    setError(null)

    try {
      const [skills, registry] = await Promise.all([
        getSkillsApi().list(),
        getSkillsApi().fetchRegistry(),
      ])
      setSkillsResult(skills)
      setRegistryResult(registry)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  async function handleToggle(skill: SkillInfo): Promise<void> {
    setBusySkillKey(skill.skillKey)
    setError(null)
    setMessage(null)
    try {
      await getSkillsApi().setEnabled({ skillKey: skill.skillKey, enabled: !skill.enabled })
      setMessage(skill.enabled ? `${skill.name} disabled.` : `${skill.name} enabled.`)
      await loadAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusySkillKey(null)
    }
  }

  async function handleDelete(skill: SkillInfo): Promise<void> {
    const confirmed = window.confirm(`Delete ${skill.name}? This removes the local skill folder from OpenClaw.`)
    if (!confirmed) return

    setBusySkillKey(skill.skillKey)
    setError(null)
    setMessage(null)
    try {
      await getSkillsApi().delete({ skillKey: skill.skillKey })
      setMessage(`${skill.name} deleted from local skills.`)
      await loadAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusySkillKey(null)
    }
  }

  async function handleInstall(skill: RegistrySkill): Promise<void> {
    setInstallingKey(skill.skillKey)
    setError(null)
    setMessage(null)
    try {
      await getSkillsApi().install({ skillKey: skill.skillKey })
      setMessage(`${skill.name} installed and enabled.`)
      await loadAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setInstallingKey(null)
    }
  }

  return (
    <div className="flex flex-col h-full p-6 gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white">Skills</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Browse curated skills, install with one click, and manage your local skills.
          </p>
        </div>
        <button
          onClick={() => void loadAll()}
          disabled={refreshing || loading}
          className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-200 transition-colors hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {message && (
        <div className="rounded-lg border border-green-900 bg-green-950/40 px-4 py-3 text-sm text-green-300">
          {message}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-4 gap-4">
        <SummaryCard label="Total" value={String(skillsResult?.summary.total ?? '0')} />
        <SummaryCard label="Enabled" value={String(skillsResult?.summary.enabled ?? '0')} />
        <SummaryCard label="Built-in" value={String(skillsResult?.summary.builtIn ?? '0')} />
        <SummaryCard label="Local" value={String(skillsResult?.summary.local ?? '0')} />
      </div>

      {/* Featured / Store section */}
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 space-y-5">
        <div>
          <h2 className="text-lg font-medium text-zinc-100">Store</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Curated skills for content creators. Install with one click.
          </p>
        </div>

        {categories.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <CategoryChip
              label="All"
              active={categoryFilter === null}
              onClick={() => setCategoryFilter(null)}
            />
            {categories.map((cat) => (
              <CategoryChip
                key={cat}
                label={cat}
                active={categoryFilter === cat}
                onClick={() => setCategoryFilter(cat)}
              />
            ))}
          </div>
        )}

        {loading ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-6 text-sm text-zinc-400">
            Loading skill store...
          </div>
        ) : registryResult?.error && (registryResult.skills.length === 0) ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-6 text-sm text-zinc-400">
            Unable to load skill store. Please check your network connection.
          </div>
        ) : filteredRegistrySkills.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-6 text-sm text-zinc-400">
            No skills available in this category.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {filteredRegistrySkills.map((skill) => (
              <RegistrySkillCard
                key={skill.skillKey}
                skill={skill}
                installed={installedKeySet.has(skill.skillKey)}
                installing={installingKey === skill.skillKey}
                onInstall={() => void handleInstall(skill)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Installed section */}
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 space-y-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-medium text-zinc-100">Installed</h2>
            <p className="mt-1 text-sm text-zinc-500">
              This list is read directly from local OpenClaw skill folders and configuration.
            </p>
          </div>
          <label className="block w-full max-w-sm">
            <span className="sr-only">Search skills</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search installed skills"
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none transition-colors focus:border-violet-500"
            />
          </label>
        </div>

        {loading ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-6 text-sm text-zinc-400">
            Loading skills from OpenClaw...
          </div>
        ) : installedSkills.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-6 text-sm text-zinc-400">
            No skills matched the current search.
          </div>
        ) : (
          <div className="space-y-3">
            {installedSkills.map((skill) => (
              <SkillRow
                key={skill.skillKey}
                skill={skill}
                busy={busySkillKey === skill.skillKey}
                onToggle={() => void handleToggle(skill)}
                onDelete={() => void handleDelete(skill)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function SummaryCard({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="text-xs uppercase tracking-[0.12em] text-zinc-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
    </div>
  )
}

function CategoryChip(props: {
  label: string
  active: boolean
  onClick: () => void
}): React.ReactElement {
  const { label, active, onClick } = props
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs transition-colors ${
        active
          ? 'bg-violet-600 text-white'
          : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
      }`}
    >
      {label}
    </button>
  )
}

function RegistrySkillCard(props: {
  skill: RegistrySkill
  installed: boolean
  installing: boolean
  onInstall: () => void
}): React.ReactElement {
  const { skill, installed, installing, onInstall } = props
  const IconComponent = getSkillIcon(skill)

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex-shrink-0 rounded-xl bg-zinc-800 p-2">
            <IconComponent className="h-5 w-5 text-violet-400" />
          </div>
          <div className="min-w-0">
            <div className="text-base font-medium text-zinc-100 truncate">{skill.name}</div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge>{skill.category}</Badge>
              <Badge>{skill.risk} risk</Badge>
            </div>
          </div>
        </div>
        <div className="flex-shrink-0">
          {installed ? (
            <span className="inline-flex items-center gap-1 rounded-xl bg-green-950/50 px-3 py-2 text-sm text-green-300">
              Installed
            </span>
          ) : (
            <button
              onClick={onInstall}
              disabled={installing}
              className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {installing ? 'Installing...' : 'Install'}
            </button>
          )}
        </div>
      </div>
      <p className="text-sm text-zinc-400">{skill.description}</p>
      {skill.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {skill.tags.map((tag) => (
            <span key={tag} className="rounded-full bg-zinc-900 px-2 py-0.5 text-xs text-zinc-500">
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function SkillRow(props: {
  skill: SkillInfo
  busy: boolean
  onToggle: () => void
  onDelete: () => void
}): React.ReactElement {
  const { skill, busy, onToggle, onDelete } = props

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-base font-medium text-zinc-100">
              {skill.name}
            </span>
            <Badge>{formatSource(skill.source)}</Badge>
            <StatusBadge skill={skill} />
          </div>
          <p className="text-sm text-zinc-400">
            {skill.description || 'No description provided by this skill.'}
          </p>
          <div className="text-sm text-zinc-500">Key: {skill.skillKey}</div>
          {skill.homepage && (
            <a
              href={skill.homepage}
              target="_blank"
              rel="noreferrer"
              className="inline-flex text-sm text-violet-300 underline underline-offset-2"
            >
              Skill homepage
            </a>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onToggle}
            disabled={busy}
            className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 transition-colors hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? 'Working...' : skill.enabled ? 'Disable' : 'Enable'}
          </button>
          {skill.canDelete && (
            <button
              onClick={onDelete}
              disabled={busy}
              className="rounded-xl border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-300 transition-colors hover:border-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function Badge({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <span className="rounded-full bg-zinc-800 px-2.5 py-1 text-xs text-zinc-300">
      {children}
    </span>
  )
}

function StatusBadge({ skill }: { skill: SkillInfo }): React.ReactElement {
  const label = skill.enabled ? 'Enabled' : 'Disabled'
  const className = skill.enabled ? 'bg-green-950/50 text-green-300' : 'bg-zinc-800 text-zinc-300'

  return <span className={`rounded-full px-2.5 py-1 text-xs ${className}`}>{label}</span>
}

function formatSource(source: string): string {
  if (source === 'openclaw-bundled') return 'Built-in'
  if (source === 'openclaw-managed') return 'Installed'
  if (source === 'openclaw-workspace') return 'Workspace'
  if (source === 'agents-skills-personal') return 'Shared Agent'
  if (source === 'agents-skills-project') return 'Project Agent'
  if (source === 'openclaw-extra') return 'Extra'
  return source
}
