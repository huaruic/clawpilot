import React, { useEffect, useMemo, useState } from 'react'
import {
  Search, FolderOpen, ExternalLink, Globe, Monitor, Mail,
  FileText, Code2, BarChart3, Music, BookOpen, Image,
  MessageSquare, Terminal, Database, Zap, Bot, Wrench,
} from 'lucide-react'
import type { SkillInfo, SkillsListResult } from '../api/ipc'
import { useI18n } from '../i18n/I18nProvider'
import { Switch } from '../components/ui/switch'
import { toast } from 'sonner'

type Tab = 'all' | 'builtin' | 'installed'

function getSkillsApi(): Window['clawpilot']['skills'] {
  const api = window.clawpilot?.skills
  if (!api) throw new Error('Skills API is not available.')
  return api
}

function isBuiltin(skill: SkillInfo): boolean {
  return skill.source === 'openclaw-bundled'
}

function isInstalled(skill: SkillInfo): boolean {
  return skill.source === 'openclaw-managed' || skill.source === 'openclaw-extra'
}

/* Map well-known skill names/keys to lucide icons */
const SKILL_ICON_MAP: Record<string, React.ReactNode> = {
  'web-search': <Search className="h-4.5 w-4.5" />,
  'websearch': <Search className="h-4.5 w-4.5" />,
  'browser': <Globe className="h-4.5 w-4.5" />,
  'playwright': <Globe className="h-4.5 w-4.5" />,
  'email': <Mail className="h-4.5 w-4.5" />,
  'pdf': <FileText className="h-4.5 w-4.5" />,
  'code-review': <Code2 className="h-4.5 w-4.5" />,
  'data-analysis': <BarChart3 className="h-4.5 w-4.5" />,
  'spotify': <Music className="h-4.5 w-4.5" />,
  'notion': <BookOpen className="h-4.5 w-4.5" />,
  'image': <Image className="h-4.5 w-4.5" />,
  'chat': <MessageSquare className="h-4.5 w-4.5" />,
  'terminal': <Terminal className="h-4.5 w-4.5" />,
  'database': <Database className="h-4.5 w-4.5" />,
  'camsnap': <Monitor className="h-4.5 w-4.5" />,
  'blogwatcher': <BookOpen className="h-4.5 w-4.5" />,
  'blucli': <Music className="h-4.5 w-4.5" />,
  'bluebubbles': <MessageSquare className="h-4.5 w-4.5" />,
  'apple-notes': <FileText className="h-4.5 w-4.5" />,
  'apple-reminders': <Zap className="h-4.5 w-4.5" />,
  'bear-notes': <FileText className="h-4.5 w-4.5" />,
  '1password': <Wrench className="h-4.5 w-4.5" />,
}

function getSkillIcon(skill: SkillInfo): React.ReactNode {
  const key = skill.skillKey.toLowerCase()
  for (const [match, icon] of Object.entries(SKILL_ICON_MAP)) {
    if (key.includes(match)) return icon
  }
  if (skill.emoji) return <span className="text-base">{skill.emoji}</span>
  return <Bot className="h-4.5 w-4.5" />
}

interface RecommendedSkill {
  name: string
  desc: string
  icon: React.ReactNode
  rating: number
  downloads: string
}

const RECOMMENDED_SKILLS: RecommendedSkill[] = [
  { name: 'Spotify Control', desc: 'Spotify 播放控制', icon: <Music className="h-5 w-5" />, rating: 4.6, downloads: '8K' },
  { name: 'Notion Sync', desc: 'Notion 数据同步', icon: <BookOpen className="h-5 w-5" />, rating: 4.5, downloads: '6K' },
  { name: 'Image Gen', desc: 'AI 图像生成', icon: <Image className="h-5 w-5" />, rating: 4.4, downloads: '5K' },
]

function formatSource(source: string): string {
  if (source === 'openclaw-bundled') return 'Built-in'
  if (source === 'openclaw-managed') return 'Installed'
  if (source === 'openclaw-workspace') return 'Workspace'
  if (source === 'agents-skills-personal') return 'Shared Agent'
  if (source === 'agents-skills-project') return 'Project Agent'
  if (source === 'openclaw-extra') return 'Extra'
  return source
}

