import React, { useEffect, useState } from 'react'
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

  return (
    <div className="flex flex-col h-full p-6 gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">{t('app.settings.title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('app.settings.subtitle')}</p>
      </div>

      <section className="rounded-2xl border border-border bg-surface p-5 space-y-5 max-w-2xl">
        <div>
          <h2 className="text-sm font-medium text-foreground">{t('app.settings.themeTitle')}</h2>
          <p className="text-sm text-muted-foreground mt-1">{t('app.settings.themeHelp')}</p>
        </div>

        <label className="block text-xs text-muted-foreground">{t('app.settings.themeLabel')}</label>
        <select
          value={settings.theme}
          disabled={saving}
          onChange={(event) => void handleThemeChange(event.target.value as AppTheme)}
          className="cp-input w-full max-w-sm disabled:opacity-50"
        >
          <option value="system">{t('app.settings.themeSystem')}</option>
          <option value="dark">{t('app.settings.themeDark')}</option>
          <option value="light">{t('app.settings.themeLight')}</option>
        </select>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-5 space-y-4 max-w-2xl">
        <div>
          <h2 className="text-sm font-medium text-foreground">{t('app.settings.languageTitle')}</h2>
          <p className="text-sm text-muted-foreground mt-1">{t('app.settings.languageHelp')}</p>
        </div>

        <label className="block text-xs text-muted-foreground">{t('app.settings.languageLabel')}</label>
        <select
          value={settings.language}
          disabled={saving}
          onChange={(event) => void handleLanguageChange(event.target.value as AppLanguage)}
          className="cp-input w-full max-w-sm disabled:opacity-50"
        >
          <option value="system">{t('app.settings.followSystem')}</option>
          <option value="zh-CN">{t('app.settings.simplifiedChinese')}</option>
          <option value="en">{t('app.settings.english')}</option>
        </select>

        {saving && (
          <p className="text-sm text-muted-foreground">{t('app.settings.saving')}</p>
        )}

        {error && (
          <div className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
            {t('app.settings.saveErrorPrefix')} {error}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-surface p-5 space-y-4 max-w-2xl">
        <div>
          <h2 className="text-sm font-medium text-foreground">{t('app.settings.workspaceTitle')}</h2>
          <p className="text-sm text-muted-foreground mt-1">{t('app.settings.workspaceHelp')}</p>
        </div>

        <div className="space-y-2">
          <label className="block text-xs text-muted-foreground">{t('app.settings.activeWorkspaceRoot')}</label>
          <input
            value={workspaceInput}
            className="cp-input"
            placeholder={t('app.settings.workspacePlaceholder')}
            readOnly
          />
          <p className="text-xs text-muted-foreground">
            {t('app.settings.currentSetupPhase')} <span className="font-mono">{describeSetup(snapshot.setup.phase, t)}</span>
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => void handleOpenWorkspace()}
            disabled={!workspaceInput.trim() || workspaceBusy !== null}
            className="cp-btn cp-btn-primary"
          >
            {workspaceBusy === 'open' ? t('app.settings.openingWorkspace') : t('app.settings.openWorkspace')}
          </button>
        </div>

        {workspaceError && (
          <div className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
            {workspaceError}
          </div>
        )}
      </section>
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
