import React, { useMemo, useState } from 'react'
import type { DiagnosticIssue, DiagnosticReport } from '../api/ipc'
import { useI18n } from '../i18n/I18nProvider'

type SeverityFilter = 'all' | 'error' | 'warning' | 'info'

const CATEGORY_KEY: Record<DiagnosticIssue['category'], string> = {
  runtime: 'app.diagnostics.categoryRuntime',
  provider: 'app.diagnostics.categoryProviders',
  channel: 'app.diagnostics.categoryChannels',
  skill: 'app.diagnostics.categorySkills',
  config: 'app.diagnostics.categoryConfig',
  workspace: 'app.diagnostics.categoryWorkspace',
}

const SEVERITY_STYLE: Record<DiagnosticIssue['severity'], string> = {
  error: 'text-danger border-danger/30 bg-danger/10',
  warning: 'text-warning border-warning/30 bg-warning/10',
  info: 'text-muted-foreground border-border bg-surface-2',
}

export function DiagnosticsPage(): React.ReactElement {
  return (
    <div className="h-full overflow-y-auto p-8">
      <DiagnosticsPanel embedded={false} />
    </div>
  )
}

export function DiagnosticsPanel({ embedded }: { embedded: boolean }): React.ReactElement {
  const { t, resolvedLanguage } = useI18n()
  const [report, setReport] = useState<DiagnosticReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [fixingIssue, setFixingIssue] = useState<string | null>(null)
  const [runError, setRunError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [filter, setFilter] = useState<SeverityFilter>('all')

  const runDiagnostics = async (): Promise<void> => {
    setLoading(true)
    setRunError(null)
    setFeedback(null)
    try {
      const next = await window.clawpilot.diagnostics.run()
      setReport(next)
    } catch (error) {
      setRunError(error instanceof Error ? error.message : String(error))
    } finally {
      setLoading(false)
    }
  }

  const handleFix = async (issue: DiagnosticIssue): Promise<void> => {
    setFixingIssue(issue.title)
    setFeedback(null)
    try {
      const result = await window.clawpilot.diagnostics.fix(issue)
      setFeedback({
        type: result.success ? 'success' : 'error',
        text: result.success ? result.message : `${result.message}${result.output ? `: ${result.output}` : ''}`,
      })
      if (result.success) {
        await runDiagnostics()
      }
    } catch (error) {
      setFeedback({ type: 'error', text: error instanceof Error ? error.message : String(error) })
    } finally {
      setFixingIssue(null)
    }
  }

  const handleExport = async (): Promise<void> => {
    if (!report) return
    setExporting(true)
    setFeedback(null)
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const outputPath = await window.clawpilot.app.showSaveDialog({
        title: 'Export Diagnostics Bundle',
        defaultPath: `clawpilot-diagnostics-${timestamp}.json`,
        filters: [{ name: 'JSON', extensions: ['json'] }],
      })
      if (!outputPath) return
      await window.clawpilot.diagnostics.exportBundle({ outputPath })
      setFeedback({ type: 'success', text: `${t('app.diagnostics.exportedTo')} ${outputPath}` })
    } catch (error) {
      setFeedback({ type: 'error', text: error instanceof Error ? error.message : String(error) })
    } finally {
      setExporting(false)
    }
  }

  const filteredIssues = useMemo(() => {
    const issues = report?.issues ?? []
    return filter === 'all' ? issues : issues.filter((issue) => issue.severity === filter)
  }, [report, filter])

  const categorySummaries = useMemo(() => {
    const issues = report?.issues ?? []
    return (Object.keys(CATEGORY_KEY) as Array<DiagnosticIssue['category']>).map((category) => {
      const bucket = issues.filter((issue) => issue.category === category)
      const errorCount = bucket.filter((issue) => issue.severity === 'error').length
      const warningCount = bucket.filter((issue) => issue.severity === 'warning').length
      const infoCount = bucket.filter((issue) => issue.severity === 'info').length
      const state = errorCount > 0 ? 'error' : warningCount > 0 ? 'warning' : infoCount > 0 ? 'info' : 'healthy'
      return { category, state, count: bucket.length }
    })
  }, [report])

  const overallTone =
    report?.overallStatus === 'error'
      ? 'text-danger border-danger/30 bg-danger/10'
      : report?.overallStatus === 'warning'
        ? 'text-warning border-warning/30 bg-warning/10'
        : 'text-success border-success/30 bg-success/10'
  const locale = resolvedLanguage === 'zh-CN' ? 'zh-CN' : 'en-US'

  return (
    <section className={embedded ? 'space-y-6' : 'cp-card p-6 space-y-6'}>
        {!embedded && (
          <header className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">{t('app.diagnostics.title')}</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {t('app.diagnostics.subtitle')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button className="cp-btn cp-btn-muted" onClick={() => void runDiagnostics()} disabled={loading}>
                {loading ? t('app.diagnostics.running') : t('app.diagnostics.runCheck')}
              </button>
              <button className="cp-btn cp-btn-primary" onClick={() => void handleExport()} disabled={!report || exporting}>
                {exporting ? t('app.diagnostics.exporting') : t('app.diagnostics.exportBundle')}
              </button>
            </div>
          </header>
        )}

        {embedded && (
          <div className="flex items-center justify-end gap-2">
            <button className="cp-btn cp-btn-muted" onClick={() => void runDiagnostics()} disabled={loading}>
              {loading ? t('app.diagnostics.running') : t('app.diagnostics.runCheck')}
            </button>
            <button className="cp-btn cp-btn-primary" onClick={() => void handleExport()} disabled={!report || exporting}>
              {exporting ? t('app.diagnostics.exporting') : t('app.diagnostics.exportBundle')}
            </button>
          </div>
        )}

        {feedback && (
          <div
            className={`rounded-xl border px-4 py-3 text-sm ${
              feedback.type === 'success'
                ? 'text-success border-success/30 bg-success/10'
                : 'text-danger border-danger/30 bg-danger/10'
            }`}
          >
            {feedback.text}
          </div>
        )}

        {runError && <div className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">{runError}</div>}

        {report && (
          <>
            <div className={`rounded-2xl border px-4 py-4 ${overallTone}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm uppercase tracking-wide">{t('app.diagnostics.overallHealth')}</p>
                  <p className="mt-1 text-lg font-semibold">{toStateLabel(report.overallStatus, t)}</p>
                </div>
                <div className="text-right text-sm">
                  <p>{report.issues.length} {t('app.diagnostics.issuesLabel')}</p>
                  <p className="text-muted-foreground">{new Date(report.timestamp).toLocaleString(locale)}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {categorySummaries.map((item) => (
                <div key={item.category} className="rounded-xl border border-border bg-surface-2 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{t(CATEGORY_KEY[item.category])}</p>
                    <span className="cp-badge">{item.count}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{toStateLabel(item.state, t)}</p>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-border bg-surface-2 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold">{t('app.diagnostics.issuesTitle')}</h2>
                <div className="flex items-center gap-2">
                  {(['all', 'error', 'warning', 'info'] as SeverityFilter[]).map((option) => (
                    <button
                      key={option}
                      onClick={() => setFilter(option)}
                      className={`cp-btn px-3 py-1.5 text-xs ${filter === option ? 'cp-btn-primary' : 'cp-btn-muted'}`}
                    >
                      {option === 'all'
                        ? t('app.diagnostics.filterAll')
                        : option === 'error'
                          ? t('app.diagnostics.filterError')
                          : option === 'warning'
                            ? t('app.diagnostics.filterWarning')
                            : t('app.diagnostics.filterInfo')}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                {filteredIssues.length === 0 && (
                  <div className="rounded-xl border border-border bg-surface px-4 py-8 text-center text-sm text-muted-foreground">
                    {loading ? t('app.diagnostics.diagnosticsRunning') : t('app.diagnostics.noIssuesInFilter')}
                  </div>
                )}
                {filteredIssues.map((issue, index) => (
                  <article key={`${issue.category}-${issue.title}-${index}`} className="rounded-xl border border-border bg-surface px-4 py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="cp-badge">{t(CATEGORY_KEY[issue.category])}</span>
                          <span className={`rounded-full border px-2 py-0.5 text-xs ${SEVERITY_STYLE[issue.severity]}`}>
                            {toStateLabel(issue.severity, t)}
                          </span>
                        </div>
                        <h3 className="text-sm font-semibold">{issue.title}</h3>
                        <p className="text-sm text-muted-foreground">{issue.description}</p>
                        {issue.details && (
                          <details className="text-xs text-muted-foreground">
                            <summary className="cursor-pointer">{t('app.diagnostics.details')}</summary>
                            <pre className="mt-2 overflow-x-auto rounded-xl border border-border bg-background p-3">{issue.details}</pre>
                          </details>
                        )}
                      </div>
                      {issue.fixable && (
                        <button
                          className="cp-btn cp-btn-muted whitespace-nowrap"
                          onClick={() => void handleFix(issue)}
                          disabled={fixingIssue !== null}
                        >
                          {fixingIssue === issue.title ? t('app.diagnostics.fixing') : t('app.diagnostics.autoFix')}
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 rounded-2xl border border-border bg-surface-2 p-4 md:grid-cols-2">
              <p className="text-sm text-muted-foreground">
                {t('app.diagnostics.platform')}: <span className="text-foreground">{report.systemInfo.platform}</span>
              </p>
              <p className="text-sm text-muted-foreground">
                {t('app.diagnostics.node')}: <span className="text-foreground">{report.systemInfo.nodeVersion}</span>
              </p>
              <p className="text-sm text-muted-foreground md:col-span-2">
                {t('app.diagnostics.stateDirectory')}: <span className="font-mono text-xs text-foreground">{report.systemInfo.stateDir}</span>
              </p>
              {report.systemInfo.openclawVersion && (
                <p className="text-sm text-muted-foreground md:col-span-2">
                  OpenClaw: <span className="text-foreground">{report.systemInfo.openclawVersion}</span>
                </p>
              )}
            </div>
          </>
        )}
      </section>
  )
}

function toStateLabel(
  state: 'healthy' | 'warning' | 'error' | 'info',
  t: (key: string) => string,
): string {
  if (state === 'healthy') return t('app.diagnostics.healthy')
  if (state === 'warning') return t('app.diagnostics.filterWarning')
  if (state === 'error') return t('app.diagnostics.filterError')
  return t('app.diagnostics.filterInfo')
}
