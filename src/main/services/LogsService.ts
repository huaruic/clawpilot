import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { getOpenClawStateDir } from './RuntimeLocator'

export interface LogEntry {
  timestamp: number
  level: 'debug' | 'info' | 'warn' | 'error'
  message: string
  source?: string
  details?: Record<string, unknown>
}

export interface LogFile {
  name: string
  path: string
  size: number
  mtime: number
}

/**
 * 日志服务
 * 读取、解析和管理 OpenClaw 日志
 */
export class LogsService {
  private readonly logsDir: string

  constructor() {
    const stateDir = getOpenClawStateDir()
    this.logsDir = path.join(stateDir, 'logs')
  }

  /**
   * 列出所有日志文件
   */
  async listLogFiles(): Promise<LogFile[]> {
    try {
      const files = await fs.readdir(this.logsDir)
      const logFiles: LogFile[] = []

      for (const file of files) {
        if (!file.endsWith('.log') && !file.endsWith('.jsonl')) continue

        const filePath = path.join(this.logsDir, file)
        const stat = await fs.stat(filePath)

        logFiles.push({
          name: file,
          path: filePath,
          size: stat.size,
          mtime: stat.mtimeMs,
        })
      }

      // 按修改时间倒序排列
      return logFiles.sort((a, b) => b.mtime - a.mtime)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return []
      }
      throw error
    }
  }

  /**
   * 读取日志文件内容
   */
  async readLogFile(filename: string, options?: {
    limit?: number
    offset?: number
  }): Promise<string> {
    const filePath = path.join(this.logsDir, filename)

    try {
      const content = await fs.readFile(filePath, 'utf-8')
      const lines = content.split('\n')

      const { limit = 1000, offset = 0 } = options || {}
      const selectedLines = lines.slice(offset, offset + limit)

      return selectedLines.join('\n')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error(`日志文件不存在: ${filename}`)
      }
      throw error
    }
  }

  /**
   * 解析日志条目（支持 JSONL 和文本格式）
   */
  async parseLogEntries(filename: string, options?: {
    limit?: number
    level?: LogEntry['level']
  }): Promise<LogEntry[]> {
    const content = await this.readLogFile(filename, { limit: options?.limit })
    const lines = content.split('\n').filter((line) => line.trim())

    const entries: LogEntry[] = []

    for (const line of lines) {
      try {
        // 尝试解析为 JSON
        const json = JSON.parse(line)
        const entry: LogEntry = {
          timestamp: json.timestamp || json.time || Date.now(),
          level: this.normalizeLevel(json.level || json.severity),
          message: json.message || json.msg || line,
          source: json.source || json.component,
          details: json,
        }

        if (!options?.level || entry.level === options.level) {
          entries.push(entry)
        }
      } catch {
        // 如果不是 JSON，解析为文本日志
        const entry = this.parseTextLog(line)
        if (!options?.level || entry.level === options.level) {
          entries.push(entry)
        }
      }
    }

    return entries
  }

  /**
   * 搜索日志
   */
  async searchLogs(query: string, options?: {
    files?: string[]
    level?: LogEntry['level']
    limit?: number
  }): Promise<Array<LogEntry & { file: string }>> {
    const files = options?.files || (await this.listLogFiles()).map((f) => f.name)
    const results: Array<LogEntry & { file: string }> = []
    const limit = options?.limit || 100

    for (const file of files) {
      try {
        const entries = await this.parseLogEntries(file, { level: options?.level })

        for (const entry of entries) {
          if (
            entry.message.toLowerCase().includes(query.toLowerCase()) ||
            JSON.stringify(entry.details).toLowerCase().includes(query.toLowerCase())
          ) {
            results.push({ ...entry, file })
            if (results.length >= limit) {
              return results
            }
          }
        }
      } catch {
        // 跳过无法读取的文件
        continue
      }
    }

    return results
  }

  /**
   * 获取最新日志
   */
  async getRecentLogs(options?: {
    limit?: number
    level?: LogEntry['level']
  }): Promise<LogEntry[]> {
    const files = await this.listLogFiles()
    if (files.length === 0) return []

    // 读取最新的日志文件
    const latestFile = files[0]
    return await this.parseLogEntries(latestFile.name, options)
  }

  /**
   * 清理旧日志
   */
  async cleanOldLogs(options?: {
    keepDays?: number
    keepCount?: number
  }): Promise<number> {
    const { keepDays = 7, keepCount = 10 } = options || {}
    const files = await this.listLogFiles()

    const now = Date.now()
    const cutoffTime = now - keepDays * 24 * 60 * 60 * 1000

    let deletedCount = 0

    // 保留最新的 keepCount 个文件
    const filesToConsider = files.slice(keepCount)

    for (const file of filesToConsider) {
      if (file.mtime < cutoffTime) {
        try {
          await fs.unlink(file.path)
          deletedCount++
        } catch {
          // 忽略删除失败
        }
      }
    }

    return deletedCount
  }

  /**
   * 导出日志
   */
  async exportLogs(outputPath: string, options?: {
    files?: string[]
    level?: LogEntry['level']
  }): Promise<void> {
    const files = options?.files || (await this.listLogFiles()).map((f) => f.name)
    const allLogs: Array<LogEntry & { file: string }> = []

    for (const file of files) {
      try {
        const entries = await this.parseLogEntries(file, { level: options?.level })
        for (const entry of entries) {
          allLogs.push({ ...entry, file })
        }
      } catch {
        continue
      }
    }

    // 按时间排序
    allLogs.sort((a, b) => a.timestamp - b.timestamp)

    await fs.writeFile(outputPath, JSON.stringify(allLogs, null, 2), 'utf-8')
  }

  /**
   * 解析文本日志
   */
  private parseTextLog(line: string): LogEntry {
    // 尝试匹配常见日志格式：[timestamp] [level] message
    const match = line.match(/^\[([^\]]+)\]\s*\[(\w+)\]\s*(.+)$/)

    if (match) {
      const [, timestampStr, levelStr, message] = match
      return {
        timestamp: new Date(timestampStr).getTime() || Date.now(),
        level: this.normalizeLevel(levelStr),
        message,
      }
    }

    // 默认格式
    return {
      timestamp: Date.now(),
      level: 'info',
      message: line,
    }
  }

  /**
   * 标准化日志级别
   */
  private normalizeLevel(level: string): LogEntry['level'] {
    const lower = level.toLowerCase()
    if (lower.includes('error') || lower.includes('fatal')) return 'error'
    if (lower.includes('warn')) return 'warn'
    if (lower.includes('debug') || lower.includes('trace')) return 'debug'
    return 'info'
  }
}
