import React, { useEffect, useMemo, useState } from 'react'
import type { LogEntry, LogFile } from '../api/ipc'

export function LogsPage(): React.ReactElement {
  const [files, setFiles] = useState<LogFile[]>([])
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [rawContent, setRawContent] = useState<string>('')
  const [loadingFiles, setLoadingFiles] = useState(false)
  const [loadingEntries, setLoadingEntries] = useState(false)
  const [mode, setMode] = useState<'parsed' | 'raw'>('parsed')
  const [levelFilter, setLevelFilter] = useState<LogEntry['level'] | 'all'>('all')
  const [query, setQuery] = useState('')
  const [limit, setLimit] = useState(500)
  const [exporting, setExporting] = useState(false)
  const [exportScope, setExportScope] = useState<'current' | 'all'>('current')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    void loadFiles()
  }, [])

  useEffect(() => {
    void loadEntries()
  }, [selectedFile, mode, levelFilter, limit])

  const filteredEntries = useMemo(() => {
    if (mode !== 'parsed') return entries
    if (!query.trim()) return entries
    const q = query.toLowerCase()
    return entries.filter((entry) => {
      if (entry.message.toLowerCase().includes(q)) return true
      if (!entry.details) return false
      try {
        return JSON.stringify(entry.details).toLowerCase().includes(q)
      } catch {
        return false
      }
    })
  }, [entries, mode, query])

  async function loadFiles(): Promise<void> {
    setLoadingFiles(true)
    setErrorMessage(null)
    try {
      const list = await window.clawpilot.logs.list()
      setFiles(list)
      if (!selectedFile || !list.some((file) => file.name === selectedFile)) {
        setSelectedFile(list[0]?.name ?? null)
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setLoadingFiles(false)
    }
  }

  async function loadEntries(): Promise<void> {
    if (!selectedFile) {
      setEntries([])
      setRawContent('')
      return
    }
    setLoadingEntries(true)
    setErrorMessage(null)
    try {
      if (mode === 'parsed') {
        const parsed = await window.clawpilot.logs.parse({
          filename: selectedFile,
          limit,
          level: levelFilter === 'all' ? undefined : levelFilter,
        })
        setEntries(parsed)
        setRawContent('')
      } else {
        const content = await window.clawpilot.logs.readFile({
          filename: selectedFile,
          limit,
          offset: 0,
        })
        setRawContent(content)
        setEntries([])
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setLoadingEntries(false)
    }
  }

  async function handleExport(): Promise<void> {
    if (exportScope === 'current' && !selectedFile) return
    setExporting(true)
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const filename = `clawpilot-logs-${timestamp}.json`
      const outputPath = await window.clawpilot.app.showSaveDialog({
        title: 'Export Logs',
        defaultPath: filename,
        filters: [{ name: 'JSON', extensions: ['json'] }],
      })
      if (!outputPath) return
      await window.clawpilot.logs.export({
        outputPath,
        files: exportScope === 'current' ? [selectedFile as string] : undefined,
        level: levelFilter === 'all' ? undefined : levelFilter,
      })
      alert(`日志已导出到: ${outputPath}`)
    } catch (error) {
      alert(`导出失败: ${error}`)
    } finally {
      setExporting(false)
    }
  }

  const selectedMeta = files.find((file) => file.name === selectedFile) ?? null

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="flex flex-col h-full p-6 gap-4 overflow-hidden">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Logs</h1>
          <p className="text-sm text-zinc-500 mt-0.5">查看 OpenClaw 运行日志与导出报告</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { void loadFiles() }}
            disabled={loadingFiles || loadingEntries}
            className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-900 disabled:text-zinc-500 text-white rounded-md text-sm"
          >
            {loadingFiles || loadingEntries ? '刷新中...' : '刷新'}
          </button>
          <div className="flex items-center gap-2">
            <select
              value={exportScope}
              onChange={(event) => setExportScope(event.target.value as 'current' | 'all')}
              className="bg-zinc-800 text-sm text-white rounded-md px-2 py-2 border border-zinc-700"
            >
              <option value="current">导出当前文件</option>
              <option value="all">导出全部文件</option>
            </select>
            <button
              onClick={handleExport}
              disabled={exporting || (exportScope === 'current' && !selectedFile)}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-800 disabled:text-zinc-500 text-white rounded-md text-sm"
            >
              {exporting ? '导出中...' : '导出'}
            </button>
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="p-3 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 text-sm">
          {errorMessage}
        </div>
      )}

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4 overflow-hidden">
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-zinc-800 text-sm font-semibold text-white">
            日志文件
          </div>
          <div className="flex-1 overflow-y-auto">
            {files.length === 0 && !loadingFiles && (
              <div className="p-4 text-sm text-zinc-500">暂无日志文件</div>
            )}
            {files.map((file) => (
              <button
                key={file.name}
                onClick={() => setSelectedFile(file.name)}
                className={`w-full text-left px-4 py-3 border-b border-zinc-800 text-sm transition-colors ${
                  selectedFile === file.name
                    ? 'bg-zinc-800 text-white'
                    : 'hover:bg-zinc-800/60 text-zinc-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{file.name}</span>
                  <span className="text-xs text-zinc-500">{formatBytes(file.size)}</span>
                </div>
                <div className="text-xs text-zinc-500 mt-1">
                  {new Date(file.mtime).toLocaleString()}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-zinc-400">模式</span>
              <select
                value={mode}
                onChange={(event) => setMode(event.target.value as 'parsed' | 'raw')}
                className="bg-zinc-800 text-sm text-white rounded-md px-2 py-1 border border-zinc-700"
              >
                <option value="parsed">结构化</option>
                <option value="raw">原始文本</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-zinc-400">级别</span>
              <select
                value={levelFilter}
                onChange={(event) => setLevelFilter(event.target.value as LogEntry['level'] | 'all')}
                className="bg-zinc-800 text-sm text-white rounded-md px-2 py-1 border border-zinc-700"
              >
                <option value="all">全部</option>
                <option value="error">Error</option>
                <option value="warn">Warn</option>
                <option value="info">Info</option>
                <option value="debug">Debug</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-zinc-400">条数</span>
              <select
                value={String(limit)}
                onChange={(event) => setLimit(Number(event.target.value))}
                className="bg-zinc-800 text-sm text-white rounded-md px-2 py-1 border border-zinc-700"
              >
                <option value="200">200</option>
                <option value="500">500</option>
                <option value="1000">1000</option>
                <option value="2000">2000</option>
              </select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索关键词..."
                className="w-full bg-zinc-800 text-sm text-white rounded-md px-3 py-1 border border-zinc-700 placeholder:text-zinc-500"
              />
            </div>
            {selectedMeta && (
              <div className="text-xs text-zinc-500">
                {selectedMeta.name} · {formatBytes(selectedMeta.size)}
              </div>
            )}
          </div>

          <div className="flex-1 overflow-auto">
            {loadingEntries && (
              <div className="p-6 text-sm text-zinc-500">加载中...</div>
            )}
            {!loadingEntries && !selectedFile && (
              <div className="p-6 text-sm text-zinc-500">请选择一个日志文件</div>
            )}
            {!loadingEntries && selectedFile && mode === 'raw' && (
              <pre className="p-4 text-xs text-zinc-200 whitespace-pre-wrap leading-relaxed">
                {rawContent || '暂无日志内容'}
              </pre>
            )}
            {!loadingEntries && selectedFile && mode === 'parsed' && (
              <div className="divide-y divide-zinc-800">
                {filteredEntries.length === 0 && (
                  <div className="p-6 text-sm text-zinc-500">没有匹配的日志条目</div>
                )}
                {filteredEntries.map((entry, index) => (
                  <div key={`${entry.timestamp}-${index}`} className="p-4">
                    <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500">
                      <span>{new Date(entry.timestamp).toLocaleString()}</span>
                      <span className={`px-2 py-0.5 rounded border ${
                        entry.level === 'error'
                          ? 'border-red-500/40 text-red-400'
                          : entry.level === 'warn'
                          ? 'border-yellow-500/40 text-yellow-400'
                          : entry.level === 'info'
                          ? 'border-blue-500/40 text-blue-400'
                          : 'border-zinc-500/40 text-zinc-400'
                      }`}>
                        {entry.level.toUpperCase()}
                      </span>
                      {entry.source && <span className="text-zinc-400">{entry.source}</span>}
                    </div>
                    <div className="mt-2 text-sm text-zinc-200 whitespace-pre-wrap">
                      {entry.message}
                    </div>
                    {entry.details && (
                      <details className="mt-2 text-xs text-zinc-400">
                        <summary className="cursor-pointer hover:text-zinc-200">详情</summary>
                        <pre className="mt-2 p-2 bg-black/30 rounded text-xs overflow-x-auto">
                          {JSON.stringify(entry.details, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
