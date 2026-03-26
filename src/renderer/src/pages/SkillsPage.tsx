import React, { useEffect, useMemo, useState } from 'react'
import type { SkillInfo, SkillsListResult } from '../api/ipc'

interface FeaturedSkill {
  skillKey: string
  title: string
  category: string
  summary: string
  recommendation: string
  risk: 'Low' | 'Medium'
}

const FEATURED_SKILLS: FeaturedSkill[] = [
  {
    skillKey: 'feishu-doc',
    title: 'Feishu Docs',
    category: 'Office',
    summary: 'Read and organize Feishu documents from your existing workspace.',
    recommendation: 'Useful for document lookup, meeting prep, and internal knowledge retrieval.',
    risk: 'Low',
  },
  {
    skillKey: 'feishu-drive',
    title: 'Feishu Drive',
    category: 'Office',
    summary: 'Browse and work with Drive files tied to your Feishu environment.',
    recommendation: 'Good default for teams that already store assets and docs in Feishu.',
    risk: 'Low',
  },
  {
    skillKey: 'feishu-wiki',
    title: 'Feishu Wiki',
    category: 'Office',
    summary: 'Navigate wiki spaces and pages without leaving your IM workflow.',
    recommendation: 'Recommended when the team uses wiki pages for SOPs or project knowledge.',
    risk: 'Low',
  },
  {
    skillKey: 'apple-reminders',
    title: 'Apple Reminders',
    category: 'Office',
    summary: 'Turn chat requests into reminders and follow-up tasks on macOS.',
    recommendation: 'Strong fit for meeting follow-ups and lightweight personal task capture.',
    risk: 'Low',
  },
  {
    skillKey: 'apple-notes',
    title: 'Apple Notes',
    category: 'Office',
    summary: 'Capture summaries, notes, and quick records into Apple Notes.',
    recommendation: 'Works well for meeting notes and lightweight note organization.',
    risk: 'Low',
  },
  {
    skillKey: 'notion',
    title: 'Notion',
    category: 'Office',
    summary: 'Pull context from Notion and help keep documents aligned.',
    recommendation: 'Good for teams already running specs and docs in Notion.',
    risk: 'Medium',
  },
  {
    skillKey: 'summarize',
    title: 'Summarize',
    category: 'General',
    summary: 'Generate concise summaries from text-heavy inputs and documents.',
    recommendation: 'A strong default skill when users mostly need digestion rather than automation.',
    risk: 'Low',
  },
  {
    skillKey: 'github',
    title: 'GitHub',
    category: 'Dev',
    summary: 'Look up repos, issues, and development context when needed.',
    recommendation: 'Included as a secondary pick for mixed office + engineering workflows.',
    risk: 'Medium',
  },
]

function getSkillsApi(): Window['clawpilot']['skills'] {
  const api = window.clawpilot?.skills
  if (!api) {
    throw new Error('Skills API is not available. Restart ClawPilot to load the latest preload bridge.')
  }
  return api
}

export function SkillsPage(): React.ReactElement {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [busySkillKey, setBusySkillKey] = useState<string | null>(null)
  const [skillsResult, setSkillsResult] = useState<SkillsListResult | null>(null)
  const [search, setSearch] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void loadSkills(true)
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

  const featuredSkills = useMemo(() => {
    const installedMap = new Map((skillsResult?.skills ?? []).map((skill) => [skill.skillKey, skill]))
    return FEATURED_SKILLS.map((featured) => ({
      ...featured,
      installed: installedMap.get(featured.skillKey) ?? null,
    }))
  }, [skillsResult?.skills])

  async function loadSkills(initial = false): Promise<void> {
    if (initial) setLoading(true)
    else setRefreshing(true)
    setError(null)

    try {
      const data = await getSkillsApi().list()
      setSkillsResult(data)
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
      await loadSkills()
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
      await loadSkills()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusySkillKey(null)
    }
  }

  return (
    <div className="flex flex-col h-full p-6 gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white">Skills</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Review the skills available in OpenClaw, turn them on or off, and manage local installs.
          </p>
        </div>
        <button
          onClick={() => void loadSkills()}
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

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 space-y-5">
        <div>
          <h2 className="text-lg font-medium text-zinc-100">Featured</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Curated recommendations for a mixed workflow, with office automation first.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {featuredSkills.map((featured) => (
            <FeaturedSkillCard key={featured.skillKey} featured={featured} />
          ))}
        </div>
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
              {skill.emoji ? `${skill.emoji} ` : ''}{skill.name}
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

function FeaturedSkillCard(props: {
  featured: FeaturedSkill & { installed: SkillInfo | null }
}): React.ReactElement {
  const { featured } = props
  const installed = featured.installed

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="text-base font-medium text-zinc-100">{featured.title}</div>
        <Badge>{featured.category}</Badge>
        <Badge>{featured.risk} risk</Badge>
        {installed ? <StatusBadge skill={installed} /> : <Badge>Not available</Badge>}
      </div>
      <p className="text-sm text-zinc-400">{featured.summary}</p>
      <p className="text-sm text-zinc-500">{featured.recommendation}</p>
      <div className="text-sm text-zinc-300">
        {installed
          ? installed.enabled
            ? `Installed locally as ${formatSource(installed.source)} and currently enabled.`
            : `Installed locally as ${formatSource(installed.source)} and currently disabled.`
          : 'This recommendation is not currently exposed by your local OpenClaw runtime.'}
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
