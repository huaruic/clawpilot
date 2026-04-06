import { ipcMain } from 'electron'
import type { OpenClawProcessManager } from '../services/OpenClawProcessManager'
import type { RuntimeState } from '../state/RuntimeState'
import {
  CreateProfileSchema,
  UpdateProfileSchema,
  DeleteProfileSchema,
  RouteQuerySchema,
  SetRouteSchema,
  ClearRouteSchema,
} from './schemas/routing.schema'
import {
  listProfiles,
  createProfile,
  updateProfile,
  deleteProfile,
  getRoute,
  setRoute,
  clearRoute,
} from '../services/RoutingService'
import { mainLogger } from '../utils/logger'

interface Deps {
  processManager: OpenClawProcessManager
  state: RuntimeState
}

function scheduleReloadIfRunning(deps: Deps, reason: string): void {
  if (deps.state.snapshot.status === 'RUNNING') {
    mainLogger.info(`[routing] Reloading gateway: ${reason}`)
    deps.processManager.restart().catch((err) => {
      mainLogger.warn(`[routing] Gateway reload failed after ${reason}:`, err)
    })
  }
}

export function registerRoutingIpc(deps: Deps): void {
  ipcMain.handle('routing:listProfiles', async () => {
    return listProfiles()
  })

  ipcMain.handle('routing:createProfile', async (_, raw) => {
    const input = CreateProfileSchema.parse(raw)
    const profile = await createProfile(input)
    scheduleReloadIfRunning(deps, `create-profile:${profile.id}`)
    return profile
  })

  ipcMain.handle('routing:updateProfile', async (_, raw) => {
    const { id, ...updates } = UpdateProfileSchema.parse(raw)
    const profile = await updateProfile(id, updates)
    scheduleReloadIfRunning(deps, `update-profile:${id}`)
    return profile
  })

  ipcMain.handle('routing:deleteProfile', async (_, raw) => {
    const { id } = DeleteProfileSchema.parse(raw)
    await deleteProfile(id)
    scheduleReloadIfRunning(deps, `delete-profile:${id}`)
    return { ok: true }
  })

  ipcMain.handle('routing:getRoute', async (_, raw) => {
    const { channelType, accountId } = RouteQuerySchema.parse(raw)
    return getRoute(channelType, accountId)
  })

  ipcMain.handle('routing:setRoute', async (_, raw) => {
    const { channelType, accountId, profileId } = SetRouteSchema.parse(raw)
    await setRoute(channelType, accountId, profileId)
    scheduleReloadIfRunning(deps, `set-route:${channelType}:${accountId}→${profileId}`)
    return { ok: true }
  })

  ipcMain.handle('routing:clearRoute', async (_, raw) => {
    const { channelType, accountId } = ClearRouteSchema.parse(raw)
    await clearRoute(channelType, accountId)
    scheduleReloadIfRunning(deps, `clear-route:${channelType}:${accountId}`)
    return { ok: true }
  })
}
