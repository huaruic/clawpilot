import React, { useEffect, useMemo, useState } from 'react'
import type { FeishuConfigInfo, FeishuPairingRequest, FeishuValidationInfo } from '../api/ipc'
import { useRuntimeStore } from '../stores/runtimeStore'

interface SaveResult {
  ok: boolean
  runtimeRestarted: boolean
}

interface ResetResult {
  ok: boolean
  runtimeRestarted: boolean
}

function getChannelsApi(): Window['clawpilot']['channels'] {
  const api = window.clawpilot?.channels
  if (!api) {
    throw new Error('Channels API is not available. Restart ClawPilot to load the latest preload bridge.')
  }
  return api
}

export function ChannelsPage(): React.ReactElement {
  const { snapshot } = useRuntimeStore()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [validating, setValidating] = useState(false)
  const [approving, setApproving] = useState(false)
  const [config, setConfig] = useState<FeishuConfigInfo | null>(null)
  const [appId, setAppId] = useState('')
  const [appSecret, setAppSecret] = useState('')
  const [botOpenId, setBotOpenId] = useState('')
  const [botName, setBotName] = useState('')
  const [pairingCode, setPairingCode] = useState('')
  const [pairingRequest, setPairingRequest] = useState<FeishuPairingRequest | null>(null)
  const [pairingApproved, setPairingApproved] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const statusLabel = useMemo(() => {
    if (loading) return 'Loading Feishu configuration...'
    if (resetting) return 'Resetting Feishu channel...'
    if (validating) return 'Validating Feishu credentials...'
    if (saving) return 'Saving Feishu configuration...'
    if (approving) return 'Approving Pairing Code...'
    if (pairingApproved) return 'Feishu is ready'
    if (config?.enabled) return 'Waiting for Pairing Code'
    return 'Feishu is optional'
  }, [approving, config?.enabled, loading, pairingApproved, resetting, saving, validating])

  useEffect(() => {
    void loadConfig()
  }, [])

  useEffect(() => {
    if (!config?.enabled || pairingApproved) return

    void loadLatestPairing()
    const timer = window.setInterval(() => {
      void loadLatestPairing()
    }, 4000)

    return () => window.clearInterval(timer)
  }, [config?.enabled, pairingApproved])

  async function loadConfig(): Promise<void> {
    setLoading(true)
    setError(null)
    try {
      const data = await getChannelsApi().getFeishuConfig()
      setConfig(data)
      setAppId(data.appId)
      setAppSecret(data.appSecret)
      setPairingApproved(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  async function loadLatestPairing(): Promise<void> {
    const data = await getChannelsApi().getLatestPairing()
    if (!data.ok) return

    const request = data.request ?? null
    setPairingRequest(request)
    if (request?.code) {
      setPairingCode((current) => current || request.code)
      if (!pairingApproved && !approving) {
        await handleApprovePairing(request.code, true)
      }
    }
  }

  async function handleSave(): Promise<void> {
    setValidating(true)
    setSaving(true)
    setError(null)
    setMessage(null)
    setPairingApproved(false)
    setPairingRequest(null)
    setBotOpenId('')
    setBotName('')

    try {
      const validation = await getChannelsApi().validateFeishuCredentials({
        appId: appId.trim(),
        appSecret: appSecret.trim(),
      }) as FeishuValidationInfo
      if (!validation.ok) {
        setError(validation.error ?? 'Failed to validate Feishu credentials')
        return
      }

      setBotOpenId(validation.botOpenId ?? '')
      setBotName(validation.botName ?? '')
      setValidating(false)

      const result = await getChannelsApi().saveFeishuConfig({
        appId: appId.trim(),
        appSecret: appSecret.trim(),
      }) as SaveResult
      await loadConfig()
      setMessage(
        result.runtimeRestarted
          ? 'Feishu configuration saved. Gateway restarted. Go to Feishu and send any message to the bot.'
          : 'Feishu configuration saved. Start the runtime, then go to Feishu and send any message to the bot.',
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setValidating(false)
      setSaving(false)
    }
  }

  function resetLocalFeishuState(): void {
    setConfig(null)
    setAppId('')
    setAppSecret('')
    setBotOpenId('')
    setBotName('')
    setPairingCode('')
    setPairingRequest(null)
    setPairingApproved(false)
  }

  async function handleReset(): Promise<void> {
    const confirmed = window.confirm(
      'Reset Feishu channel? This will remove Feishu credentials, clear pending pairing requests, and forget approved Feishu senders.',
    )
    if (!confirmed) return

    setResetting(true)
    setError(null)
    setMessage(null)

    try {
      const result = await getChannelsApi().resetFeishu() as ResetResult
      resetLocalFeishuState()
      await loadConfig()
      setMessage(
        result.runtimeRestarted
          ? 'Feishu channel reset. Gateway restarted.'
          : 'Feishu channel reset.',
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setResetting(false)
    }
  }

  async function handleApprovePairing(codeOverride?: string, silent = false): Promise<void> {
    const code = (codeOverride ?? pairingCode).trim().toUpperCase()
    if (!code) {
      if (!silent) setError('Enter the Pairing Code from Feishu.')
      return
    }

    setApproving(true)
    if (!silent) {
      setError(null)
      setMessage(null)
    }

    try {
      const data = await getChannelsApi().approvePairing({ code })
      if (!data.ok) {
        if (!silent) setError(data.error ?? 'Failed to approve Pairing Code')
        return
      }

      setPairingCode(code)
      setPairingApproved(true)
      setMessage(data.message ?? 'Pairing approved.')
      setPairingRequest(null)
    } catch (err) {
      if (!silent) setError(err instanceof Error ? err.message : String(err))
    } finally {
      setApproving(false)
    }
  }

  return (
    <div className="flex flex-col h-full p-6 gap-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Channels</h1>
        <p className="text-sm text-zinc-500 mt-1">Connect IM channels to the local OpenClaw runtime.</p>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 space-y-6 max-w-3xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-medium text-zinc-100">Feishu</h2>
            <p className="text-sm text-zinc-500 mt-1">
              Connect a Feishu bot through OpenClaw&apos;s WebSocket channel integration.
            </p>
          </div>
          <span className="px-3 py-1 rounded-full text-xs bg-zinc-800 text-zinc-300">
            {statusLabel}
          </span>
        </div>

        {message && (
          <div className="rounded-lg border border-green-900 bg-green-950/40 px-4 py-3 text-sm text-green-300">
            {message}
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <div className="text-sm font-medium text-zinc-200">Step 1. Connect your Feishu app</div>
            <p className="mt-1 text-sm text-zinc-500">
              Enter the App ID and App Secret from the Feishu Open Platform. First version uses WebSocket mode only.
            </p>
          </div>

          <label className="block">
            <span className="text-sm font-medium text-zinc-200">App ID</span>
            <input
              value={appId}
              onChange={(event) => setAppId(event.target.value)}
              placeholder="cli_xxx"
              className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none transition-colors focus:border-violet-500"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-zinc-200">App Secret</span>
            <input
              type="password"
              value={appSecret}
              onChange={(event) => setAppSecret(event.target.value)}
              placeholder="Paste the Feishu App Secret"
              className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none transition-colors focus:border-violet-500"
            />
          </label>

          <div className="flex items-center gap-3">
            <button
              onClick={() => void handleSave()}
              disabled={saving || resetting || !appId.trim() || !appSecret.trim()}
              className="px-4 py-2.5 text-sm bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white rounded-xl transition-colors"
            >
              {saving ? 'Saving...' : config?.enabled ? 'Reconnect Feishu' : 'Connect Feishu'}
            </button>
            <span className="text-xs text-zinc-500">
              Runtime: {snapshot.status}
            </span>
          </div>
        </div>

        {config?.enabled && (
          <div className="border-t border-red-950 pt-6 space-y-3">
            <div>
              <div className="text-sm font-medium text-red-300">Danger Zone</div>
              <p className="mt-1 text-sm text-zinc-500">
                Reset removes Feishu credentials, clears pending Pairing Codes, and forgets approved Feishu senders.
              </p>
            </div>

            <button
              onClick={() => void handleReset()}
              disabled={resetting || saving || validating || approving}
              className="px-4 py-2.5 text-sm bg-red-700 hover:bg-red-600 disabled:opacity-40 text-white rounded-xl transition-colors"
            >
              {resetting ? 'Resetting...' : 'Reset Feishu Channel'}
            </button>
          </div>
        )}

        <div className="border-t border-zinc-800 pt-6 space-y-4">
          <div>
            <div className="text-sm font-medium text-zinc-200">Step 2. Pair your private chat</div>
            <p className="mt-1 text-sm text-zinc-500">
              After configuration, go to Feishu, open a private chat with the bot, send any message, then approve the Pairing Code here if auto-approve does not finish it.
            </p>
          </div>

          {config?.enabled && botOpenId && !pairingApproved && (
            <a
              href={`https://applink.feishu.cn/client/chat/open?openId=${encodeURIComponent(botOpenId)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm text-white hover:bg-sky-500 transition-colors"
            >
              Open {botName || 'Feishu bot'} chat
            </a>
          )}

          {config?.enabled && !pairingApproved && !pairingRequest && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-400">
              Waiting for you to send a message to the bot in Feishu...
            </div>
          )}

          {pairingRequest && !pairingApproved && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-300">
              Latest Pairing Code detected: <span className="font-mono">{pairingRequest.code}</span>
            </div>
          )}

          <label className="block">
            <span className="text-sm font-medium text-zinc-200">Pairing Code</span>
            <input
              value={pairingCode}
              onChange={(event) => setPairingCode(event.target.value.toUpperCase())}
              disabled={!config?.enabled || pairingApproved}
              placeholder="STNL5CC2"
              className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none transition-colors focus:border-violet-500 disabled:opacity-50"
            />
          </label>

          <div className="flex items-center gap-3">
            <button
              onClick={() => void handleApprovePairing()}
              disabled={!config?.enabled || approving || pairingApproved}
              className="px-4 py-2.5 text-sm bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-100 rounded-xl transition-colors"
            >
              {approving ? 'Approving...' : pairingApproved ? 'Feishu Ready' : 'Approve Pairing Code'}
            </button>
            <button
              onClick={() => void loadLatestPairing()}
              disabled={!config?.enabled || approving}
              className="px-4 py-2.5 text-sm bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 text-zinc-300 rounded-xl border border-zinc-800 transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
