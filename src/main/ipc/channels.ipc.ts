import { ipcMain } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'
import type { OpenClawProcessManager } from '../services/OpenClawProcessManager'
import type { RuntimeState } from '../state/RuntimeState'
import { SaveFeishuConfigSchema, ApproveFeishuPairingSchema } from './schemas/channels.schema'
import {
  loadFeishuConfig,
  resetFeishuChannel,
  writeFeishuConfig,
} from '../services/OpenClawConfigWriter'
import { runOpenClawCli } from '../services/OpenClawCliRunner'
import { validateFeishuCredentials } from '../services/FeishuService'
import { getOpenClawStateDir } from '../services/RuntimeLocator'
import { mainLogger } from '../utils/logger'

interface Deps {
  processManager: OpenClawProcessManager
  state: RuntimeState
  refreshSetup: () => Promise<void>
}

interface PairingRequest {
  id: string
  code: string
  createdAt: string
  lastSeenAt?: string
  meta?: Record<string, unknown>
}

export function registerChannelsIpc({ processManager, state, refreshSetup }: Deps): void {
  ipcMain.handle('channels:feishu:validateCredentials', async (_, raw) => {
    return validateFeishuCredentials(raw)
  })

  ipcMain.handle('channels:feishu:getConfig', async () => {
    const config = await loadFeishuConfig()
    return {
      ...config,
      runtimeRunning: state.snapshot.status === 'RUNNING',
    }
  })

  ipcMain.handle('channels:feishu:saveConfig', async (_, raw) => {
    const params = SaveFeishuConfigSchema.parse(raw)
    await writeFeishuConfig(params)
    await refreshSetup()

    const runtimeRunning = state.snapshot.status === 'RUNNING'
    if (runtimeRunning) {
      mainLogger.info('[channels:feishu:saveConfig] Restarting gateway for Feishu config...')
      await processManager.restart()
    }

    return {
      ok: true,
      runtimeRestarted: runtimeRunning,
    }
  })

  ipcMain.handle('channels:feishu:reset', async () => {
    await resetFeishuChannel()
    await refreshSetup()

    const runtimeRunning = state.snapshot.status === 'RUNNING'
    if (runtimeRunning) {
      mainLogger.info('[channels:feishu:reset] Restarting gateway after Feishu reset...')
      await processManager.restart()
    }

    return {
      ok: true,
      runtimeRestarted: runtimeRunning,
    }
  })

  ipcMain.handle('channels:feishu:getLatestPairing', async () => {
    try {
      return { ok: true, request: await readLatestFeishuPairingFromStore() }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle('channels:feishu:approvePairing', async (_, raw) => {
    const { code } = ApproveFeishuPairingSchema.parse(raw)
    const normalizedCode = code.trim().toUpperCase()
    const result = await runOpenClawCli(['pairing', 'approve', 'feishu', normalizedCode], 15000)

    if (result.code !== 0) {
      return { ok: false, error: result.stderr || result.stdout || 'Failed to approve pairing code' }
    }

    return {
      ok: true,
      message: result.stdout || `Approved pairing code ${normalizedCode}`,
    }
  })
}

async function readLatestFeishuPairingFromStore(): Promise<PairingRequest | null> {
  try {
    const filePath = path.join(getOpenClawStateDir(), 'credentials', 'feishu-pairing.json')
    const raw = await fs.readFile(filePath, 'utf-8')
    const parsed = JSON.parse(raw) as { requests?: PairingRequest[] }
    const requests = Array.isArray(parsed.requests) ? parsed.requests : []
    return requests.toSorted((a, b) => {
      const left = Date.parse(a.lastSeenAt ?? a.createdAt ?? '') || 0
      const right = Date.parse(b.lastSeenAt ?? b.createdAt ?? '') || 0
      return right - left
    })[0] ?? null
  } catch {
    return null
  }
}
