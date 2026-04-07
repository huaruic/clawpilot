import React, { useState } from 'react'
import { User, Bot, Sparkles, Settings, Save, RotateCcw, Code, PenLine, GraduationCap, Briefcase } from 'lucide-react'
import { useI18n } from '../i18n/I18nProvider'
import { Input } from '../components/ui/input'
import { Slider } from '../components/ui/slider'
import { Badge } from '../components/ui/badge'

const TIMEZONES = [
  'Asia/Shanghai', 'Asia/Tokyo', 'Asia/Seoul', 'Asia/Singapore',
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Moscow',
  'Australia/Sydney', 'Pacific/Auckland', 'UTC',
]

const VIBES = ['正式', '随意', '幽默', '简洁'] as const

const TRAITS = ['活泼开朗', '沉稳专业', '幽默风趣', '温暖体贴', '逻辑严谨', '富有创意'] as const

const SOUL_TEMPLATES = [
  { id: 'dev', icon: Code, nameKey: 'app.persona.soulDev', descKey: 'app.persona.soulDevDesc' },
  { id: 'writer', icon: PenLine, nameKey: 'app.persona.soulWriter', descKey: 'app.persona.soulWriterDesc' },
  { id: 'tutor', icon: GraduationCap, nameKey: 'app.persona.soulTutor', descKey: 'app.persona.soulTutorDesc' },
  { id: 'exec', icon: Briefcase, nameKey: 'app.persona.soulExec', descKey: 'app.persona.soulExecDesc' },
]

const STORAGE_KEY = 'persona__main__'
const systemTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone

function getDefaultState() {
  return {
    userName: '',
    callMe: '',
    timezone: systemTimezone,
    aboutMe: '',
    assistantName: 'Main Agent',
    role: '',
    vibe: '随意',
    workType: '',
    soul: '',
    traits: [] as string[],
    verbosity: [50],
    proactivity: [70],
    creativity: [40],
  }
}

function IconBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
      {children}
    </div>
  )
}

function SectionHeader({ icon, titleKey, t }: { icon: React.ReactNode; titleKey: string; t: (k: string) => string }) {
  return (
    <div className="mb-4 flex items-center gap-2">
      <IconBox>{icon}</IconBox>
      <h3 className="text-sm font-medium text-foreground">{t(titleKey)}</h3>
    </div>
  )
}