export function SkillsPage(): React.ReactElement {
  const { t } = useI18n()
  const [loading, setLoading] = useState(true)
  const [busySkillKey, setBusySkillKey] = useState<string | null>(null)
  const [skillsResult, setSkillsResult] = useState<SkillsListResult | null>(null)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<Tab>('all')

  useEffect(() => { void loadSkills(true) }, [])

  async function loadSkills(initial = false): Promise<void> {
    if (initial) setLoading(true)
    try {
      setSkillsResult(await getSkillsApi().list())
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  async function handleToggle(skill: SkillInfo): Promise<void> {
    setBusySkillKey(skill.skillKey)
    try {
      await getSkillsApi().setEnabled({ skillKey: skill.skillKey, enabled: !skill.enabled })
      toast.success(skill.enabled ? `${skill.name} disabled` : `${skill.name} enabled`)
      await loadSkills()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setBusySkillKey(null)
    }
  }

  async function handleDelete(skill: SkillInfo): Promise<void> {
    if (!window.confirm(`Delete ${skill.name}?`)) return
    setBusySkillKey(skill.skillKey)
    try {
      await getSkillsApi().delete({ skillKey: skill.skillKey })
      toast.success(`${skill.name} deleted`)
      await loadSkills()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setBusySkillKey(null)
    }
  }

  const allSkills = skillsResult?.skills ?? []
  const filteredList = useMemo(() => {
    let list = allSkills
    if (tab === 'builtin') list = list.filter(isBuiltin)
    else if (tab === 'installed') list = list.filter(isInstalled)
    if (search) {
      const q = search.toLowerCase()
      list = list.filter((s) => [s.name, s.skillKey, s.description ?? ''].join(' ').toLowerCase().includes(q))
    }
    return list
  }, [allSkills, tab, search])

  const builtinCount = allSkills.filter(isBuiltin).length
  const installedCount = allSkills.filter(isInstalled).length

  const tabs: { key: Tab | 'marketplace'; label: string; count?: number; external?: boolean }[] = [
    { key: 'all', label: t('app.skills.tabAll'), count: allSkills.length },
    { key: 'builtin', label: t('app.skills.tabBuiltin'), count: builtinCount },
    { key: 'installed', label: t('app.skills.tabInstalled'), count: installedCount },
    { key: 'marketplace', label: t('app.skills.tabMarketplace'), external: true },
  ]

  return (
    <div className="cp-page max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-foreground">{t('nav.skills')}</h1>
        <button
          onClick={() => void loadSkills()}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent"
        >
          <FolderOpen className="h-3.5 w-3.5" /> {t('app.skills.openDir')}
        </button>
      </div>

      {/* Search + tabs */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('app.skills.searchPh')}
            className="w-full rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-xs text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-primary/50"
          />
        </div>
        <div className="flex gap-1">
          {tabs.map((tb) =>
            tb.external ? (
              <button
                key={tb.key}
                onClick={() => window.open('https://clawhub.ai/skills?sort=downloads', '_blank')}
                className="flex items-center gap-1 rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent"
              >
                {tb.label} <ExternalLink className="h-3 w-3" />
              </button>
            ) : (
              <button
                key={tb.key}
                onClick={() => setTab(tb.key as Tab)}
                className={`rounded-md px-3 py-1.5 text-xs transition-colors ${
                  tab === tb.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'
                }`}
              >
                {tb.label} ({tb.count})
              </button>
            ),
          )}
        </div>
      </div>

      {/* Skill list */}
      <div className="space-y-2">
        {loading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">{t('app.skills.loading')}</div>
        ) : filteredList.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">{t('app.skills.empty')}</div>
        ) : (
          filteredList.map((skill) => (
            <div key={skill.skillKey} className="flex items-center justify-between rounded-xl border border-border bg-card p-3 transition-colors hover:border-primary/30">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  {getSkillIcon(skill)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{skill.name}</span>
                    {isBuiltin(skill) && (
                      <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        {formatSource(skill.source)}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{skill.description || skill.skillKey}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {skill.canDelete && (
                  <button
                    onClick={() => void handleDelete(skill)}
                    disabled={busySkillKey === skill.skillKey}
                    className="text-[10px] text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50"
                  >
                    {t('app.skills.delete')}
                  </button>
                )}
                <Switch
                  checked={skill.enabled}
                  disabled={busySkillKey === skill.skillKey}
                  onCheckedChange={() => void handleToggle(skill)}
                />
              </div>
            </div>
          ))
        )}
      </div>

      {/* Recommended skills */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">{t('app.skills.recommended')}</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {RECOMMENDED_SKILLS.map((rs) => (
            <div key={rs.name} className="rounded-xl border border-border bg-card p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  {rs.icon}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{rs.name}</p>
                  <p className="text-xs text-muted-foreground">{rs.desc}</p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">
                  ★ {rs.rating}  {rs.downloads} {t('app.skills.installs')}
                </span>
                <button className="rounded-md bg-primary px-3 py-1 text-[10px] font-medium text-primary-foreground hover:bg-primary/90">
                  {t('app.skills.install')}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Marketplace link */}
      <button
        onClick={() => window.open('https://clawhub.ai/skills?sort=downloads', '_blank')}
        className="flex items-center gap-1 text-xs text-primary hover:underline"
      >
        {t('app.skills.browseMore')} <ExternalLink className="h-3 w-3" />
      </button>
    </div>
  )
}
