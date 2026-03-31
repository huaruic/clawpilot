import React, { useEffect, useState } from 'react'
import { useI18n } from '../i18n/I18nProvider'
import type { AppLanguage } from '../api/ipc'

export function SettingsPage(): React.ReactElement {
  const { settings, systemLocale, resolvedLanguage, t, updateSettings } = useI18n()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [configDir, setConfigDir] = useState<string>('')
  const [configCopied, setConfigCopied] = useState(false)
  const [migrating, setMigrating] = useState(false)
  const [migrationMessage, setMigrationMessage] = useState<string | null>(null)

  useEffect(() => {
    window.clawpilot.app.getConfigDir().then(setConfigDir).catch(() => undefined)
  }, [])

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

  async function handleCopyConfigPath(): Promise<void> {
    if (!configDir) return
    try {
      await navigator.clipboard.writeText(configDir)
      setConfigCopied(true)
      window.setTimeout(() => setConfigCopied(false), 1500)
    } catch {
      setConfigCopied(false)
    }
  }

  async function handleOpenConfigDir(): Promise<void> {
    await window.clawpilot.app.openConfigDir()
  }

  async function handleMigrateLegacy(): Promise<void> {
    setMigrating(true)
    setMigrationMessage(null)
    try {
      const result = await window.clawpilot.app.migrateLegacyOpenClaw()
      if (result.ok) {
        const configText = result.copiedConfig ? '1' : '0'
        setMigrationMessage(
          `${t('app.settings.migrationDonePrefix')} config=${configText}, skills=${result.copiedSkills}`,
        )
      } else {
        setMigrationMessage(t('app.settings.migrationNotFound'))
      }
    } catch (err) {
      setMigrationMessage(`${t('app.settings.migrationFailed')} ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setMigrating(false)
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

      <section className="rounded-xl border border-zinc-800 p-5 space-y-3">
        <div>
          <h2 className="text-sm font-medium text-zinc-200">{t('app.settings.configDirTitle')}</h2>
          <p className="text-sm text-zinc-500 mt-1">{t('app.settings.configDirHelp')}</p>
        </div>
        <div className="rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm text-zinc-100 font-mono break-all">
          {configDir || '—'}
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => void handleCopyConfigPath()}
            className="px-4 py-2 text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-100 rounded-lg transition-colors"
          >
            {configCopied ? t('app.settings.copied') : t('app.settings.copyPath')}
          </button>
          <button
            onClick={() => void handleOpenConfigDir()}
            className="px-4 py-2 text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-100 rounded-lg transition-colors"
          >
            {t('app.settings.openFolder')}
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-800 p-5 space-y-3">
        <div>
          <h2 className="text-sm font-medium text-zinc-200">{t('app.settings.migrationTitle')}</h2>
          <p className="text-sm text-zinc-500 mt-1">{t('app.settings.migrationHelp')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => void handleMigrateLegacy()}
            disabled={migrating}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {migrating ? t('app.settings.migrating') : t('app.settings.migrateLegacy')}
          </button>
          {migrationMessage && (
            <span className="text-sm text-zinc-400">{migrationMessage}</span>
          )}
        </div>
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
