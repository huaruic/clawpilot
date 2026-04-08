import React, { useEffect, useState } from 'react'
import { Monitor, FolderOpen } from 'lucide-react'
import { useI18n } from '../i18n/I18nProvider'
import type { AppLanguage, AppTheme } from '../api/ipc'
import { useRuntimeStore } from '../stores/runtimeStore'

export function SettingsPage(): React.ReactElement {
  const { settings, t, updateSettings } = useI18n()
  const { snapshot } = useRuntimeStore()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [workspaceInput, setWorkspaceInput] = useState(snapshot.setup.workspaceRoot)
  const [workspaceBusy, setWorkspaceBusy] = useState<'open' | null>(null)
  const [workspaceError, setWorkspaceError] = useState<string | null>(null)

  useEffect(() => {
    setWorkspaceInput(snapshot.setup.workspaceRoot)
  }, [snapshot.setup.workspaceRoot])

  async function handleThemeChange(theme: AppTheme): Promise<void> {
    setSaving(true)
    setError(null)
    try {
      await updateSettings({ theme })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  async function handleLanguageChange(language: AppLanguage): Promise<void> {
    setSaving(true)
    setError(null)
    try {
      await updateSettings({ language })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  async function handleOpenWorkspace(): Promise<void> {
    setWorkspaceBusy('open')
    setWorkspaceError(null)
    try {
      const result = await window.clawpilot.app.openDirectory(workspaceInput)
      if (!result.ok) {
        setWorkspaceError(result.error ?? t('app.settings.openWorkspaceFailed'))
      }
    } finally {
      setWorkspaceBusy(null)
    }
  }

  const themeOptions: { value: AppTheme; label: string }[] = [
    { value: 'system', label: t('app.settings.themeSystem') },
    { value: 'light', label: t('app.settings.themeLight') },
    { value: 'dark', label: t('app.settings.themeDark') },
  ]

  const languageOptions: { value: AppLanguage; label: string }[] = [
    { value: 'system', label: t('app.settings.followSystem') },
    { value: 'zh-CN', label: t('app.settings.simplifiedChinese') },
    { value: 'en', label: t('app.settings.english') },
  ]

  return (
    <div className="cp-page max-w-3xl">
      <h1 className="text-lg font-semibold text-foreground">{t('app.settings.title')}</h1>

      {/* General */}
      <div className="space-y-5 rounded-xl border border-border bg-card p-4">
        <h3 className="text-sm font-medium text-foreground">{t('app.settings.themeTitle')}</h3>

        {/* Theme */}
        <div>
          <label className="mb-1.5 block text-xs text-muted-foreground">{t('app.settings.themeLabel')}</label>
          <div className="flex gap-1.5">
            {themeOptions.map((opt) => (
              <button
                key={opt.value}
                disabled={saving}
                onClick={() => void handleThemeChange(opt.value)}
                className={`btn-active-scale ${`rounded-lg px-4 py-1.5 text-xs transition-colors ${
                  settings.theme === opt.value
                    ? 'bg-primary text-primary-foreground'
                    : 'border border-border text-muted-foreground hover:bg-accent'
                }`} disabled:opacity-50`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Language */}
        <div>
          <label className="mb-1.5 block text-xs text-muted-foreground">{t('app.settings.languageLabel')}</label>
          <div className="flex gap-1.5">
            {languageOptions.map((opt) => (
              <button
                key={opt.value}
                disabled={saving}
                onClick={() => void handleLanguageChange(opt.value)}
                className={`btn-active-scale ${`rounded-lg px-4 py-1.5 text-xs transition-colors ${
                  settings.language === opt.value
                    ? 'bg-primary text-primary-foreground'
                    : 'border border-border text-muted-foreground hover:bg-accent'
                }`} disabled:opacity-50`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {saving && <p className="text-xs text-muted-foreground">{t('app.settings.saving')}</p>}
        {error && (
          <div className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
            {t('app.settings.saveErrorPrefix')} {error}
          </div>
        )}
      </div>

      {/* Advanced */}
      <div className="space-y-4 rounded-xl border border-border bg-card p-4 card-hover">
        <div className="flex items-center gap-2">
          <Monitor className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium text-foreground">{t('app.settings.workspaceTitle')}</h3>
        </div>

        <p className="text-xs text-muted-foreground">{t('app.settings.workspaceHelp')}</p>

        <div>
          <label className="mb-1 block text-xs text-muted-foreground">{t('app.settings.activeWorkspaceRoot')}</label>
          <div className="flex gap-2">
            <input
              value={workspaceInput}
              readOnly
              className="flex-1 rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs text-muted-foreground"
            />
            <button
              onClick={() => void handleOpenWorkspace()}
              disabled={!workspaceInput.trim() || workspaceBusy !== null}
              className="btn-active-scale flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-accent disabled:opacity-50"
            >
              <FolderOpen className="h-3.5 w-3.5" />
              {workspaceBusy === 'open' ? t('app.settings.openingWorkspace') : t('app.settings.openWorkspace')}
            </button>
          </div>
          <p className="mt-1.5 text-[10px] text-muted-foreground">
            {t('app.settings.currentSetupPhase')} <span className="font-mono text-foreground">{describeSetup(snapshot.setup.phase, t)}</span>
          </p>
        </div>

        {workspaceError && (
          <div className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
            {workspaceError}
          </div>
        )}
      </div>
    </div>
  )
}

function describeSetup(
  phase: 'gateway_setup' | 'model_setup' | 'bootstrap' | 'ready',
  t: (key: string) => string,
): string {
  switch (phase) {
    case 'gateway_setup': return t('app.status.gatewaySetup')
    case 'model_setup': return t('app.status.modelSetup')
    case 'bootstrap': return t('app.status.bootstrap')
    case 'ready': return t('app.status.ready')
  }
}
