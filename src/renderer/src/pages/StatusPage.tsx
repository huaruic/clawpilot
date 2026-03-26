import React, { useEffect, useState } from 'react'
import { useRuntimeStore } from '../stores/runtimeStore'
import type { RuntimeStatus } from '../api/ipc'
import { useI18n } from '../i18n/I18nProvider'

const STATUS_STYLES: Record<RuntimeStatus, { dot: string; label: string; bg: string }> = {
  STOPPED: { dot: 'bg-zinc-500', label: 'text-zinc-400', bg: 'bg-zinc-900' },
  STARTING: { dot: 'bg-yellow-500 animate-pulse', label: 'text-yellow-400', bg: 'bg-yellow-950' },
  RUNNING: { dot: 'bg-green-500', label: 'text-green-400', bg: 'bg-green-950' },
  ERROR: { dot: 'bg-red-500', label: 'text-red-400', bg: 'bg-red-950' },
  UPDATING: { dot: 'bg-blue-500 animate-pulse', label: 'text-blue-400', bg: 'bg-blue-950' },
}

export function StatusPage(): React.ReactElement {
  const { snapshot } = useRuntimeStore()
  const { t } = useI18n()
  const [loading, setLoading] = useState<'start' | 'stop' | 'restart' | null>(null)
  const [workspaceInput, setWorkspaceInput] = useState('')
  const [workspaceBusy, setWorkspaceBusy] = useState<'browse' | 'save' | 'reset' | null>(null)
  const styles = STATUS_STYLES[snapshot.status]
  const setupLabel = describeSetup(snapshot.setup.phase, t)

  useEffect(() => {
    setWorkspaceInput(snapshot.setup.workspaceRoot)
  }, [snapshot.setup.workspaceRoot])

  async function handleAction(action: 'start' | 'stop' | 'restart'): Promise<void> {
    setLoading(action)
    try {
      await window.clawpilot.app[action]()
    } finally {
      setLoading(null)
    }
  }

  async function handleBrowseWorkspace(): Promise<void> {
    setWorkspaceBusy('browse')
    try {
      const selected = await window.clawpilot.app.chooseWorkspaceRoot()
      if (selected) {
        setWorkspaceInput(selected)
      }
    } finally {
      setWorkspaceBusy(null)
    }
  }

  async function handleSaveWorkspace(): Promise<void> {
    setWorkspaceBusy('save')
    try {
      await window.clawpilot.app.setWorkspaceRoot(workspaceInput)
    } finally {
      setWorkspaceBusy(null)
    }
  }

  async function handleResetWorkspace(): Promise<void> {
    setWorkspaceBusy('reset')
    try {
      await window.clawpilot.app.resetWorkspaceRoot()
    } finally {
      setWorkspaceBusy(null)
    }
  }

  const isRunning = snapshot.status === 'RUNNING'
  const isStopped = snapshot.status === 'STOPPED' || snapshot.status === 'ERROR'
  const isBusy = snapshot.status === 'STARTING' || snapshot.status === 'UPDATING' || loading !== null

  return (
    <div className="flex flex-col h-full p-6 gap-6">
      <div>
        <h1 className="text-xl font-semibold text-white">{t('app.status.runtimeStatus')}</h1>
        <p className="text-sm text-zinc-500 mt-1">{t('app.status.gatewayProcess')}</p>
      </div>

      {/* Status card */}
      <div className={`rounded-xl border border-zinc-800 p-6 ${styles.bg}`}>
        <div className="flex items-center gap-3">
          <span className={`w-3 h-3 rounded-full ${styles.dot}`} />
          <span className={`text-lg font-medium ${styles.label}`}>{snapshot.status}</span>
        </div>

        {snapshot.error && (
          <p className="mt-3 text-sm text-red-400 font-mono bg-red-950/50 rounded p-3 break-all">
            {snapshot.error}
          </p>
        )}

        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <InfoRow label={t('app.status.port')} value={String(snapshot.port)} />
          <InfoRow label={t('app.status.mode')} value={setupLabel} />
          {snapshot.pid && <InfoRow label={t('app.status.pid')} value={String(snapshot.pid)} />}
          {snapshot.startedAt && (
            <InfoRow
              label={t('app.status.started')}
              value={new Date(snapshot.startedAt).toLocaleTimeString()}
            />
          )}
          {snapshot.startedAt && (
            <InfoRow
              label={t('app.status.uptime')}
              value={formatUptime(Date.now() - snapshot.startedAt)}
            />
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <ActionButton
          label={t('app.status.start')}
          onClick={() => handleAction('start')}
          disabled={!isStopped || isBusy}
          loading={loading === 'start'}
          variant="green"
        />
        <ActionButton
          label={t('app.status.stop')}
          onClick={() => handleAction('stop')}
          disabled={!isRunning || isBusy}
          loading={loading === 'stop'}
          variant="red"
        />
        <ActionButton
          label={t('app.status.restart')}
          onClick={() => handleAction('restart')}
          disabled={!isRunning || isBusy}
          loading={loading === 'restart'}
          variant="yellow"
        />
      </div>

      {/* Gateway info */}
      {isRunning && (
        <div className="rounded-xl border border-zinc-800 p-4 text-sm">
          <p className="text-zinc-400">
            {t('app.status.gatewayRunningAt')}{' '}
            <span className="font-mono text-green-400">
              ws://127.0.0.1:{snapshot.port}
            </span>
          </p>
          <p className="text-zinc-500 mt-1">
            {t('app.status.setupState')} <span className="font-mono">{setupLabel}</span>
          </p>
        </div>
      )}

      <div className="rounded-xl border border-zinc-800 p-5 space-y-4">
        <div>
          <h2 className="text-sm font-medium text-zinc-200">{t('app.status.workspace')}</h2>
          <p className="text-sm text-zinc-500 mt-1">
            {t('app.status.workspaceHelp')}
          </p>
        </div>

        <div className="space-y-2">
          <label className="block text-xs text-zinc-500">{t('app.status.activeWorkspaceRoot')}</label>
          <input
            value={workspaceInput}
            onChange={(e) => setWorkspaceInput(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-700 focus:border-violet-500 rounded-lg px-3 py-2 text-sm text-zinc-100 outline-none transition-colors"
            placeholder={t('app.status.workspacePlaceholder')}
          />
          <p className="text-xs text-zinc-600">
            {t('app.status.currentSetupPhase')} <span className="font-mono">{setupLabel}</span>
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => void handleBrowseWorkspace()}
            disabled={workspaceBusy !== null}
            className="px-4 py-2 text-sm bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-100 rounded-lg transition-colors"
          >
            {workspaceBusy === 'browse' ? t('app.status.browsing') : t('app.status.browse')}
          </button>
          <button
            onClick={() => void handleSaveWorkspace()}
            disabled={!workspaceInput.trim() || workspaceBusy !== null || workspaceInput.trim() === snapshot.setup.workspaceRoot}
            className="px-4 py-2 text-sm bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white rounded-lg transition-colors"
          >
            {workspaceBusy === 'save' ? t('app.status.applying') : t('app.status.applyWorkspace')}
          </button>
          <button
            onClick={() => void handleResetWorkspace()}
            disabled={workspaceBusy !== null}
            className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 disabled:opacity-40 transition-colors"
          >
            {workspaceBusy === 'reset' ? t('app.status.resetting') : t('app.status.useDefaultWorkspace')}
          </button>
        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div>
      <span className="text-zinc-500">{label}: </span>
      <span className="text-zinc-200 font-mono">{value}</span>
    </div>
  )
}

function ActionButton({
  label,
  onClick,
  disabled,
  loading,
  variant,
}: {
  label: string
  onClick: () => void
  disabled: boolean
  loading: boolean
  variant: 'green' | 'red' | 'yellow'
}): React.ReactElement {
  const base = 'px-5 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed'
  const colors = {
    green: 'bg-green-600 hover:bg-green-500 text-white',
    red: 'bg-red-600 hover:bg-red-500 text-white',
    yellow: 'bg-yellow-600 hover:bg-yellow-500 text-white',
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`${base} ${colors[variant]}`}
    >
      {loading ? '...' : label}
    </button>
  )
}

function formatUptime(ms: number): string {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  if (h > 0) return `${h}h ${m % 60}m`
  if (m > 0) return `${m}m ${s % 60}s`
  return `${s}s`
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