export function PersonaPage(): React.ReactElement {
  const { t } = useI18n()
  const [form, setForm] = useState(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY)
      return saved ? { ...getDefaultState(), ...JSON.parse(saved) } : getDefaultState()
    } catch {
      return getDefaultState()
    }
  })

  const update = (patch: Partial<typeof form>) => setForm((p) => ({ ...p, ...patch }))

  const toggleTrait = (tr: string) => {
    update({ traits: form.traits.includes(tr) ? form.traits.filter((x) => x !== tr) : [...form.traits, tr] })
  }

  const handleSave = () => sessionStorage.setItem(STORAGE_KEY, JSON.stringify(form))
  const handleReset = () => setForm(getDefaultState())

  return (
    <div className="cp-page max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">{t('app.persona.title')}</h1>
          <Badge className="mt-1 text-[10px]">{t('app.persona.badge')}</Badge>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleReset}
            className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-accent"
          >
            <RotateCcw className="h-3 w-3" /> {t('app.persona.reset')}
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Save className="h-3 w-3" /> {t('app.persona.save')}
          </button>
        </div>
      </div>

      {/* About You + Assistant Identity */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* About You */}
        <div className="rounded-xl border border-border bg-card p-4">
          <SectionHeader icon={<User className="h-4 w-4 text-primary" />} titleKey="app.persona.aboutYou" t={t} />
          <div className="space-y-3">
            <div>
              <label className="mb-1.5 block text-xs text-muted-foreground">{t('app.persona.whoAreYou')}</label>
              <Input value={form.userName} onChange={(e) => update({ userName: e.target.value })} placeholder={t('app.persona.whoAreYouPh')} className="h-8 text-xs" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-muted-foreground">{t('app.persona.callMe')}</label>
              <Input value={form.callMe} onChange={(e) => update({ callMe: e.target.value })} placeholder={t('app.persona.callMePh')} className="h-8 text-xs" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-muted-foreground">{t('app.persona.timezone')}</label>
              <select
                value={form.timezone}
                onChange={(e) => update({ timezone: e.target.value })}
                className="h-8 w-full rounded-lg border border-border bg-background px-2 text-xs text-foreground"
              >
                {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-muted-foreground">{t('app.persona.aboutMeLabel')}</label>
              <textarea
                value={form.aboutMe}
                onChange={(e) => update({ aboutMe: e.target.value })}
                placeholder={t('app.persona.aboutMePh')}
                className="min-h-[80px] w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>
        </div>

        {/* Assistant Identity */}
        <div className="rounded-xl border border-border bg-card p-4">
          <SectionHeader icon={<Bot className="h-4 w-4 text-primary" />} titleKey="app.persona.assistantIdentity" t={t} />
          <div className="space-y-3">
            <div>
              <label className="mb-1.5 block text-xs text-muted-foreground">{t('app.persona.assistantName')}</label>
              <Input value={form.assistantName} onChange={(e) => update({ assistantName: e.target.value })} placeholder="Main Agent" className="h-8 text-xs" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-muted-foreground">{t('app.persona.assistantRole')}</label>
              <textarea
                value={form.role}
                onChange={(e) => update({ role: e.target.value })}
                placeholder={t('app.persona.assistantRolePh')}
                className="min-h-[60px] w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-muted-foreground">{t('app.persona.vibe')}</label>
              <div className="flex flex-wrap gap-1.5">
                {VIBES.map((v) => (
                  <button key={v} onClick={() => update({ vibe: v })}
                    className={`rounded-md px-3 py-1 text-xs transition-colors ${form.vibe === v ? 'bg-primary text-primary-foreground' : 'border border-border text-muted-foreground hover:bg-accent'}`}>
                    {v}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-muted-foreground">{t('app.persona.workType')}</label>
              <Input value={form.workType} onChange={(e) => update({ workType: e.target.value })} placeholder={t('app.persona.workTypePh')} className="h-8 text-xs" />
            </div>
          </div>
        </div>
      </div>

      {/* Soul */}
      <div className="rounded-xl border border-border bg-card p-4">
        <SectionHeader icon={<Sparkles className="h-4 w-4 text-primary" />} titleKey="app.persona.soulTitle" t={t} />
        <textarea
          value={form.soul}
          onChange={(e) => update({ soul: e.target.value })}
          placeholder={t('app.persona.soulPh')}
          className="mb-4 min-h-[100px] w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {SOUL_TEMPLATES.map((tmpl) => (
            <button
              key={tmpl.id}
              onClick={() => update({ soul: t(tmpl.descKey) })}
              className="flex flex-col items-start gap-2 rounded-lg border border-border p-3 text-left transition-colors hover:border-primary/50 hover:bg-accent/50"
            >
              <IconBox><tmpl.icon className="h-4 w-4 text-primary" /></IconBox>
              <div>
                <span className="block text-xs font-medium text-foreground">{t(tmpl.nameKey)}</span>
                <span className="text-[10px] text-muted-foreground">{t(tmpl.descKey)}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Personality & Behavior */}
      <div className="rounded-xl border border-border bg-card p-4">
        <SectionHeader icon={<Settings className="h-4 w-4 text-primary" />} titleKey="app.persona.personalityTitle" t={t} />
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs text-muted-foreground">{t('app.persona.traits')}</label>
            <div className="flex flex-wrap gap-1.5">
              {TRAITS.map((tr) => (
                <button key={tr} onClick={() => toggleTrait(tr)}
                  className={`rounded-md px-3 py-1 text-xs transition-colors ${form.traits.includes(tr) ? 'bg-primary text-primary-foreground' : 'border border-border text-muted-foreground hover:bg-accent'}`}>
                  {tr}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {([
              { key: 'verbosity', labelKey: 'app.persona.verbosity' },
              { key: 'proactivity', labelKey: 'app.persona.proactivity' },
              { key: 'creativity', labelKey: 'app.persona.creativity' },
            ] as const).map(({ key, labelKey }) => (
              <div key={key} className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{t(labelKey)}</span>
                  <span className="font-medium text-foreground">{form[key][0]}%</span>
                </div>
                <Slider value={form[key]} onValueChange={(v) => update({ [key]: v })} max={100} step={1} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
