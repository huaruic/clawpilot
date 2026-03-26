import { ipcMain } from 'electron'
import {
  ollamaService,
  OLLAMA_BASE_URL_DEFAULT,
  OLLAMA_PROVIDER_NAME,
  OLLAMA_RECOMMENDED_MODEL,
} from '../services/OllamaService'
import { loadProviderMeta, writeOpenClawConfig } from '../services/OpenClawConfigWriter'
import { listProviderNames, loadApiKey } from '../services/ProviderSecretStore'
import type { OpenClawProcessManager } from '../services/OpenClawProcessManager'
import type { RuntimeState } from '../state/RuntimeState'
import { mainLogger } from '../utils/logger'

interface Deps {
  processManager: OpenClawProcessManager
  state: RuntimeState
  refreshSetup: () => Promise<void>
}

export function registerOllamaIpc({ processManager, state, refreshSetup }: Deps): void {
  ipcMain.handle('ollama:status', async () => {
    const status = await ollamaService.getStatus()
    if (status.recommendedInstalled) {
      await ensureOllamaProvider()
      await refreshSetup()
    }
    return status
  })

  ipcMain.handle('ollama:pullRecommended', async () => {
    const result = await ollamaService.pullRecommended()

    if (result.ok) {
      const status = await ollamaService.getStatus()
      if (status.recommendedInstalled) {
        await ensureOllamaProvider()
        await refreshSetup()
        if (state.snapshot.status === 'RUNNING') {
          mainLogger.info('[ollama:pullRecommended] Restarting gateway after Ollama provider sync...')
          processManager.restart().catch((e) => mainLogger.error('restart failed:', e))
        }
      }
    }

    return result
  })

  ipcMain.handle('ollama:openInstallPage', async () => {
    return ollamaService.openInstallPage()
  })
}

async function ensureOllamaProvider(): Promise<void> {
  const meta = await loadProviderMeta()
  const names = await listProviderNames()
  const allNames = [...new Set([...names, ...meta.map((m) => m.name), OLLAMA_PROVIDER_NAME])]

  const withKeys = await Promise.all(allNames.map(async (name) => {
    if (name === OLLAMA_PROVIDER_NAME) {
      return {
        name,
        baseUrl: OLLAMA_BASE_URL_DEFAULT,
        api: OLLAMA_PROVIDER_NAME,
        models: [{ id: OLLAMA_RECOMMENDED_MODEL, name: 'Qwen 2.5 7B' }],
        apiKey: '',
      }
    }

    const m = meta.find((entry) => entry.name === name)
    return {
      name,
      baseUrl: m?.baseUrl ?? '',
      api: m?.api,
      models: m?.models,
      apiKey: (await loadApiKey(name)) ?? '',
    }
  }))

  await writeOpenClawConfig(withKeys)
}
