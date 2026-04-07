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
import { registerRoutingIpc } from './routing.ipc'
import { registerDiagnosticsIpc } from './diagnostics.ipc'
import { OpenClawDiagnostics } from '../services/OpenClawDiagnostics'

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
  registerRoutingIpc({ processManager: deps.processManager, state: deps.state })
  registerSkillsIpc()

  // Diagnostics and Logs
  const diagnostics = new OpenClawDiagnostics()
  registerDiagnosticsIpc(diagnostics, () => deps.state.snapshot.status)
}
