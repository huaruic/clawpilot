import React, { useState } from 'react'
import { useRuntimeStore } from '../stores/runtimeStore'
import type { RuntimeStatus } from '../api/ipc'
import { useI18n } from '../i18n/I18nProvider'
import { DiagnosticsPanel } from './DiagnosticsPage'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'

const STATUS_STYLES: Record<RuntimeStatus, { dot: string; label: string; tone: string }> = {
  STOPPED: { dot: 'bg-muted-foreground', label: 'text-muted-foreground', tone: 'bg-accent' },
  STARTING: { dot: 'bg-warning animate-pulse', label: 'text-warning', tone: 'bg-warning/10 border-warning/25' },
  RUNNING: { dot: 'bg-success', label: 'text-success', tone: 'bg-success/10 border-success/25' },
  ERROR: { dot: 'bg-danger', label: 'text-danger', tone: 'bg-danger/10 border-danger/25' },
  UPDATING: { dot: 'bg-primary animate-pulse', label: 'text-primary', tone: 'bg-primary/10 border-primary/25' },
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
    <div className="cp-page">
      <div>
        <h1 className="text-xl font-semibold text-foreground">{t('app.status.runtimeStatus')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('app.status.gatewayProcess')}</p>
      </div>

      <Card className={`border ${styles.tone}`}>
        <CardHeader className="pb-0">
          <div className="flex items-center gap-3">
            <span className={`h-3 w-3 rounded-full ${styles.dot}`} />
            <CardTitle className={`text-lg ${styles.label}`}>{presentation.primaryStatusLabel}</CardTitle>
            <Badge variant="secondary" className="font-mono">{setupLabel}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          {presentation.userMessage && (
            <p className="rounded-xl border border-border bg-card/70 p-3 text-sm text-muted-foreground">
              {presentation.userMessage}
            </p>
          )}
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <InfoRow label={t('app.status.mode')} value={setupLabel} />
            <InfoRow label={t('app.status.setupState')} value={setupLabel} />
          </div>
          <div className="flex flex-wrap gap-2">
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
        </CardContent>
      </Card>

      {isRunning && (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">
            {t('app.status.setupState')} <span className="font-mono text-foreground">{setupLabel}</span>
          </CardContent>
        </Card>
      )}

      <Card className="max-w-4xl">
        <CardHeader className="pb-0">
          <button
            onClick={() => setDiagExpanded((prev) => !prev)}
            className="flex w-full items-center justify-between gap-3 text-left"
          >
            <div>
              <CardTitle className="text-sm">{t('app.status.diagnosticsTitle')}</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">{t('app.diagnostics.subtitle')}</p>
            </div>
            <Button variant="secondary" size="sm">
              {diagExpanded ? t('app.status.hideDiagnostics') : t('app.status.showDiagnostics')}
            </Button>
          </button>
        </CardHeader>
        {diagExpanded && (
          <CardContent className="pt-4">
            <DiagnosticsPanel embedded />
          </CardContent>
        )}
      </Card>
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

  if (status === 'ERROR') return { primaryStatusLabel: status, userMessage: t('app.status.errorHint') }
  if (status === 'STOPPED') return { primaryStatusLabel: status, userMessage: t('app.status.stoppedHint') }
  if (status === 'STARTING' || status === 'UPDATING') return { primaryStatusLabel: status, userMessage: t('app.status.startingHint') }
  return { primaryStatusLabel: status, userMessage: error ? t('app.status.runtimeRunningWithWarning') : undefined }
}

function InfoRow({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2">
      <span className="text-muted-foreground">{label}: </span>
      <span className="font-mono text-foreground">{value}</span>
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
  const className = variant === 'green'
    ? 'bg-success text-primary-foreground hover:bg-success/90'
    : variant === 'red'
      ? 'bg-danger text-danger-foreground hover:bg-danger/90'
      : 'bg-warning text-primary-foreground hover:bg-warning/90'

  return (
    <Button onClick={onClick} disabled={disabled || loading} className={className}>
      {loading ? '...' : label}
    </Button>
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
