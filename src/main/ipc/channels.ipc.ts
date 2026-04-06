import { ipcMain } from 'electron'
import type { OpenClawProcessManager } from '../services/OpenClawProcessManager'
import type { RuntimeState } from '../state/RuntimeState'
import {
  SaveChannelConfigSchema,
  ChannelTypeSchema,
  ValidateChannelCredentialsSchema,
} from './schemas/channels.schema'
import {
  loadChannelConfig,
  saveChannelConfig,
  deleteChannelConfig,
  listConfiguredChannels,
} from '../services/ChannelConfigService'
import { validateChannelCredentials } from '../services/ChannelValidationService'
import { mainLogger } from '../utils/logger'

interface Deps {
  processManager: OpenClawProcessManager
  state: RuntimeState
  refreshSetup: () => Promise<void>
}

export function registerChannelsIpc({ processManager, state, refreshSetup }: Deps): void {
  // ── Generic channel handlers ────────────────────────────────────

  ipcMain.handle('channels:getConfig', async (_, raw) => {
    const { channelType } = ChannelTypeSchema.parse(raw)
    const config = await loadChannelConfig(channelType)
    return {
      ...config,
      runtimeRunning: state.snapshot.status === 'RUNNING',
    }
  })

  ipcMain.handle('channels:saveConfig', async (_, raw) => {
    const { channelType, values } = SaveChannelConfigSchema.parse(raw)
    await saveChannelConfig(channelType, values)
    await refreshSetup()

    const runtimeRunning = state.snapshot.status === 'RUNNING'
    if (runtimeRunning) {
      mainLogger.info(`[channels:saveConfig] Restarting gateway for ${channelType} config...`)
      await processManager.restart()
    }

    return { ok: true, runtimeRestarted: runtimeRunning }
  })

  ipcMain.handle('channels:deleteConfig', async (_, raw) => {
    const { channelType } = ChannelTypeSchema.parse(raw)
    await deleteChannelConfig(channelType)
    await refreshSetup()

    const runtimeRunning = state.snapshot.status === 'RUNNING'
    if (runtimeRunning) {
      mainLogger.info(`[channels:deleteConfig] Restarting gateway after ${channelType} deletion...`)
      await processManager.restart()
    }

    return { ok: true, runtimeRestarted: runtimeRunning }
  })

  ipcMain.handle('channels:validateCredentials', async (_, raw) => {
    const { channelType, values } = ValidateChannelCredentialsSchema.parse(raw)
    return validateChannelCredentials(channelType, values)
  })

  ipcMain.handle('channels:listConfigured', async () => {
    return listConfiguredChannels()
  })

}
