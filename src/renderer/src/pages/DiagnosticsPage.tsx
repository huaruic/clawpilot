import React, { useState, useEffect } from 'react'
import type { DiagnosticIssue, DiagnosticReport } from '../api/ipc'

export function DiagnosticsPage(): React.ReactElement {
  const [report, setReport] = useState<DiagnosticReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [fixing, setFixing] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    runDiagnostics()
  }, [])

  const runDiagnostics = async (): Promise<void> => {
    setLoading(true)
    setErrorMessage(null)
    try {
      const result = await window.clawpilot.diagnostics.run()
      setReport(result)
    } catch (error) {
      console.error('Failed to run diagnostics:', error)
      setErrorMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setLoading(false)
    }
  }

  const handleFix = async (issue: DiagnosticIssue): Promise<void> => {
    setFixing(issue.title)
    try {
      const result = await window.clawpilot.diagnostics.fix(issue)
      if (result.success) {
        alert(`修复成功: ${result.message}`)
        await runDiagnostics() // 重新运行诊断
      } else {
        alert(`修复失败: ${result.message}\n${result.output || ''}`)
      }
    } catch (error) {
      alert(`修复出错: ${error}`)
    } finally {
      setFixing(null)
    }
  }

  const handleExport = async (): Promise<void> => {
    setExporting(true)
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const filename = `clawpilot-diagnostics-${timestamp}.json`

      const outputPath = await window.clawpilot.app.showSaveDialog({
        title: 'Export Diagnostics Bundle',
        defaultPath: filename,
        filters: [{ name: 'JSON', extensions: ['json'] }],
      })

      if (!outputPath) return

      await window.clawpilot.diagnostics.exportBundle({ outputPath })
      alert(`诊断报告已导出到: ${outputPath}`)
    } catch (error) {
      alert(`导出失败: ${error}`)
    } finally {
      setExporting(false)
    }
  }

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'healthy':
        return 'text-green-500'
      case 'warning':
        return 'text-yellow-500'
      case 'error':
        return 'text-red-500'
      default:
        return 'text-zinc-400'
    }
  }

  const getSeverityColor = (severity: string): string => {
    switch (severity) {
      case 'error':
        return 'bg-red-500/10 text-red-500 border-red-500/20'
      case 'warning':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
      case 'info':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20'
      default:
        return 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20'
    }
  }

  const getCategoryStatus = (category: DiagnosticIssue['category']): {
    status: 'healthy' | 'warning' | 'error' | 'info'
    count: number
  } => {
    if (!report) {
      return { status: 'healthy', count: 0 }
    }
    const items = report.issues.filter((issue) => issue.category === category)
    if (items.some((issue) => issue.severity === 'error')) {
      return { status: 'error', count: items.length }
    }
    if (items.some((issue) => issue.severity === 'warning')) {
      return { status: 'warning', count: items.length }
    }
    if (items.some((issue) => issue.severity === 'info')) {
      return { status: 'info', count: items.length }
    }
    return { status: 'healthy', count: 0 }
  }

  const getCategoryStatusColor = (status: 'healthy' | 'warning' | 'error' | 'info'): string => {
    switch (status) {
      case 'healthy':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
      case 'warning':
        return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
      case 'error':
        return 'bg-red-500/10 text-red-400 border-red-500/20'
      case 'info':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20'
      default:
        return 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
    }
  }

  const getCategoryIcon = (category: string): string => {
    switch (category) {
      case 'runtime':
        return '⚙️'
      case 'config':
        return '📝'
      case 'provider':
        return '🔌'
      case 'channel':
        return '📡'
      case 'skill':
        return '🧩'
      case 'workspace':
        return '📁'
      default:
        return '❓'
    }
  }

  return (
    <div className="flex flex-col h-full p-6 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">系统诊断</h1>
          <p className="text-sm text-zinc-500 mt-1">
            检测 OpenClaw 运行环境并提供修复建议
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={runDiagnostics}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-md text-sm transition-colors"
          >
            {loading ? '诊断中...' : '重新诊断'}
          </button>
          <button
            onClick={handleExport}
            disabled={exporting || !report}
            className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 disabled:bg-zinc-800 disabled:text-zinc-600 text-white rounded-md text-sm transition-colors"
          >
            {exporting ? '导出中...' : '导出报告'}
          </button>
        </div>
      </div>

      {/* Overall Status */}
      {report && (
        <div className={`mb-6 p-4 rounded-lg border ${
          report.overallStatus === 'healthy'
            ? 'bg-green-500/10 border-green-500/20'
            : report.overallStatus === 'warning'
            ? 'bg-yellow-500/10 border-yellow-500/20'
            : 'bg-red-500/10 border-red-500/20'
        }`}>
          <div className="flex items-center gap-3">
            <div className="text-3xl">
              {report.overallStatus === 'healthy' ? '✅' : report.overallStatus === 'warning' ? '⚠️' : '❌'}
            </div>
            <div>
              <h2 className={`text-lg font-semibold ${getStatusColor(report.overallStatus)}`}>
                {report.overallStatus === 'healthy' ? '系统健康' : report.overallStatus === 'warning' ? '发现警告' : '发现错误'}
              </h2>
              <p className="text-sm text-zinc-400">
                {report.issues.length} 个问题 · {new Date(report.timestamp).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Status Cards */}
      {report && (
        <div className="mb-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {([
            { key: 'runtime', label: 'Gateway / Runtime' },
            { key: 'provider', label: 'Providers' },
            { key: 'channel', label: 'Channels' },
            { key: 'skill', label: 'Skills' },
            { key: 'config', label: 'Config' },
            { key: 'workspace', label: 'Workspace' },
          ] as Array<{ key: DiagnosticIssue['category']; label: string }>).map((item) => {
            const status = getCategoryStatus(item.key)
            return (
              <div
                key={item.key}
                className={`p-4 rounded-lg border ${getCategoryStatusColor(status.status)}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{getCategoryIcon(item.key)}</span>
                    <div>
                      <div className="text-sm font-semibold text-white">{item.label}</div>
                      <div className="text-xs text-zinc-400">
                        {status.status === 'healthy'
                          ? 'Healthy'
                          : status.status === 'warning'
                          ? 'Warnings'
                          : status.status === 'error'
                          ? 'Errors'
                          : 'Info'}
                      </div>
                    </div>
                  </div>
                  <div className="text-lg font-semibold">
                    {status.count}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* System Info */}
      {report && (
        <div className="mb-6 p-4 bg-zinc-800/50 rounded-lg border border-zinc-700">
          <h3 className="text-sm font-semibold text-white mb-3">系统信息</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-zinc-500">平台:</span>
              <span className="ml-2 text-white">{report.systemInfo.platform}</span>
            </div>
            <div>
              <span className="text-zinc-500">Node版本:</span>
              <span className="ml-2 text-white">{report.systemInfo.nodeVersion}</span>
            </div>
            {report.systemInfo.openclawVersion && (
              <div>
                <span className="text-zinc-500">OpenClaw版本:</span>
                <span className="ml-2 text-white">{report.systemInfo.openclawVersion}</span>
              </div>
            )}
            <div className="col-span-2">
              <span className="text-zinc-500">数据目录:</span>
              <span className="ml-2 text-white text-xs font-mono break-all">{report.systemInfo.stateDir}</span>
            </div>
          </div>
        </div>
      )}

      {/* Issues List */}
      {errorMessage && (
        <div className="mb-6 p-4 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 text-sm">
          诊断失败：{errorMessage}
        </div>
      )}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="text-zinc-500">正在运行诊断...</div>
        </div>
      )}

      {!loading && report && report.issues.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h3 className="text-lg font-semibold text-white mb-2">没有发现问题</h3>
          <p className="text-sm text-zinc-500">系统运行良好！</p>
        </div>
      )}

      {!loading && report && report.issues.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-white mb-3">发现的问题</h3>
          {report.issues.map((issue, index) => (
            <div
              key={index}
              className={`p-4 rounded-lg border ${getSeverityColor(issue.severity)}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">{getCategoryIcon(issue.category)}</span>
                    <span className="text-xs uppercase font-semibold text-zinc-400">
                      {issue.category}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                      issue.severity === 'error' ? 'bg-red-500/20 text-red-400' :
                      issue.severity === 'warning' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-blue-500/20 text-blue-400'
                    }`}>
                      {issue.severity.toUpperCase()}
                    </span>
                  </div>
                  <h4 className="text-sm font-semibold text-white mb-1">{issue.title}</h4>
                  <p className="text-sm text-zinc-300 mb-2">{issue.description}</p>
                  {issue.details && (
                    <details className="text-xs text-zinc-500 mt-2">
                      <summary className="cursor-pointer hover:text-zinc-400">详细信息</summary>
                      <pre className="mt-2 p-2 bg-black/30 rounded text-xs overflow-x-auto">
                        {issue.details}
                      </pre>
                    </details>
                  )}
                </div>
                {issue.fixable && (
                  <button
                    onClick={() => handleFix(issue)}
                    disabled={fixing !== null}
                    className="ml-4 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded text-sm transition-colors whitespace-nowrap"
                  >
                    {fixing === issue.title ? '修复中...' : '自动修复'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
