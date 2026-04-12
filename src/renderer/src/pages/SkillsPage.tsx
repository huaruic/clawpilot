import React, { useEffect, useMemo, useState } from 'react'
import {
  Search, FolderOpen, Bot, ArrowRight, X,
  Globe, PenTool, FileText, Repeat, Lightbulb, Target,
  BarChart3, Table, Palette, Image, FileMinus, Languages,
  ClipboardList, Briefcase,
} from 'lucide-react'
import type { SkillInfo, SkillsListResult, CuratedRegistry, CuratedSkillEntry } from '../api/ipc'
import { useI18n } from '../i18n/I18nProvider'
import { Switch } from '../components/ui/switch'
import { toast } from 'sonner'
import { useChatStore } from '../stores/chat'
import type { Page } from '../components/layout/AppSidebar'

type Tab = 'all' | 'builtin' | 'installed'

function getSkillsApi(): Window['catclaw']['skills'] {
  const api = window.catclaw?.skills
  if (!api) throw new Error('Skills API is not available.')
  return api
}

function isBuiltin(skill: SkillInfo): boolean {
  return skill.source === 'openclaw-bundled'
}

function isInstalled(skill: SkillInfo): boolean {
  return skill.source === 'openclaw-managed' || skill.source === 'openclaw-extra'
}

function isCurated(skill: SkillInfo): boolean {
  return skill.source === 'catclaw-curated'
}

/* ── Icon mapping for registry.json icon strings ── */
const ICON_NAME_MAP: Record<string, React.ReactNode> = {
  'globe': <Globe className="h-5 w-5" />,
  'search': <Search className="h-5 w-5" />,
  'pen-tool': <PenTool className="h-5 w-5" />,
  'file-text': <FileText className="h-5 w-5" />,
  'repeat': <Repeat className="h-5 w-5" />,
  'lightbulb': <Lightbulb className="h-5 w-5" />,
  'target': <Target className="h-5 w-5" />,
  'bar-chart-3': <BarChart3 className="h-5 w-5" />,
  'table': <Table className="h-5 w-5" />,
  'palette': <Palette className="h-5 w-5" />,
  'image': <Image className="h-5 w-5" />,
  'file-minus': <FileMinus className="h-5 w-5" />,
  'languages': <Languages className="h-5 w-5" />,
  'clipboard-list': <ClipboardList className="h-5 w-5" />,
  'briefcase': <Briefcase className="h-5 w-5" />,
}

function getCuratedIcon(iconName: string): React.ReactNode {
  return ICON_NAME_MAP[iconName] ?? <Bot className="h-5 w-5" />
}

/* ── Preset prompts for "Try Now" button ── */
const SKILL_PRESET_PROMPTS: Record<string, string> = {
  'xiaohongshu-writer': '帮我写一篇小红书笔记,主题:夏天防晒的 3 个常见误区,要有爆款标题和亲切的语气',
  'topic-generator': '我是美妆博主,给我 10 个适合接下来一个月的小红书选题,要混合不同角度',
  'poster-designer': '帮我设计一张小红书封面海报,主题:"3 步搞定夏日底妆",要有配色和排版建议',
  'wechat-article': '把下面这段内容改写成公众号长文,优化标题和结构(请粘贴原文)',
  'competitor-analyzer': '我想分析 3 个同类账号的爆款内容规律,帮我拆解策略和找内容空白点',
  'data-analyzer': '我有一份账号近 30 天的数据,帮我找出趋势和增长点(请粘贴 CSV 或描述)',
  'summarizer': '帮我摘要这篇文章,提取关键信息和可用金句(请粘贴原文)',
  'translator': '把这段文字翻译成英文,保留语境和文化表达(请粘贴原文)',
  'meeting-notes': '我刚开完会,请把这段口述整理成会议纪要,突出决议和行动项(请粘贴口述)',
  'feishu-doc': '帮我创建一份项目周报的飞书文档模板,要有项目进度、风险、下周计划',
  'image-prompt': '我想用 AI 绘图生成一张"夏日海边咖啡店"的图,给我可以直接用的 Midjourney prompt',
  'content-rewriter': '帮我改写下面这段内容,保留核心观点但换一种语气(请粘贴原文)',
  'search-researcher': '我想调研"2026 年运动品牌的 DTC 趋势",帮我做一份多源综合报告',
  'web-scraper': '从这个网页提取结构化数据,告诉我目标字段(请提供 URL 或贴出网页内容)',
  'csv-processor': '我有一份 CSV 数据,帮我清洗并按某个字段汇总(请粘贴或描述结构)',
}

