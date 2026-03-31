import { ipcMain, type IpcMainInvokeEvent } from 'electron'
import { OpenClawDiagnostics, type DiagnosticReport, type DiagnosticIssue } from '../services/OpenClawDiagnostics'
import { z } from 'zod'
import type { RuntimeStatus } from '../state/RuntimeState'

// Schemas
const FixIssueSchema = z.object({
  category: z.enum(['runtime', 'config', 'provider', 'channel', 'skill', 'workspace']),
  severity: z.enum(['error', 'warning', 'info']),
  title: z.string(),
  description: z.string(),
  details: z.string().optional(),
  fixable: z.boolean(),
  fixCommand: z.string().optional(),
})

const ExportBundleSchema = z.object({
  outputPath: z.string(),
})

export function registerDiagnosticsIpc(
  diagnostics: OpenClawDiagnostics,
  getRuntimeStatus: () => RuntimeStatus,
): void {
  /**
   * 运行完整诊断
   */
  ipcMain.handle('diagnostics:run', async (_event: IpcMainInvokeEvent): Promise<DiagnosticReport> => {
    const report = await diagnostics.runDiagnostics()
    if (getRuntimeStatus() === 'STOPPED') {
      if (report.overallStatus === 'healthy') {
        report.overallStatus = 'warning'
      }
      report.issues.unshift({
        category: 'runtime',
        severity: 'warning',
        title: '网关未启动',
        description: '当前网关处于停止状态，请先启动后再进行完整诊断。',
        fixable: false,
      })
    }
    return report
  })

  /**
   * 快速健康检查
   */
  ipcMain.handle('diagnostics:quickCheck', async (_event: IpcMainInvokeEvent): Promise<{
    healthy: boolean
    criticalIssues: DiagnosticIssue[]
  }> => {
    return await diagnostics.quickHealthCheck()
  })

  /**
   * 修复问题
   */
  ipcMain.handle('diagnostics:fix', async (_event: IpcMainInvokeEvent, issue: unknown): Promise<{
    success: boolean
    message: string
    output?: string
  }> => {
    const validated = FixIssueSchema.parse(issue)
    return await diagnostics.fixIssue(validated)
  })

  /**
   * 导出诊断报告
   */
  ipcMain.handle('diagnostics:exportBundle', async (_event: IpcMainInvokeEvent, params: unknown): Promise<void> => {
    const { outputPath } = ExportBundleSchema.parse(params)
    await diagnostics.exportDiagnosticBundle(outputPath)
  })
}
