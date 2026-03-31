import React, { useState } from 'react'
import { useRuntimeStore } from '../stores/runtimeStore'
import type { RuntimeStatus } from '../api/ipc'
import { useI18n } from '../i18n/I18nProvider'
import { DiagnosticsPanel } from './DiagnosticsPage'

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
  const [diagExpanded, setDiagExpanded] = useState(false)
  const styles = STATUS_STYLES[snapshot.status]
  const setupLabel = describeSetup(snapshot.setup.phase, t)
  const presentation = toRuntimePresentation(snapshot.status, snapshot.healthStatus, snapshot.error, t)

  async function handleAction(action: 'start' | 'stop' | 'restart'): Promise<void> {
    setLoading(action)
    try {
      await window.clawpilot.app[action]()
    } finally {
      setLoading(null)
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
          <span className={`text-lg font-medium ${styles.label}`}>{presentation.primaryStatusLabel}</span>
        </div>

        {presentation.userMessage && (
          <p className="mt-3 text-sm text-muted-foreground bg-surface/70 rounded-xl border border-border p-3">
            {presentation.userMessage}
          </p>
        )}

        <div className="mt-4 grid grid-cols-1 gap-3 text-sm">
          <InfoRow label={t('app.status.mode')} value={setupLabel} />
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
          <p className="text-muted-foreground mt-1">
            {t('app.status.setupState')} <span className="font-mono">{setupLabel}</span>
          </p>
        </div>
      )}

      <div className="cp-card p-5 space-y-3 max-w-3xl">
        <button
          onClick={() => setDiagExpanded((prev) => !prev)}
          className="w-full flex items-center justify-between text-left"
        >
          <div>
            <h2 className="text-sm font-medium text-foreground">{t('app.status.diagnosticsTitle')}</h2>
            <p className="text-xs text-muted-foreground mt-1">{t('app.diagnostics.subtitle')}</p>
          </div>
          <span className="cp-btn cp-btn-muted">{diagExpanded ? t('app.status.hideDiagnostics') : t('app.status.showDiagnostics')}</span>
        </button>

        {diagExpanded && (
          <DiagnosticsPanel embedded />
        )}
      </div>
    </div>
  )
}

type RuntimePresentation = {
  primaryStatusLabel: string
  userMessage?: string
}

function toRuntimePresentation(
  status: RuntimeStatus,
  healthStatus: 'ok' | 'degraded' | 'error' | undefined,
  error: string | undefined,
  t: (key: string) => string,
): RuntimePresentation {
  void healthStatus

  if (status === 'ERROR') {
    return {
      primaryStatusLabel: status,
      userMessage: t('app.status.errorHint'),
    }
  }

  if (status === 'STOPPED') {
    return {
      primaryStatusLabel: status,
      userMessage: t('app.status.stoppedHint'),
    }
  }

  if (status === 'STARTING' || status === 'UPDATING') {
    return {
      primaryStatusLabel: status,
      userMessage: t('app.status.startingHint'),
    }
  }

  return {
    primaryStatusLabel: status,
    userMessage: error ? t('app.status.runtimeRunningWithWarning') : undefined,
  }
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
