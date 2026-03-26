import React, { useState } from 'react'
import { useI18n } from '../i18n/I18nProvider'
import type { AppLanguage } from '../api/ipc'

export function SettingsPage(): React.ReactElement {
  const { settings, systemLocale, resolvedLanguage, t, updateSettings } = useI18n()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
        <h1 className="text-xl font-semibold text-white">{t('app.settings.title')}</h1>
        <p className="text-sm text-zinc-500 mt-1">{t('app.settings.subtitle')}</p>
      </div>

      <section className="rounded-xl border border-zinc-800 p-5 space-y-4">
        <div>
          <h2 className="text-sm font-medium text-zinc-200">{t('app.settings.languageTitle')}</h2>
          <p className="text-sm text-zinc-500 mt-1">{t('app.settings.languageHelp')}</p>
        </div>

        <label className="block text-xs text-zinc-500">{t('app.settings.languageLabel')}</label>
        <select
          value={settings.language}
          disabled={saving}
          onChange={(event) => void handleLanguageChange(event.target.value as AppLanguage)}
          className="w-full max-w-sm bg-zinc-900 border border-zinc-700 focus:border-violet-500 rounded-lg px-3 py-2 text-sm text-zinc-100 outline-none transition-colors disabled:opacity-50"
        >
          <option value="system">{t('app.settings.followSystem')}</option>
          <option value="zh-CN">{t('app.settings.simplifiedChinese')}</option>
          <option value="en">{t('app.settings.english')}</option>
        </select>

        <div className="grid gap-3 sm:grid-cols-2">
          <InfoCard label={t('app.settings.systemLocale')} value={systemLocale} />
          <InfoCard
            label={t('app.settings.effectiveLanguage')}
            value={resolvedLanguage === 'zh-CN' ? t('app.settings.simplifiedChinese') : t('app.settings.english')}
          />
        </div>

        {saving && (
          <p className="text-sm text-zinc-500">{t('app.settings.saving')}</p>
        )}

        {error && (
          <div className="rounded-lg border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-300">
            {t('app.settings.saveErrorPrefix')} {error}
          </div>
        )}
      </section>
    </div>
  )
}

function InfoCard({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div className="rounded-lg bg-zinc-900 border border-zinc-800 px-4 py-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="text-sm text-zinc-200 font-mono mt-1">{value}</p>
    </div>
  )
}
