import { ipcMain, type IpcMainInvokeEvent } from 'electron'
import { LogsService, type LogFile, type LogEntry } from '../services/LogsService'
import { z } from 'zod'

// Schemas
const ReadLogFileSchema = z.object({
  filename: z.string(),
  limit: z.number().optional(),
  offset: z.number().optional(),
})

const ParseLogEntriesSchema = z.object({
  filename: z.string(),
  limit: z.number().optional(),
  level: z.enum(['debug', 'info', 'warn', 'error']).optional(),
})

const SearchLogsSchema = z.object({
  query: z.string(),
  files: z.array(z.string()).optional(),
  level: z.enum(['debug', 'info', 'warn', 'error']).optional(),
  limit: z.number().optional(),
})

const GetRecentLogsSchema = z.object({
  limit: z.number().optional(),
  level: z.enum(['debug', 'info', 'warn', 'error']).optional(),
})

const CleanOldLogsSchema = z.object({
  keepDays: z.number().optional(),
  keepCount: z.number().optional(),
})

const ExportLogsSchema = z.object({
  outputPath: z.string(),
  files: z.array(z.string()).optional(),
  level: z.enum(['debug', 'info', 'warn', 'error']).optional(),
})

export function registerLogsIpc(logsService: LogsService): void {
  /**
   * 列出所有日志文件
   */
  ipcMain.handle('logs:list', async (_event: IpcMainInvokeEvent): Promise<LogFile[]> => {
    return await logsService.listLogFiles()
  })

  /**
   * 读取日志文件内容
   */
  ipcMain.handle('logs:readFile', async (_event: IpcMainInvokeEvent, params: unknown): Promise<string> => {
    const { filename, limit, offset } = ReadLogFileSchema.parse(params)
    return await logsService.readLogFile(filename, { limit, offset })
  })

  /**
   * 解析日志条目
   */
  ipcMain.handle('logs:parse', async (_event: IpcMainInvokeEvent, params: unknown): Promise<LogEntry[]> => {
    const { filename, limit, level } = ParseLogEntriesSchema.parse(params)
    return await logsService.parseLogEntries(filename, { limit, level })
  })

  /**
   * 搜索日志
   */
  ipcMain.handle('logs:search', async (_event: IpcMainInvokeEvent, params: unknown): Promise<Array<LogEntry & { file: string }>> => {
    const { query, files, level, limit } = SearchLogsSchema.parse(params)
    return await logsService.searchLogs(query, { files, level, limit })
  })

  /**
   * 获取最新日志
   */
  ipcMain.handle('logs:recent', async (_event: IpcMainInvokeEvent, params: unknown): Promise<LogEntry[]> => {
    const { limit, level } = GetRecentLogsSchema.parse(params)
    return await logsService.getRecentLogs({ limit, level })
  })

  /**
   * 清理旧日志
   */
  ipcMain.handle('logs:clean', async (_event: IpcMainInvokeEvent, params: unknown): Promise<number> => {
    const { keepDays, keepCount } = CleanOldLogsSchema.parse(params)
    return await logsService.cleanOldLogs({ keepDays, keepCount })
  })

  /**
   * 导出日志
   */
  ipcMain.handle('logs:export', async (_event: IpcMainInvokeEvent, params: unknown): Promise<void> => {
    const { outputPath, files, level } = ExportLogsSchema.parse(params)
    await logsService.exportLogs(outputPath, { files, level })
  })
}
