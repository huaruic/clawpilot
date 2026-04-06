import { app, BrowserWindow, shell } from 'electron'
import { join } from 'node:path'
import { RuntimeState } from './state/RuntimeState'
import { OpenClawProcessManager } from './services/OpenClawProcessManager'
import { WsGatewayClient } from './services/WsGatewayClient'
import { registerAllIpc } from './ipc/index'
import { registerChatEventForwarding } from './ipc/chat.ipc'
import { mainLogger } from './utils/logger'
import { ensureOpenClawBaseConfig, inspectOpenClawSetup, waitForGatewayToken } from './services/OpenClawConfigWriter'
import { syncAllProvidersToRuntime, syncRoutingProfilesAfterProviderChange } from './services/ProviderRuntimeSync'
import { ensureAllChannelPlugins } from './services/ChannelConfigService'
import { deviceOAuthManager } from './services/DeviceOAuthManager'
import { browserOAuthManager } from './services/BrowserOAuthManager'

// Keep dev and packaged builds on the same userData root.
app.setName('ClawPilot')
app.setPath('userData', join(app.getPath('appData'), 'ClawPilot'))

let mainWindow: BrowserWindow | null = null
const gotSingleInstanceLock = app.requestSingleInstanceLock()

const state = new RuntimeState()
const processManager = new OpenClawProcessManager(state)
let wsClient: WsGatewayClient | null = null
let lastRuntimeStatus = state.snapshot.status
let wsConnectInFlight = false

async function refreshSetup(): Promise<void> {
  state.setSetup(await inspectOpenClawSetup())
}

function createWindow(): BrowserWindow {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0a0a0a',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  mainWindow.on('closed', () => { mainWindow = null })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

if (!gotSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  })
}

app.whenReady().then(async () => {
  mainLogger.info('App ready')
  await ensureOpenClawBaseConfig()

  // Sync provider accounts from electron-store to openclaw.json on startup.
  // Without this, models.providers can be empty after a restart, leaving the
  // gateway with no LLM to generate responses for channel messages.
  try {
    await syncAllProvidersToRuntime()
    await syncRoutingProfilesAfterProviderChange()
    await ensureAllChannelPlugins()
    mainLogger.info('Provider, routing, and channel plugins synced on startup')
  } catch (err) {
    mainLogger.warn('Failed to sync on startup:', err)
  }

  await refreshSetup()
  const win = createWindow()
  deviceOAuthManager.setWindow(win)
  browserOAuthManager.setWindow(win)

  registerAllIpc({
    processManager,
    state,
    refreshSetup,
    getMainWindow: () => mainWindow,
    getWsClient: () => {
      if (!wsClient) throw new Error('WsGatewayClient not yet connected')
      return wsClient
    },
  })

  // Connect WsGatewayClient when gateway becomes RUNNING
  state.onChange(async (snap) => {
    const statusChanged = snap.status !== lastRuntimeStatus
    lastRuntimeStatus = snap.status

    if (snap.status === 'RUNNING' && statusChanged) {
      if (wsClient?.isConnected || wsConnectInFlight) return
      wsConnectInFlight = true
      await refreshSetup()
      await waitForGatewayToken()
      const client = new WsGatewayClient(snap.port)
      wsClient = client
      try {
        await client.connect()
        mainLogger.info('[Main] WsGatewayClient connected')
        registerChatEventForwarding(client, () => mainWindow)
      } catch (err) {
        mainLogger.error('[Main] WsGatewayClient connect failed:', String(err))
        wsClient = null
      } finally {
        wsConnectInFlight = false
      }
    } else if ((snap.status === 'STOPPED' || snap.status === 'ERROR') && statusChanged) {
      if (wsClient?.isConnected) {
        wsClient.disconnect()
      }
      wsClient = null
      wsConnectInFlight = false
      await refreshSetup()
    }
  })

  if (state.snapshot.setup.hasProvider && state.snapshot.setup.hasDefaultModel) {
    mainLogger.info('Auto-starting OpenClaw...')
    processManager.start().catch((err) => {
      mainLogger.error('Auto-start failed:', err.message)
    })
  } else {
    mainLogger.info('Skipping auto-start: no provider or default model configured')
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', async () => {
  mainLogger.info('All windows closed, shutting down...')
  wsClient?.disconnect()
  await processManager.stop()
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', async (event) => {
  if (state.snapshot.status === 'RUNNING') {
    event.preventDefault()
    mainLogger.info('Stopping OpenClaw before quit...')
    wsClient?.disconnect()
    await processManager.stop()
    app.quit()
  }
})
