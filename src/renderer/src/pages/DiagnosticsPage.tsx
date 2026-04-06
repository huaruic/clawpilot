import React, { useMemo, useState } from 'react'
import { Play, Wrench, CheckCircle2, AlertTriangle, XCircle, FolderOpen, Copy } from 'lucide-react'
import type { DiagnosticIssue, DiagnosticReport } from '../api/ipc'
import { useI18n } from '../i18n/I18nProvider'
import { toast } from 'sonner'

type LogTab = 'issues' | 'system'

const CATEGORY_KEY: Record<DiagnosticIssue['category'], string> = {
  runtime: 'app.diagnostics.categoryRuntime',
  provider: 'app.diagnostics.categoryProviders',
  channel: 'app.diagnostics.categoryChannels',
  skill: 'app.diagnostics.categorySkills',
  config: 'app.diagnostics.categoryConfig',
  workspace: 'app.diagnostics.categoryWorkspace',
}

const STATUS_ICON = { error: XCircle, warning: AlertTriangle, info: CheckCircle2 }
const STATUS_COLOR = { error: 'text-destructive', warning: 'text-warning', info: 'text-success' }

export function DiagnosticsPage(): React.ReactElement {
  const { t, resolvedLanguage } = useI18n()
  const [report, setReport] = useState<DiagnosticReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [fixingIssue, setFixingIssue] = useState<string | null>(null)
  const [logTab, setLogTab] = useState<LogTab>('issues')

  const runDiagnostics = async (): Promise<void> => {
    setLoading(true)
    try {
      setReport(await window.clawpilot.diagnostics.run())
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  const handleFix = async (issue: DiagnosticIssue): Promise<void> => {
    setFixingIssue(issue.title)
    try {
      const result = await window.clawpilot.diagnostics.fix(issue)
      if (result.success) {
        toast.success(result.message)
        await runDiagnostics()
      } else {
        toast.error(result.message)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setFixingIssue(null)
    }
  }

  const handleExport = async (): Promise<void> => {
    if (!report) return
    setExporting(true)
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const outputPath = await window.clawpilot.app.showSaveDialog({
        title: 'Export Diagnostics Bundle',
        defaultPath: `clawpilot-diagnostics-${timestamp}.json`,
        filters: [{ name: 'JSON', extensions: ['json'] }],
      })
      if (!outputPath) { setExporting(false); return }
      await window.clawpilot.diagnostics.exportBundle({ outputPath })
      toast.success(`${t('app.diagnostics.exportedTo')} ${outputPath}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setExporting(false)
    }
  }

  const grouped = useMemo(() => {
    if (!report) return []
    const cats = Object.keys(CATEGORY_KEY) as Array<DiagnosticIssue['category']>
    return cats
      .map((cat) => ({ category: cat, issues: report.issues.filter((i) => i.category === cat) }))
      .filter((g) => g.issues.length > 0)
  }, [report])

  const locale = resolvedLanguage === 'zh-CN' ? 'zh-CN' : 'en-US'

  return (
    <div className="cp-page max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-foreground">{t('app.diagnostics.title')}</h1>
        <div className="flex gap-2">
          <button
            onClick={() => void runDiagnostics()}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            <Play className="h-3 w-3" /> {loading ? t('app.diagnostics.running') : t('app.diagnostics.runCheck')}
          </button>
          <button
            onClick={() => void handleExport()}
            disabled={!report || exporting}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-accent disabled:opacity-50"
          >
            <Wrench className="h-3 w-3" /> {exporting ? t('app.diagnostics.exporting') : t('app.diagnostics.exportBundle')}
          </button>
        </div>
      </div>

      {/* Overall health banner */}
      {report && (
        <div className={`flex items-center justify-between rounded-xl border p-4 ${
          report.overallStatus === 'error' ? 'border-destructive/30 bg-destructive/10' :
          report.overallStatus === 'warning' ? 'border-warning/30 bg-warning/10' :
          'border-success/30 bg-success/10'
        }`}>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('app.diagnostics.overallHealth')}</p>
            <p className="mt-1 text-lg font-semibold text-foreground">
              {report.overallStatus === 'healthy' ? t('app.diagnostics.healthy') : report.overallStatus}
            </p>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            <p>{report.issues.length} {t('app.diagnostics.issuesLabel')}</p>
            <p>{new Date(report.timestamp).toLocaleString(locale)}</p>
          </div>
        </div>
      )}

      {/* Grouped checks */}
      {grouped.map((group) => (
        <div key={group.category} className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-3 text-sm font-medium text-foreground">{t(CATEGORY_KEY[group.category])}</h3>
          <div className="space-y-2">
            {group.issues.map((issue, i) => {
              const Icon = STATUS_ICON[issue.severity]
              return (
                <div key={i} className="flex items-center justify-between py-1.5">
                  <div className="flex items-center gap-2.5">
                    <Icon className={`h-4 w-4 ${STATUS_COLOR[issue.severity]}`} />
                    <span className="text-xs text-foreground">{issue.title}</span>
                    <span className="text-xs text-muted-foreground">{issue.description}</span>
                  </div>
                  {issue.fixable && (
                    <button
                      onClick={() => void handleFix(issue)}
                      disabled={fixingIssue !== null}
                      className="rounded border border-primary/30 px-2 py-0.5 text-[10px] text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
                    >
                      {fixingIssue === issue.title ? t('app.diagnostics.fixing') : `${t('app.diagnostics.autoFix')} →`}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {!report && !loading && (
        <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center text-sm text-muted-foreground">
          {t('app.diagnostics.runPrompt')}
        </div>
      )}

      {/* System info / log area */}
      {report && (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-2">
            <div className="flex gap-1">
              {(['issues', 'system'] as LogTab[]).map((tb) => (
                <button
                  key={tb}
                  onClick={() => setLogTab(tb)}
                  className={`rounded-md px-3 py-1.5 text-xs transition-colors ${
                    logTab === tb ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'
                  }`}
                >
                  {tb === 'issues' ? t('app.diagnostics.issuesTitle') : t('app.diagnostics.systemInfo')}
                </button>
              ))}
            </div>
            <div className="flex gap-1">
              <button className="p-1.5 text-muted-foreground hover:text-foreground" title="Copy">
                <Copy className="h-3.5 w-3.5" />
              </button>
              <button className="p-1.5 text-muted-foreground hover:text-foreground" title="Open">
                <FolderOpen className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto p-4">
            {logTab === 'system' ? (
              <div className="space-y-1 font-mono text-[11px] leading-5 text-muted-foreground">
                <div>{t('app.diagnostics.platform')}: {report.systemInfo.platform}</div>
                <div>{t('app.diagnostics.node')}: {report.systemInfo.nodeVersion}</div>
                <div>{t('app.diagnostics.stateDirectory')}: {report.systemInfo.stateDir}</div>
                {report.systemInfo.openclawVersion && <div>OpenClaw: {report.systemInfo.openclawVersion}</div>}
              </div>
            ) : (
              <div className="space-y-1 font-mono text-[11px] leading-5">
                {report.issues.length === 0 ? (
                  <span className="text-success">{t('app.diagnostics.healthy')}</span>
                ) : (
                  report.issues.map((issue, i) => (
                    <div key={i} className={issue.severity === 'error' ? 'text-destructive' : issue.severity === 'warning' ? 'text-warning' : 'text-muted-foreground'}>
                      [{issue.severity.toUpperCase()}] {issue.category}: {issue.title} — {issue.description}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
