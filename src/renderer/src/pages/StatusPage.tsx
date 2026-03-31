import React, { useEffect, useState } from 'react'
import { useRuntimeStore } from '../stores/runtimeStore'
import type { RuntimeStatus } from '../api/ipc'
import { useI18n } from '../i18n/I18nProvider'

const STATUS_STYLES: Record<RuntimeStatus, { dot: string; label: string; bg: string }> = {
  STOPPED: { dot: 'bg-muted-foreground', label: 'text-muted-foreground', bg: 'bg-surface-2' },
  STARTING: { dot: 'bg-warning animate-pulse', label: 'text-warning', bg: 'bg-warning/10 border border-warning/25' },
  RUNNING: { dot: 'bg-success', label: 'text-success', bg: 'bg-success/10 border border-success/25' },
  ERROR: { dot: 'bg-danger', label: 'text-danger', bg: 'bg-danger/10 border border-danger/25' },
  UPDATING: { dot: 'bg-primary animate-pulse', label: 'text-primary', bg: 'bg-primary/10 border border-primary/25' },
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
        <h1 className="text-xl font-semibold text-foreground">{t('app.status.runtimeStatus')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('app.status.gatewayProcess')}</p>
      </div>

      {/* Status card */}
      <div className={`cp-card p-6 ${styles.bg}`}>
        <div className="flex items-center gap-3">
          <span className={`w-3 h-3 rounded-full ${styles.dot}`} />
          <span className={`text-lg font-medium ${styles.label}`}>{snapshot.status}</span>
        </div>

        {snapshot.error && (
          <p className="mt-3 text-sm text-danger font-mono bg-danger/10 rounded-xl border border-danger/30 p-3 break-all">
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
        <div className="cp-card p-4 text-sm">
          <p className="text-muted-foreground">
            {t('app.status.gatewayRunningAt')}{' '}
            <span className="font-mono text-success">
              ws://127.0.0.1:{snapshot.port}
            </span>
          </p>
          <p className="text-muted-foreground mt-1">
            {t('app.status.setupState')} <span className="font-mono">{setupLabel}</span>
          </p>
        </div>
      )}

      <div className="cp-card p-5 space-y-4 max-w-3xl">
        <div>
          <h2 className="text-sm font-medium text-foreground">{t('app.status.workspace')}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t('app.status.workspaceHelp')}
          </p>
        </div>

        <div className="space-y-2">
          <label className="block text-xs text-muted-foreground">{t('app.status.activeWorkspaceRoot')}</label>
          <input
            value={workspaceInput}
            onChange={(e) => setWorkspaceInput(e.target.value)}
            className="cp-input"
            placeholder={t('app.status.workspacePlaceholder')}
          />
          <p className="text-xs text-muted-foreground">
            {t('app.status.currentSetupPhase')} <span className="font-mono">{setupLabel}</span>
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => void handleBrowseWorkspace()}
            disabled={workspaceBusy !== null}
            className="cp-btn cp-btn-muted"
          >
            {workspaceBusy === 'browse' ? t('app.status.browsing') : t('app.status.browse')}
          </button>
          <button
            onClick={() => void handleSaveWorkspace()}
            disabled={!workspaceInput.trim() || workspaceBusy !== null || workspaceInput.trim() === snapshot.setup.workspaceRoot}
            className="cp-btn cp-btn-primary"
          >
            {workspaceBusy === 'save' ? t('app.status.applying') : t('app.status.applyWorkspace')}
          </button>
          <button
            onClick={() => void handleResetWorkspace()}
            disabled={workspaceBusy !== null}
            className="cp-btn px-2 bg-transparent text-muted-foreground hover:text-foreground"
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
      <span className="text-muted-foreground">{label}: </span>
      <span className="text-foreground font-mono">{value}</span>
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
  const base = 'cp-btn px-5 py-2.5'
  const colors = {
    green: 'bg-success text-primary-foreground hover:bg-success/90',
    red: 'bg-danger text-danger-foreground hover:bg-danger/90',
    yellow: 'bg-warning text-primary-foreground hover:bg-warning/90',
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
