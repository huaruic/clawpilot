import { ipcMain, BrowserWindow, dialog, shell } from 'electron'
import type { OpenClawProcessManager } from '../services/OpenClawProcessManager'
import type { RuntimeState } from '../state/RuntimeState'
import {
  readGatewayToken,
  readSearchConfig,
  resetWorkspaceRoot,
  writeSearchConfig,
  writeWorkspaceRoot,
} from '../services/OpenClawConfigWriter'
import type { SearchProvider } from '../services/OpenClawConfigWriter'
import {
  getSystemLocale,
  readAppSettings,
  updateAppSettings,
} from '../services/AppSettingsStore'

interface Deps {
  processManager: OpenClawProcessManager
  state: RuntimeState
  refreshSetup: () => Promise<void>
  getMainWindow: () => BrowserWindow | null
}

export function registerAppIpc({ processManager, state, refreshSetup, getMainWindow }: Deps): void {
  ipcMain.handle('app:start', async () => {
    await processManager.start()
    await refreshSetup()
    return state.snapshot
  })

  ipcMain.handle('app:stop', async () => {
    await processManager.stop()
    await refreshSetup()
    return state.snapshot
  })

  ipcMain.handle('app:restart', async () => {
    await processManager.restart()
    await refreshSetup()
    return state.snapshot
  })

  ipcMain.handle('app:status', () => {
    return state.snapshot
  })

  ipcMain.handle('app:getGatewayToken', async () => {
    return await readGatewayToken()
  })

  ipcMain.handle('app:getSettings', async () => {
    return await readAppSettings()
  })

  ipcMain.handle('app:updateSettings', async (_, raw) => {
    return await updateAppSettings((raw as { patch?: unknown } | null)?.patch as Record<string, unknown> ?? {})
  })

  ipcMain.handle('app:getSystemLocale', () => {
    return getSystemLocale()
  })

  ipcMain.handle('app:showSaveDialog', async (_, raw) => {
    const params = (raw as {
      title?: unknown
      defaultPath?: unknown
      filters?: unknown
    } | null) ?? {}
    const result = await dialog.showSaveDialog(getMainWindow() ?? undefined, {
      title: typeof params.title === 'string' ? params.title : 'Save File',
      defaultPath: typeof params.defaultPath === 'string' ? params.defaultPath : undefined,
      filters: Array.isArray(params.filters) ? params.filters as Array<{ name: string; extensions: string[] }> : undefined,
    })

    if (result.canceled) {
      return null
    }

    return result.filePath ?? null
  })

  ipcMain.handle('app:chooseWorkspaceRoot', async () => {
    const result = await dialog.showOpenDialog(getMainWindow() ?? undefined, {
      title: 'Choose Workspace Folder',
      properties: ['openDirectory', 'createDirectory'],
    })

    if (result.canceled) {
      return null
    }

    return result.filePaths[0] ?? null
  })

  ipcMain.handle('app:setWorkspaceRoot', async (_, raw) => {
    const workspaceRoot = String((raw as { workspaceRoot?: unknown })?.workspaceRoot ?? '').trim()
    if (!workspaceRoot) {
      throw new Error('Workspace path is required')
    }

    await writeWorkspaceRoot(workspaceRoot)
    await refreshSetup()

    if (state.snapshot.status === 'RUNNING') {
      await processManager.restart()
    }

    await refreshSetup()
    return state.snapshot
  })

  ipcMain.handle('app:resetWorkspaceRoot', async () => {
    await resetWorkspaceRoot()
    await refreshSetup()

    if (state.snapshot.status === 'RUNNING') {
      await processManager.restart()
    }

    await refreshSetup()
    return state.snapshot
  })

  ipcMain.handle('app:openDirectory', async (_, raw) => {
    const path = String((raw as { path?: unknown } | null)?.path ?? '').trim()
    if (!path) {
      return { ok: false, error: 'Path is required' }
    }

    const result = await shell.openPath(path)
    if (result) {
      return { ok: false, error: result }
    }

    return { ok: true }
  })

  ipcMain.handle('app:getSearchConfig', async () => {
    return await readSearchConfig()
  })

  ipcMain.handle('app:saveSearchConfig', async (_, raw) => {
    const { provider, apiKey } = raw as { provider: SearchProvider; apiKey: string }
    await writeSearchConfig(provider, apiKey)

    if (state.snapshot.status === 'RUNNING') {
      await processManager.restart()
    }

    return { ok: true }
  })

  // Push status changes to renderer
  state.onChange((snap) => {
    getMainWindow()?.webContents.send('app:status-changed', snap)
  })
}
