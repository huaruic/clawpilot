import { BrowserWindow } from 'electron'
import type { OpenClawProcessManager } from '../services/OpenClawProcessManager'
import type { RuntimeState } from '../state/RuntimeState'
import type { WsGatewayClient } from '../services/WsGatewayClient'
import { registerAppIpc } from './app.ipc'
import { registerChatIpc } from './chat.ipc'
import { registerOllamaIpc } from './ollama.ipc'
import { registerProviderIpc } from './provider.ipc'
import { registerChannelsIpc } from './channels.ipc'
import { registerSkillsIpc } from './skills.ipc'
import { registerDiagnosticsIpc } from './diagnostics.ipc'
import { registerLogsIpc } from './logs.ipc'
import { registerUsageIpc } from './usage.ipc'
import { OpenClawDiagnostics } from '../services/OpenClawDiagnostics'
import { LogsService } from '../services/LogsService'
import { UsageService } from '../services/UsageService'

interface Deps {
  processManager: OpenClawProcessManager
  getWsClient: () => WsGatewayClient
  state: RuntimeState
  refreshSetup: () => Promise<void>
  getMainWindow: () => BrowserWindow | null
}

export function registerAllIpc(deps: Deps): void {
  registerAppIpc(deps)
  registerChatIpc({ getWsClient: deps.getWsClient, getMainWindow: deps.getMainWindow })
  registerOllamaIpc({ processManager: deps.processManager, state: deps.state, refreshSetup: deps.refreshSetup })
  registerProviderIpc({ processManager: deps.processManager, state: deps.state, refreshSetup: deps.refreshSetup })
  registerChannelsIpc({ processManager: deps.processManager, state: deps.state, refreshSetup: deps.refreshSetup })
  registerSkillsIpc()

  // Diagnostics and Logs
  const diagnostics = new OpenClawDiagnostics()
  const logsService = new LogsService()
  registerDiagnosticsIpc(diagnostics)
  registerLogsIpc(logsService)

  // Usage / Token Cost
  const usageService = new UsageService()
  registerUsageIpc(usageService)
}
