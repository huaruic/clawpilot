import React, { useEffect, useState } from 'react'
import type { OllamaStatus, ProviderInfo } from '../api/ipc'

const PRESETS = [
  {
    label: 'KIMI (Moonshot)',
    name: 'moonshot',
    baseUrl: 'https://api.moonshot.cn/v1',
    api: 'openai-completions',
    models: [
      { id: 'kimi-k2.5', name: 'Kimi K2.5' },
      { id: 'kimi-k2-0905-preview', name: 'Kimi K2 0905 Preview' },
      { id: 'kimi-k2-turbo-preview', name: 'Kimi K2 Turbo' },
      { id: 'kimi-k2-thinking', name: 'Kimi K2 Thinking' },
      { id: 'kimi-k2-thinking-turbo', name: 'Kimi K2 Thinking Turbo' },
    ],
  },
  {
    label: 'OpenAI',
    name: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    api: 'openai-completions',
    models: [{ id: 'gpt-4o', name: 'GPT-4o' }, { id: 'gpt-4o-mini', name: 'GPT-4o Mini' }],
  },
  {
    label: 'Anthropic',
    name: 'anthropic',
    baseUrl: 'https://api.anthropic.com',
    api: 'anthropic-messages',
    models: [{ id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6' }, { id: 'claude-opus-4-6', name: 'Claude Opus 4.6' }],
  },
  {
    label: 'OpenRouter',
    name: 'openrouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    api: 'openai-completions',
    models: [],
  },
]

interface FormState {
  name: string
  baseUrl: string
  apiKey: string
  api: string
  presetKey: string
}

const EMPTY_FORM: FormState = { name: '', baseUrl: '', apiKey: '', api: 'openai-completions', presetKey: '' }
const OLLAMA_INSTALL_URL = 'https://ollama.com/download'

export function ProvidersPage(): React.ReactElement {
  const [providers, setProviders] = useState<ProviderInfo[]>([])
  const [defaultModel, setDefaultModel] = useState<string>('')
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus | null>(null)
  const [ollamaLoading, setOllamaLoading] = useState(true)
  const [ollamaRefreshing, setOllamaRefreshing] = useState(false)
  const [pullingOllama, setPullingOllama] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [showForm, setShowForm] = useState(false)
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null)

  useEffect(() => {
    void load()
  }, [])

  useEffect(() => {
    if (!pullingOllama && !ollamaStatus?.downloading) return

    const intervalId = window.setInterval(() => {
      void refreshOllamaStatus()
    }, 1000)

    return () => window.clearInterval(intervalId)
  }, [pullingOllama, ollamaStatus?.downloading])

  async function load(): Promise<void> {
    await refreshProviderState()
    await refreshOllamaStatus({ initial: true })
  }

  async function refreshProviderState(): Promise<void> {
    const [list, current] = await Promise.all([
      window.clawpilot.provider.list(),
      window.clawpilot.provider.getDefault(),
    ])
    setProviders(list)
    setDefaultModel(current)
  }

  async function refreshOllamaStatus(options?: { initial?: boolean }): Promise<void> {
    if (options?.initial) {
      setOllamaLoading(true)
    } else {
      setOllamaRefreshing(true)
    }
    const status = await window.clawpilot.ollama.status()
    setOllamaStatus(status)
    setPullingOllama(status.downloading)
    if (status.recommendedInstalled) {
      await refreshProviderState()
    }
    if (options?.initial) {
      setOllamaLoading(false)
    } else {
      setOllamaRefreshing(false)
    }
  }

  async function handleSetDefault(model: string): Promise<void> {
    setDefaultModel(model)
    await window.clawpilot.provider.setDefault(model)
  }

  function applyPreset(label: string): void {
    const p = PRESETS.find((x) => x.label === label)
    if (!p) return
    setForm((f) => ({
      ...f,
      name: p.name,
      baseUrl: p.baseUrl,
      api: p.api,
      presetKey: label,
    }))
  }

  async function handleTest(): Promise<void> {
    if (!form.baseUrl || !form.apiKey) return
    setTesting(true)
    setTestResult(null)
    const res = await window.clawpilot.provider.test({ baseUrl: form.baseUrl, apiKey: form.apiKey })
    setTesting(false)
    if (res.ok) {
      setTestResult({ ok: true, msg: `Connected · ${res.models?.slice(0, 3).join(', ')}` })
    } else {
      setTestResult({ ok: false, msg: res.error ?? `HTTP ${res.status}` })
    }
  }

  async function handleSave(): Promise<void> {
    if (!form.name || !form.baseUrl || !form.apiKey) return
    setSaving(true)
    const preset = PRESETS.find((p) => p.label === form.presetKey)
    await window.clawpilot.provider.save({
      name: form.name,
      baseUrl: form.baseUrl,
      apiKey: form.apiKey,
      api: form.api || undefined,
      models: preset?.models,
    })
    setSaving(false)
    setShowForm(false)
    setForm(EMPTY_FORM)
    setTestResult(null)
    await load()
  }

  async function handleDelete(name: string): Promise<void> {
    await window.clawpilot.provider.delete(name)
    await load()
  }

  async function handlePullOllama(): Promise<void> {
    setPullingOllama(true)
    await refreshOllamaStatus()
    try {
      const result = await window.clawpilot.ollama.pullRecommended()
      if (!result.ok) {
        setPullingOllama(false)
      }
    } finally {
      setPullingOllama(false)
      await load()
    }
  }

  async function handleOpenInstallPage(): Promise<void> {
    await window.clawpilot.ollama.openInstallPage()
  }

  const ollamaProvider = providers.find((provider) => provider.name === 'ollama')

  return (
    <div className="flex flex-col h-full p-6 gap-5 overflow-y-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Providers</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Configure remote APIs and local fallback models</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setTestResult(null) }}
          className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          + Add Provider
        </button>
      </div>

      {/* Current Model selector */}
      {providers.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 flex items-center gap-3">
          <span className="text-xs text-zinc-500 shrink-0">Current Model</span>
          <select
            value={defaultModel}
            onChange={(e) => void handleSetDefault(e.target.value)}
            className="flex-1 bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm rounded-lg px-2 py-1 outline-none focus:border-violet-500 transition-colors"
          >
            {defaultModel === '' && <option value="">— not set —</option>}
            {providers.flatMap((p) =>
              p.models.length > 0
                ? p.models.map((m) => (
                    <option key={`${p.name}/${m.id}`} value={`${p.name}/${m.id}`}>
                      {p.name} / {m.name ?? m.id}
                    </option>
                  ))
                : [<option key={p.name} value={p.name}>{p.name}</option>]
            )}
          </select>
        </div>
      )}

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-medium text-zinc-200">Local / Ollama</h2>
            <p className="text-sm text-zinc-500 mt-1">
              Optional fallback model for offline or degraded network cases.
            </p>
          </div>
          <span className="text-xs px-2 py-1 bg-zinc-800 text-zinc-400 rounded-md font-mono">
            qwen2.5:7b
          </span>
        </div>

        {ollamaLoading || !ollamaStatus ? (
          <div className="text-sm text-zinc-500">Checking local Ollama runtime…</div>
        ) : (
          <>
            <div className="grid gap-2 sm:grid-cols-3">
              <StatusPill label="Runtime" value={ollamaStatus.running ? 'Reachable' : 'Unavailable'} ok={ollamaStatus.running} />
              <StatusPill
                label="Model"
                value={ollamaStatus.recommendedInstalled ? 'Ready' : 'Missing'}
                ok={ollamaStatus.recommendedInstalled}
              />
              <StatusPill label="Known Models" value={String(ollamaStatus.availableModels.length)} ok={ollamaStatus.availableModels.length > 0} />
            </div>

            {!ollamaStatus.running && (
              <div className="rounded-lg border border-amber-900 bg-amber-950/40 px-4 py-3 space-y-3">
                <p className="text-sm text-amber-300">
                  ClawPilot could not reach Ollama at <span className="font-mono">http://127.0.0.1:11434</span>.
                  Install Ollama if needed, open it so the local API is running, then retry detection here.
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => void handleOpenInstallPage()}
                    className="px-4 py-2 text-sm bg-amber-500 hover:bg-amber-400 text-zinc-950 rounded-lg transition-colors"
                  >
                    Open install page
                  </button>
                  <button
                    onClick={() => void refreshOllamaStatus()}
                    className="px-4 py-2 text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-100 rounded-lg transition-colors"
                  >
                    Retry detection
                  </button>
                  <a href={OLLAMA_INSTALL_URL} target="_blank" rel="noreferrer" className="text-sm text-amber-200 underline underline-offset-2">
                    Ollama docs
                  </a>
                </div>
              </div>
            )}

            {ollamaStatus.running && !ollamaStatus.recommendedInstalled && (
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => void handlePullOllama()}
                  disabled={pullingOllama || ollamaStatus.downloading}
                  className="px-4 py-2 text-sm bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white rounded-lg transition-colors"
                >
                  {pullingOllama || ollamaStatus.downloading ? 'Downloading…' : 'Download qwen2.5:7b'}
                </button>
                <p className="text-sm text-zinc-500">
                  This uses Ollama&apos;s local API and only adds the model as an optional provider. It will not replace your current default model.
                </p>
              </div>
            )}

            {ollamaStatus.running && !ollamaStatus.recommendedInstalled && (ollamaStatus.downloading || ollamaStatus.downloadProgress > 0) && (
              <div className="space-y-2">
                <div className="h-2 overflow-hidden rounded-full bg-violet-950/60">
                  <div
                    className="h-full rounded-full bg-violet-500 transition-[width] duration-300"
                    style={{ width: `${Math.max(4, ollamaStatus.downloadProgress)}%` }}
                  />
                </div>
                <p className="text-xs text-violet-300">
                  Model download progress: {ollamaStatus.downloadProgress}%
                </p>
              </div>
            )}

            {ollamaStatus.running && ollamaStatus.recommendedInstalled && (
              <div className="rounded-lg border border-green-900 bg-green-950/40 px-4 py-3 text-sm text-green-300">
                qwen2.5:7b is ready in Ollama.
                {ollamaProvider
                  ? ' Select ollama / Qwen 2.5 7B from Current Model above when you want to use it.'
                  : ' Refreshing provider configuration…'}
              </div>
            )}

            {(ollamaStatus.downloadLog.length > 0 || ollamaStatus.error) && (
              <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">Ollama Activity</span>
                  <div className="flex items-center gap-3">
                    {ollamaRefreshing && <span className="text-xs text-zinc-500">Refreshing…</span>}
                    {ollamaStatus.downloading && <span className="text-xs text-violet-400">Download in progress</span>}
                  </div>
                </div>
                {ollamaStatus.error && (
                  <p className="text-sm text-red-400">{ollamaStatus.error}</p>
                )}
                {ollamaStatus.downloadLog.length > 0 && (
                  <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap break-words text-xs leading-5 text-zinc-300">
                    {ollamaStatus.downloadLog.slice(-12).join('\n')}
                  </pre>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Add form */}
      {showForm && (
        <div className="bg-zinc-900 rounded-xl border border-zinc-700 p-5 space-y-4">
          <h2 className="text-sm font-medium text-zinc-200">New Provider</h2>

          {/* Presets */}
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => applyPreset(p.label)}
                className={`px-3 py-1 rounded-lg text-xs border transition-colors ${
                  form.presetKey === p.label
                    ? 'bg-violet-600 border-violet-600 text-white'
                    : 'border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Name" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} placeholder="e.g. kimi" />
            <Field label="API" value={form.api} onChange={(v) => setForm((f) => ({ ...f, api: v }))} placeholder="openai-completions" />
            <Field label="Base URL" value={form.baseUrl} onChange={(v) => setForm((f) => ({ ...f, baseUrl: v }))} placeholder="https://api.moonshot.cn/v1" className="col-span-2" />
            <Field label="API Key" value={form.apiKey} onChange={(v) => setForm((f) => ({ ...f, apiKey: v }))} placeholder="sk-..." type="password" className="col-span-2" />
          </div>

          {testResult && (
            <p className={`text-xs px-3 py-2 rounded-lg ${testResult.ok ? 'bg-green-950 text-green-400' : 'bg-red-950 text-red-400'}`}>
              {testResult.ok ? '✓ ' : '✗ '}{testResult.msg}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={() => void handleTest()}
              disabled={!form.baseUrl || !form.apiKey || testing}
              className="px-4 py-2 text-sm bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-200 rounded-lg transition-colors"
            >
              {testing ? 'Testing…' : 'Test'}
            </button>
            <button
              onClick={() => void handleSave()}
              disabled={!form.name || !form.baseUrl || !form.apiKey || saving}
              className="px-4 py-2 text-sm bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white rounded-lg transition-colors"
            >
              {saving ? 'Saving…' : 'Save & Restart'}
            </button>
            <button
              onClick={() => { setShowForm(false); setForm(EMPTY_FORM); setTestResult(null) }}
              className="px-4 py-2 text-sm text-zinc-500 hover:text-zinc-300 transition-colors ml-auto"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Provider list */}
      {providers.length === 0 && !showForm && (
        <div className="flex flex-col items-center justify-center flex-1 text-center">
          <p className="text-zinc-400">No providers configured</p>
          <p className="text-zinc-600 text-sm mt-1">Add an API key to start chatting</p>
        </div>
      )}

      <div className="space-y-2">
        {providers.map((p) => (
          <div key={p.name} className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-zinc-200">{p.name}</p>
              <p className="text-xs text-zinc-500 truncate mt-0.5">{p.baseUrl}</p>
            </div>
            {p.api && (
              <span className="text-xs px-2 py-0.5 bg-zinc-800 text-zinc-400 rounded-md font-mono">{p.api}</span>
            )}
            {p.name !== 'ollama' && (
              <button
                onClick={() => void handleDelete(p.name)}
                className="text-xs text-red-500 hover:text-red-400 transition-colors px-2"
              >
                Delete
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function StatusPill({ label, value, ok }: { label: string; value: string; ok: boolean }): React.ReactElement {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className={`text-sm mt-1 ${ok ? 'text-green-400' : 'text-zinc-300'}`}>{value}</p>
    </div>
  )
}

function Field({
  label, value, onChange, placeholder, type = 'text', className = '',
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; className?: string
}): React.ReactElement {
  return (
    <div className={className}>
      <label className="block text-xs text-zinc-500 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-zinc-800 border border-zinc-700 focus:border-violet-500 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition-colors"
      />
    </div>
  )
}
