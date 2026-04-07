import { ipcMain, type BrowserWindow } from 'electron'
import type { WsGatewayClient } from '../services/WsGatewayClient'
import { syncDailyTotals, syncSessionUsage, syncFromSessionsList, getUsageData } from '../services/UsageStore'
import { DashboardGetUsageSchema } from './schemas/dashboard.schema'
import { mainLogger } from '../utils/logger'

interface Deps {
  getWsClient: () => WsGatewayClient
  getMainWindow: () => BrowserWindow | null
}

/**
 * Fetch usage data from OpenClaw RPCs and sync to UsageStore.
 * Optionally pushes a notification to the renderer.
 */
export async function syncUsageFromGateway(
  wsClient: WsGatewayClient,
  getMainWindow?: () => BrowserWindow | null,
): Promise<void> {
  try {
    const [costResp, sessionsUsageResp, sessionsListResp] = await Promise.all([
      wsClient.request('usage.cost', {}).catch((e) => {
        mainLogger.warn('[dashboard] usage.cost failed:', String(e))
        return null
      }),
      wsClient.request('sessions.usage', {}).catch((e) => {
        mainLogger.warn('[dashboard] sessions.usage failed:', String(e))
        return null
      }),
      wsClient.request('sessions.list', { includeDerivedTitles: false }).catch((e) => {
        mainLogger.warn('[dashboard] sessions.list failed:', String(e))
        return null
      }),
    ])

    if (costResp) await syncDailyTotals(costResp)
    if (sessionsUsageResp) await syncSessionUsage(sessionsUsageResp)
    if (sessionsListResp) {
      await syncFromSessionsList(sessionsListResp)
    } else {
      mainLogger.warn('[dashboard] sessions.list returned null — no session data to sync')
    }

    // Push notification to renderer
    getMainWindow?.()?.webContents.send('dashboard:updated')
  } catch (err) {
    mainLogger.warn('[dashboard] sync failed:', String(err))
  }
}

export function registerDashboardIpc({ getWsClient, getMainWindow }: Deps): void {
  // ── Get usage data (from persistent store) ──
  ipcMain.handle('dashboard:getUsage', async (_, raw) => {
    const params = DashboardGetUsageSchema.parse(raw ?? {})
    return getUsageData({ since: params.since })
  })

  // ── Trigger sync from gateway RPCs ──
  ipcMain.handle('dashboard:refresh', async () => {
    try {
      const client = getWsClient()
      await syncUsageFromGateway(client, getMainWindow)
      return { ok: true }
    } catch (err) {
      mainLogger.warn('[dashboard:refresh] failed:', String(err))
      return { ok: false, error: String(err) }
    }
  })
}
