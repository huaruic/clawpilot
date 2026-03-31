import { runOpenClawCli } from './OpenClawCliRunner'
import { getOpenClawStateDir } from './RuntimeLocator'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'

export interface DiagnosticIssue {
  category: 'runtime' | 'config' | 'provider' | 'channel' | 'skill' | 'workspace'
  severity: 'error' | 'warning' | 'info'
  title: string
  description: string
  details?: string
  fixable: boolean
  fixCommand?: string
}

export interface DiagnosticReport {
  timestamp: number
  overallStatus: 'healthy' | 'warning' | 'error'
  issues: DiagnosticIssue[]
  systemInfo: {
    platform: string
    nodeVersion: string
    openclawVersion?: string
    stateDir: string
  }
}

export interface DiagnosticFixResult {
  success: boolean
  message: string
  output?: string
}

/**
 * OpenClaw 诊断服务
 * 集成 OpenClaw doctor 命令并提供诊断能力
 */
export class OpenClawDiagnostics {
  /**
   * 运行完整诊断
   */
  async runDiagnostics(): Promise<DiagnosticReport> {
    const issues: DiagnosticIssue[] = []
    const stateDir = getOpenClawStateDir()

    try {
      // 运行 OpenClaw doctor 命令
      const doctorResult = await runOpenClawCli(['doctor'], 30000)

      // 解析 doctor 输出
      const parsedIssues = this.parseDoctorOutput(doctorResult.stdout, doctorResult.stderr)
      issues.push(...parsedIssues)

      // 额外的自定义检查
      const customChecks = await this.runCustomChecks()
      issues.push(...customChecks)
    } catch (error) {
      issues.push({
        category: 'runtime',
        severity: 'error',
        title: 'Doctor 命令执行失败',
        description: '无法运行 OpenClaw 诊断命令',
        details: error instanceof Error ? error.message : String(error),
        fixable: false,
      })
    }

    // 确定整体状态
    const overallStatus = this.determineOverallStatus(issues)

    return {
      timestamp: Date.now(),
      overallStatus,
      issues,
      systemInfo: {
        platform: process.platform,
        nodeVersion: process.version,
        stateDir,
      },
    }
  }

  /**
   * 运行快速健康检查
   */
  async quickHealthCheck(): Promise<{
    healthy: boolean
    criticalIssues: DiagnosticIssue[]
  }> {
    const issues: DiagnosticIssue[] = []

    // 检查关键文件
    const configCheck = await this.checkConfigFile()
    if (configCheck) issues.push(configCheck)

    // 检查 workspace
    const workspaceCheck = await this.checkWorkspace()
    if (workspaceCheck) issues.push(workspaceCheck)

    const criticalIssues = issues.filter((i) => i.severity === 'error')

    return {
      healthy: criticalIssues.length === 0,
      criticalIssues,
    }
  }

  /**
   * 尝试自动修复问题
   */
  async fixIssue(issue: DiagnosticIssue): Promise<DiagnosticFixResult> {
    if (!issue.fixable || !issue.fixCommand) {
      return {
        success: false,
        message: '此问题不支持自动修复',
      }
    }

    try {
      // 运行修复命令
      const result = await runOpenClawCli(['doctor', '--fix', issue.fixCommand], 30000)

      if (result.code === 0) {
        return {
          success: true,
          message: '修复成功',
          output: result.stdout,
        }
      } else {
        return {
          success: false,
          message: '修复失败',
          output: result.stderr || result.stdout,
        }
      }
    } catch (error) {
      return {
        success: false,
        message: `修复过程出错: ${error instanceof Error ? error.message : String(error)}`,
      }
    }
  }

  /**
   * 导出完整诊断报告（包含日志）
   */
  async exportDiagnosticBundle(outputPath: string): Promise<void> {
    const report = await this.runDiagnostics()
    const stateDir = getOpenClawStateDir()

    // 收集日志文件
    const logs: Record<string, string> = {}
    try {
      const logsDir = path.join(stateDir, 'logs')
      const logFiles = await fs.readdir(logsDir)

      for (const file of logFiles.slice(-10)) {
        // 只取最近 10 个日志
        const content = await fs.readFile(path.join(logsDir, file), 'utf-8')
        logs[file] = content
      }
    } catch {
      // 日志目录可能不存在
    }

    // 读取配置文件
    let config = ''
    try {
      const configPath = path.join(stateDir, 'openclaw.json')
      config = await fs.readFile(configPath, 'utf-8')
    } catch {
      // 配置文件可能不存在
    }

    const bundle = {
      report,
      logs,
      config,
      timestamp: new Date().toISOString(),
    }

    await fs.writeFile(outputPath, JSON.stringify(bundle, null, 2), 'utf-8')
  }