/* ── Category ordering for the Starter Pack grid ── */
const CATEGORY_ORDER = [
  '内容创作',
  '选题策划',
  '设计制作',
  '数据采集',
  '数据分析',
  '效率工具',
  '办公集成',
] as const

const CATEGORY_I18N_KEY: Record<string, string> = {
  '内容创作': 'app.skills.categoryContent',
  '选题策划': 'app.skills.categoryTopic',
  '设计制作': 'app.skills.categoryDesign',
  '数据采集': 'app.skills.categoryCollect',
  '数据分析': 'app.skills.categoryAnalyze',
  '效率工具': 'app.skills.categoryProductivity',
  '办公集成': 'app.skills.categoryOffice',
}

function groupByCategory(skills: CuratedSkillEntry[]): Map<string, CuratedSkillEntry[]> {
  const groups = new Map<string, CuratedSkillEntry[]>()
  for (const cat of CATEGORY_ORDER) groups.set(cat, [])
  for (const skill of skills) {
    if (!groups.has(skill.category)) groups.set(skill.category, [])
    groups.get(skill.category)!.push(skill)
  }
  return groups
}

function formatSource(source: string): string {
  if (source === 'openclaw-bundled') return 'Built-in'
  if (source === 'openclaw-managed') return 'Installed'
  if (source === 'openclaw-workspace') return 'Workspace'
  if (source === 'agents-skills-personal') return 'Shared Agent'
  if (source === 'agents-skills-project') return 'Project Agent'
  if (source === 'openclaw-extra') return 'Extra'
  if (source === 'catclaw-curated') return 'Curated'
  return source
}

interface SkillsPageProps {
  onNavigate: (page: Page) => void
}

