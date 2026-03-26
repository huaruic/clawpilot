import { ipcMain } from 'electron'
import {
  SaveProviderSchema,
  TestProviderSchema,
  DeleteProviderSchema,
  SetDefaultModelSchema,
} from './schemas/provider.schema'
import {
  saveApiKey,
  loadApiKey,
  deleteApiKey,
  listProviderNames,
} from '../services/ProviderSecretStore'
import {
  writeOpenClawConfig,
  loadProviderMeta,
  readDefaultModel,
  writeDefaultModel,
  type ProviderMeta,
} from '../services/OpenClawConfigWriter'
import type { OpenClawProcessManager } from '../services/OpenClawProcessManager'
import type { RuntimeState } from '../state/RuntimeState'
import { mainLogger } from '../utils/logger'
import { syncManagedAuthProfiles } from '../services/OpenClawAuthProfileWriter'

interface Deps {
  processManager: OpenClawProcessManager
  state: RuntimeState
  refreshSetup: () => Promise<void>
}

export function registerProviderIpc({ processManager, state, refreshSetup }: Deps): void {
  // List providers managed by ClawPilot, including local providers without API keys.
  ipcMain.handle('provider:list', async () => {
    const names = await listProviderNames()
    const meta = await loadProviderMeta()
    const allNames = [...new Set([...names, ...meta.map((entry) => entry.name)])]
    return allNames.map((name) => {
      const m = meta.find((x) => x.name === name)
      return { name, baseUrl: m?.baseUrl ?? '', api: m?.api, models: m?.models ?? [] }
    })
  })

  ipcMain.handle('provider:save', async (_, raw) => {
    const params = SaveProviderSchema.parse(raw)
    await saveApiKey(params.name, params.apiKey)

    // Build config with full metadata from params (not from openclaw.json which may not have it yet)
    const names = await listProviderNames()
    const meta = await loadProviderMeta()
    const withKeys = await Promise.all(
      names.map(async (name) => {
        if (name === params.name) {
          return { name, baseUrl: params.baseUrl, api: params.api, models: params.models, apiKey: params.apiKey }
        }
        const m = meta.find((x) => x.name === name)
        return { name, baseUrl: m?.baseUrl ?? '', api: m?.api, models: m?.models, apiKey: (await loadApiKey(name)) ?? '' }
      })
    )
    await writeOpenClawConfig(withKeys)
    await syncManagedAuthProfiles(withKeys.map((entry) => ({ name: entry.name, apiKey: entry.apiKey })))
    await refreshSetup()

    if (state.snapshot.status === 'RUNNING') {
      mainLogger.info('[provider:save] Restarting gateway for new config...')
      processManager.restart().catch((e) => mainLogger.error('restart failed:', e))
    }
    return { ok: true }
  })

  ipcMain.handle('provider:delete', async (_, raw) => {
    const { name } = DeleteProviderSchema.parse(raw)
    await deleteApiKey(name)
    await rebuildConfig()
    await refreshSetup()
    if (state.snapshot.status === 'RUNNING') {
      processManager.restart().catch((e) => mainLogger.error('restart failed:', e))
    }
    return { ok: true }
  })

  ipcMain.handle('provider:getDefault', async () => {
    return readDefaultModel()
  })

  ipcMain.handle('provider:setDefault', async (_, raw) => {
    const { model } = SetDefaultModelSchema.parse(raw)
    await writeDefaultModel(model)
    await refreshSetup()
    if (state.snapshot.status === 'RUNNING') {
      mainLogger.info('[provider:setDefault] Restarting gateway for new default model...')
      processManager.restart().catch((e) => mainLogger.error('restart failed:', e))
    }
    return { ok: true }
  })

  ipcMain.handle('provider:test', async (_, raw) => {
    const params = TestProviderSchema.parse(raw)
    try {
      const url = `${params.baseUrl.replace(/\/$/, '')}/models`
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${params.apiKey}` },
        signal: AbortSignal.timeout(8000),
      })
      const text = await res.text()
      let models: string[] = []
      try {
        const data = JSON.parse(text) as { data?: Array<{ id: string }> }
        models = data.data?.map((m) => m.id) ?? []
      } catch { /* non-JSON response */ }
      return { ok: res.ok, status: res.status, models }
    } catch (err) {
      return { ok: false, error: String(err) }
    }
  })
}

// Rebuild openclaw.json from safeStorage keys + openclaw.json metadata
async function rebuildConfig(): Promise<void> {
  const names = await listProviderNames()
  const meta = await loadProviderMeta()
  const entries: ProviderMeta[] = names.map((name) => {
    const m = meta.find((x) => x.name === name)
    return { name, baseUrl: m?.baseUrl ?? '', api: m?.api, models: m?.models }
  })
  const withKeys = await Promise.all(
    entries.map(async (m) => ({ ...m, apiKey: (await loadApiKey(m.name)) ?? '' }))
  )
  await writeOpenClawConfig(withKeys)
  await syncManagedAuthProfiles(withKeys.map((entry) => ({ name: entry.name, apiKey: entry.apiKey })))
}