  /**
   * 解析 doctor 命令输出
   */
  private parseDoctorOutput(stdout: string, stderr: string): DiagnosticIssue[] {
    const issues: DiagnosticIssue[] = []

    // OpenClaw doctor 输出格式解析
    // 假设格式为：[SEVERITY] Category: Message
    const lines = (stdout + '\n' + stderr).split('\n')

    for (const line of lines) {
      const match = line.match(/^\[(ERROR|WARNING|INFO)\]\s+(\w+):\s+(.+)$/)
      if (match) {
        const [, severityStr, category, message] = match
        const severity = severityStr.toLowerCase() as 'error' | 'warning' | 'info'

        issues.push({
          category: this.mapCategory(category),
          severity,
          title: message,
          description: message,
          fixable: false,
        })
      }
    }

    return issues
  }

  /**
   * 运行自定义检查
   */
  private async runCustomChecks(): Promise<DiagnosticIssue[]> {
    const issues: DiagnosticIssue[] = []

    // 检查配置文件
    const configCheck = await this.checkConfigFile()
    if (configCheck) issues.push(configCheck)

    // 检查 workspace
    const workspaceCheck = await this.checkWorkspace()
    if (workspaceCheck) issues.push(workspaceCheck)

    // 检查磁盘空间
    const diskCheck = await this.checkDiskSpace()
    if (diskCheck) issues.push(diskCheck)

    return issues
  }

  /**
   * 检查配置文件
   */
  private async checkConfigFile(): Promise<DiagnosticIssue | null> {
    const stateDir = getOpenClawStateDir()
    const configPath = path.join(stateDir, 'openclaw.json')

    try {
      const content = await fs.readFile(configPath, 'utf-8')
      JSON.parse(content) // 验证 JSON 格式
      return null
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return {
          category: 'config',
          severity: 'error',
          title: '配置文件缺失',
          description: 'openclaw.json 不存在',
          details: `路径: ${configPath}`,
          fixable: true,
          fixCommand: 'init-config',
        }
      } else {
        return {
          category: 'config',
          severity: 'error',
          title: '配置文件格式错误',
          description: 'openclaw.json 不是有效的 JSON',
          details: error instanceof Error ? error.message : String(error),
          fixable: false,
        }
      }
    }
  }

  /**
   * 检查 workspace
   */
  private async checkWorkspace(): Promise<DiagnosticIssue | null> {
    const stateDir = getOpenClawStateDir()
    const workspacePath = path.join(stateDir, 'workspace-default')

    try {
      const stat = await fs.stat(workspacePath)
      if (!stat.isDirectory()) {
        return {
          category: 'workspace',
          severity: 'error',
          title: 'Workspace 不是目录',
          description: 'workspace-default 路径存在但不是目录',
          fixable: false,
        }
      }
      return null
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return {
          category: 'workspace',
          severity: 'warning',
          title: 'Workspace 不存在',
          description: 'workspace-default 目录不存在',
          details: `路径: ${workspacePath}`,
          fixable: true,
          fixCommand: 'init-workspace',
        }
      }
      return null
    }
  }

  /**
   * 检查磁盘空间
   */
  private async checkDiskSpace(): Promise<DiagnosticIssue | null> {
    // 简化实现：检查 state dir 是否可写
    const stateDir = getOpenClawStateDir()

    try {
      await fs.access(stateDir, fs.constants.W_OK)
      return null
    } catch {
      return {
        category: 'runtime',
        severity: 'error',
        title: 'State 目录不可写',
        description: 'OpenClaw 数据目录没有写入权限',
        details: `路径: ${stateDir}`,
        fixable: false,
      }
    }
  }

  /**
   * 映射分类
   */
  private mapCategory(category: string): DiagnosticIssue['category'] {
    const lower = category.toLowerCase()
    if (lower.includes('runtime')) return 'runtime'
    if (lower.includes('config')) return 'config'
    if (lower.includes('provider')) return 'provider'
    if (lower.includes('channel')) return 'channel'
    if (lower.includes('skill')) return 'skill'
    if (lower.includes('workspace')) return 'workspace'
    return 'runtime'
  }

  /**
   * 确定整体状态
   */
  private determineOverallStatus(
    issues: DiagnosticIssue[],
  ): 'healthy' | 'warning' | 'error' {
    if (issues.some((i) => i.severity === 'error')) return 'error'
    if (issues.some((i) => i.severity === 'warning')) return 'warning'
    return 'healthy'
  }
}