export function SkillsPage({ onNavigate }: SkillsPageProps): React.ReactElement {
  const { t } = useI18n()
  const [loading, setLoading] = useState(true)
  const [busySkillKey, setBusySkillKey] = useState<string | null>(null)
  const [skillsResult, setSkillsResult] = useState<SkillsListResult | null>(null)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<Tab>('all')
  const [registry, setRegistry] = useState<CuratedRegistry | null>(null)
  const [showOnboarding, setShowOnboarding] = useState<boolean>(false)
  const setPendingComposerInput = useChatStore((s) => s.setPendingComposerInput)

  useEffect(() => { void loadSkills(true) }, [])
  useEffect(() => { void loadRegistry() }, [])
  useEffect(() => { void loadOnboardingState() }, [])

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

  async function loadRegistry(): Promise<void> {
    try {
      const result = await getSkillsApi().curatedRegistry()
      setRegistry(result)
    } catch {
      // Non-fatal — Starter Pack section just hides
      setRegistry(null)
    }
  }

  async function loadOnboardingState(): Promise<void> {
    try {
      const settings = await window.catclaw.app.getSettings()
      setShowOnboarding(!settings.onboardedStarterPack)
    } catch {
      setShowOnboarding(false)
    }
  }

  async function dismissOnboarding(): Promise<void> {
    setShowOnboarding(false)
    try {
      await window.catclaw.app.updateSettings({ onboardedStarterPack: true })
    } catch (err) {
      // Roll back UI if persistence failed
      setShowOnboarding(true)
      toast.error(err instanceof Error ? err.message : String(err))
    }
  }

  function handleTryNow(skillKey: string): void {
    const prompt = SKILL_PRESET_PROMPTS[skillKey]
    if (!prompt) {
      toast.error('No example prompt configured for this skill yet.')
      return
    }
    setPendingComposerInput(prompt)
    onNavigate('chat')
    toast.success(t('app.skills.tryNowToast'))
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
  // "All Skills" list excludes curated entries (they live in the Starter Pack section)
  const nonCuratedSkills = useMemo(() => allSkills.filter((s) => !isCurated(s)), [allSkills])

  const filteredList = useMemo(() => {
    let list = nonCuratedSkills
    if (tab === 'builtin') list = list.filter(isBuiltin)
    else if (tab === 'installed') list = list.filter(isInstalled)
    if (search) {
      const q = search.toLowerCase()
      list = list.filter((s) => [s.name, s.skillKey, s.description ?? ''].join(' ').toLowerCase().includes(q))
    }
    return list
  }, [nonCuratedSkills, tab, search])

  const builtinCount = nonCuratedSkills.filter(isBuiltin).length
  const installedCount = nonCuratedSkills.filter(isInstalled).length

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'all', label: t('app.skills.tabAll'), count: nonCuratedSkills.length },
    { key: 'builtin', label: t('app.skills.tabBuiltin'), count: builtinCount },
    { key: 'installed', label: t('app.skills.tabInstalled'), count: installedCount },
  ]

  const groupedCurated = registry ? groupByCategory(registry.skills) : null

  return (
    <div className="cp-page max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-foreground">{t('nav.skills')}</h1>
        <button
          onClick={() => void loadSkills()}
          className="btn-active-scale flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent"
        >
          <FolderOpen className="h-3.5 w-3.5" /> {t('app.skills.openDir')}
        </button>
      </div>

      {/* Onboarding banner */}
      {showOnboarding && registry && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <p className="text-xs leading-relaxed text-foreground">
              {t('app.skills.starterPackOnboardingText')}
            </p>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => void dismissOnboarding()}
                className="btn-active-scale rounded-md bg-primary px-3 py-1 text-[11px] font-medium text-primary-foreground hover:bg-primary/90"
              >
                {t('app.skills.starterPackOnboardingDismiss')}
              </button>
              <button
                onClick={() => void dismissOnboarding()}
                className="btn-active-scale text-muted-foreground hover:text-foreground"
                aria-label="dismiss"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Starter Pack section */}
      {groupedCurated && registry && registry.skills.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-foreground">{t('app.skills.starterPackTitle')}</h2>
          {CATEGORY_ORDER.map((category) => {
            const items = groupedCurated.get(category) ?? []
            if (items.length === 0) return null
            const categoryLabel = t(CATEGORY_I18N_KEY[category] as Parameters<typeof t>[0]) || category
            return (
              <div key={category} className="space-y-2">
                <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {categoryLabel}
                </h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((skill) => (
                    <div
                      key={skill.skillKey}
                      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/30"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          {getCuratedIcon(skill.icon)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground">{skill.name}</p>
                          <p className="mt-1 text-xs leading-snug text-muted-foreground line-clamp-2">
                            {skill.description}
                          </p>
                        </div>
                      </div>
                      {skill.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {skill.tags.slice(0, 3).map((tag) => (
                            <span
                              key={tag}
                              className="rounded bg-accent px-1.5 py-0.5 text-[10px] text-muted-foreground"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="flex justify-end">
                        <button
                          onClick={() => handleTryNow(skill.skillKey)}
                          className="btn-active-scale flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-[11px] font-medium text-primary-foreground hover:bg-primary/90"
                        >
                          {t('app.skills.tryNow')} <ArrowRight className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </section>
      )}

      {/* All Skills section header */}
      <div className="flex flex-wrap items-center gap-3 pt-2">
        <h2 className="text-sm font-semibold text-foreground">{t('app.skills.allSkillsTitle')}</h2>
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
          {tabs.map((tb) => (
            <button
              key={tb.key}
              onClick={() => setTab(tb.key)}
              className={`btn-active-scale rounded-md px-3 py-1.5 text-xs transition-colors ${
                tab === tb.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'
              }`}
            >
              {tb.label} ({tb.count})
            </button>
          ))}
        </div>
      </div>

      {/* All Skills list */}
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
                  <Bot className="h-4.5 w-4.5" />
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
                    className="btn-active-scale text-[10px] text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50"
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
    </div>
  )
}
