import React, { useState } from 'react'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { useI18n } from '../i18n/I18nProvider'
import { Switch } from '../components/ui/switch'

type SandboxMode = 'off' | 'non-main' | 'all'

interface ToolPerm {
  id: string
  name: string
  descKey: string
  enabled: boolean
  confirm: boolean
}

const INITIAL_TOOLS: ToolPerm[] = [
  { id: 'exec', name: 'exec', descKey: 'app.security.toolExec', enabled: true, confirm: true },
  { id: 'read', name: 'read', descKey: 'app.security.toolRead', enabled: true, confirm: false },
  { id: 'write', name: 'write', descKey: 'app.security.toolWrite', enabled: true, confirm: true },
  { id: 'browser', name: 'browser', descKey: 'app.security.toolBrowser', enabled: false, confirm: false },
  { id: 'canvas', name: 'canvas', descKey: 'app.security.toolCanvas', enabled: false, confirm: false },
]

export function SecurityPage(): React.ReactElement {
  const { t } = useI18n()
  const [sandboxMode, setSandboxMode] = useState<SandboxMode>('non-main')
  const [tools, setTools] = useState(INITIAL_TOOLS)
  const [elevated, setElevated] = useState(false)

  const toggleTool = (id: string) => {
    setTools((prev) => prev.map((tp) => (tp.id === id ? { ...tp, enabled: !tp.enabled } : tp)))
  }

  const toggleConfirm = (id: string) => {
    setTools((prev) => prev.map((tp) => (tp.id === id ? { ...tp, confirm: !tp.confirm } : tp)))
  }

  const modes: { id: SandboxMode; labelKey: string; descKey: string; warn?: boolean; recommended?: boolean }[] = [
    { id: 'off', labelKey: 'app.security.modeOff', descKey: 'app.security.modeOffDesc', warn: true },
    { id: 'non-main', labelKey: 'app.security.modePartial', descKey: 'app.security.modePartialDesc', recommended: true },
    { id: 'all', labelKey: 'app.security.modeAll', descKey: 'app.security.modeAllDesc' },
  ]

  return (
    <div className="cp-page max-w-4xl">
      <h1 className="text-lg font-semibold text-foreground">{t('app.security.title')}</h1>

      {/* Sandbox status */}
      <div className="rounded-xl border border-border bg-card p-4 card-hover">
        <h3 className="mb-1 text-sm font-medium text-foreground">{t('app.security.sandboxStatus')}</h3>
        <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-success" /> Docker {t('app.security.available')}
          </span>
          <span>{t('app.security.image')}: openclaw-sandbox:bookworm</span>
          <span>{t('app.security.isolation')}: session</span>
          <span>{t('app.security.network')}: none</span>
          <span>{t('app.security.memoryLimit')}: 512MB</span>
        </div>
      </div>

      {/* Mode selection */}
      <div className="rounded-xl border border-border bg-card p-4 card-hover">
        <h3 className="mb-3 text-sm font-medium text-foreground">{t('app.security.sandboxMode')}</h3>
        <div className="space-y-2">
          {modes.map((m) => (
            <label
              key={m.id}
              onClick={() => setSandboxMode(m.id)}
              className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${
                sandboxMode === m.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'
              }`}
            >
              <span className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${
                sandboxMode === m.id ? 'border-primary' : 'border-muted-foreground'
              }`}>
                {sandboxMode === m.id && <span className="h-2 w-2 rounded-full bg-primary" />}
              </span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">{t(m.labelKey)}</span>
                  {m.warn && <AlertTriangle className="h-3 w-3 text-warning" />}
                  {m.recommended && (
                    <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[10px] text-primary">{t('app.security.recommended')}</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{t(m.descKey)}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Tool permissions */}
      <div className="rounded-xl border border-border bg-card p-4 card-hover">
        <h3 className="mb-3 text-sm font-medium text-foreground">{t('app.security.toolPermissions')}</h3>
        <div className="space-y-2">
          {tools.map((tp) => (
            <div key={tp.id} className="flex items-center justify-between rounded-lg px-3 py-2 transition-colors hover:bg-accent/50">
              <div className="flex items-center gap-3">
                <Switch checked={tp.enabled} onCheckedChange={() => toggleTool(tp.id)} />
                <div>
                  <span className="font-mono text-xs text-foreground">{tp.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">({t(tp.descKey)})</span>
                </div>
              </div>
              {tp.enabled && (
                <label className="flex cursor-pointer items-center gap-1.5 text-[10px] text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={tp.confirm}
                    onChange={() => toggleConfirm(tp.id)}
                    className="rounded border-border"
                  />
                  {t('app.security.requireConfirm')}
                </label>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Elevated mode */}
      <div className="rounded-xl border border-warning/30 bg-card p-4 card-hover">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
          <div className="flex-1">
            <h3 className="text-sm font-medium text-foreground">{t('app.security.elevatedTitle')}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{t('app.security.elevatedDesc')}</p>
            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {t('app.security.current')}: {elevated ? t('app.security.enabled') : t('app.security.disabled')}
              </span>
              <button
                onClick={() => setElevated(!elevated)}
                className={`btn-active-scale ${`rounded-lg border px-3 py-1 text-xs transition-colors ${
                  elevated
                    ? 'border-border text-foreground hover:bg-accent'
                    : 'border-warning/50 text-warning hover:bg-warning/10'
                }`}`}
              >
                {elevated ? t('app.security.disable') : t('app.security.enable')} Elevated
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
