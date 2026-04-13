import React, { useEffect, useState } from 'react'
import { useI18n } from '../i18n/I18nProvider'
import type { AppLanguage, SearchConfig, SearchProvider } from '../api/ipc'

const SEARCH_PROVIDERS: Array<{ value: SearchProvider; label: string; hint: string }> = [
  { value: 'brave', label: 'Brave Search', hint: 'Free 2,000 queries/month. Sign up at brave.com/search/api' },
  { value: 'perplexity', label: 'Perplexity', hint: 'Via OpenRouter. No credit card needed.' },
  { value: 'gemini', label: 'Gemini (Google)', hint: 'Google Search grounding. Requires Google AI API key.' },
  { value: 'grok', label: 'Grok (xAI)', hint: 'X/Twitter search. Requires xAI API key.' },
  { value: 'kimi', label: 'Kimi', hint: 'Alternative search provider.' },
]

export function SettingsPage(): React.ReactElement {
  const { settings, systemLocale, resolvedLanguage, t, updateSettings } = useI18n()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [searchConfig, setSearchConfig] = useState<SearchConfig | null>(null)
  const [searchProvider, setSearchProvider] = useState<SearchProvider | ''>('')
  const [searchApiKey, setSearchApiKey] = useState('')
  const [searchSaving, setSearchSaving] = useState(false)
  const [searchMessage, setSearchMessage] = useState<string | null>(null)
  const [searchError, setSearchError] = useState<string | null>(null)

  useEffect(() => {
    void loadSearchConfig()
  }, [])

  async function loadSearchConfig(): Promise<void> {
    try {
      const config = await window.catclaw.app.getSearchConfig()
      setSearchConfig(config)
      setSearchProvider(config.provider)
      setSearchApiKey(config.apiKey)
    } catch {
      // ignore — settings page still works without search config
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

  async function handleSaveSearch(): Promise<void> {
    if (!searchProvider || !searchApiKey.trim()) return

    setSearchSaving(true)
    setSearchError(null)
    setSearchMessage(null)
    try {
      await window.catclaw.app.saveSearchConfig({
        provider: searchProvider,
        apiKey: searchApiKey.trim(),
      })
      setSearchMessage('Search provider saved. Runtime will restart to apply changes.')
      await loadSearchConfig()
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : String(err))
    } finally {
      setSearchSaving(false)
    }
  }

  const selectedProviderHint = SEARCH_PROVIDERS.find((p) => p.value === searchProvider)?.hint

  return (
    <div className="flex flex-col h-full p-6 gap-6">
      <div>
        <h1 className="text-xl font-semibold text-white">{t('app.settings.title')}</h1>
        <p className="text-sm text-zinc-500 mt-1">{t('app.settings.subtitle')}</p>
      </div>

      {/* Language settings */}
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

      {/* Search provider settings */}
      <section className="rounded-xl border border-zinc-800 p-5 space-y-4">
        <div>
          <h2 className="text-sm font-medium text-zinc-200">Search Provider</h2>
          <p className="text-sm text-zinc-500 mt-1">
            Configure a search provider to unlock web search, research, and competitor analysis skills.
            Web page fetching works without this — search is for finding new URLs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500">Status:</span>
          {searchConfig?.apiKey ? (
            <span className="rounded-full bg-green-950/50 px-2.5 py-1 text-xs text-green-300">
              Configured ({searchConfig.provider})
            </span>
          ) : (
            <span className="rounded-full bg-zinc-800 px-2.5 py-1 text-xs text-zinc-400">
              Not configured
            </span>
          )}
        </div>

        <div className="space-y-3">
          <label className="block text-xs text-zinc-500">Provider</label>
          <select
            value={searchProvider}
            onChange={(event) => setSearchProvider(event.target.value as SearchProvider)}
            className="w-full max-w-sm bg-zinc-900 border border-zinc-700 focus:border-violet-500 rounded-lg px-3 py-2 text-sm text-zinc-100 outline-none transition-colors"
          >
            <option value="">Select a provider...</option>
            {SEARCH_PROVIDERS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>

          {selectedProviderHint && (
            <p className="text-xs text-zinc-500">{selectedProviderHint}</p>
          )}

          <label className="block text-xs text-zinc-500">API Key</label>
          <input
            type="password"
            value={searchApiKey}
            onChange={(event) => setSearchApiKey(event.target.value)}
            placeholder="Paste your API key here"
            className="w-full max-w-sm bg-zinc-900 border border-zinc-700 focus:border-violet-500 rounded-lg px-3 py-2 text-sm text-zinc-100 outline-none transition-colors"
          />

          <button
            onClick={() => void handleSaveSearch()}
            disabled={searchSaving || !searchProvider || !searchApiKey.trim()}
            className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {searchSaving ? 'Saving...' : 'Save Search Provider'}
          </button>
        </div>

        {searchMessage && (
          <div className="rounded-lg border border-green-900 bg-green-950/40 px-4 py-3 text-sm text-green-300">
            {searchMessage}
          </div>
        )}

        {searchError && (
          <div className="rounded-lg border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-300">
            {searchError}
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
