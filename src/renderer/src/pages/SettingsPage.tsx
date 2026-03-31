import React, { useState } from 'react'
import { useI18n } from '../i18n/I18nProvider'
import type { AppLanguage, AppTheme } from '../api/ipc'

export function SettingsPage(): React.ReactElement {
  const { settings, systemLocale, resolvedLanguage, t, updateSettings } = useI18n()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
          className="w-full max-w-sm rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50"
        >
          <option value="system">{t('app.settings.themeSystem')}</option>
          <option value="dark">{t('app.settings.themeDark')}</option>
          <option value="light">{t('app.settings.themeLight')}</option>
        </select>

        <div className="grid gap-3 sm:grid-cols-2">
          <InfoCard label={t('app.settings.systemLocale')} value={systemLocale} />
          <InfoCard
            label={t('app.settings.effectiveLanguage')}
            value={resolvedLanguage === 'zh-CN' ? t('app.settings.simplifiedChinese') : t('app.settings.english')}
          />
        </div>
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
          className="w-full max-w-sm rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50"
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
    </div>
  )
}

function InfoCard({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div className="rounded-xl bg-surface-2 border border-border px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground font-mono mt-1">{value}</p>
    </div>
  )
}
