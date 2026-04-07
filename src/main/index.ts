import { app, BrowserWindow, shell } from 'electron'
import { join } from 'node:path'
import { RuntimeState } from './state/RuntimeState'
import { OpenClawProcessManager } from './services/OpenClawProcessManager'
import { WsGatewayClient } from './services/WsGatewayClient'
import { registerAllIpc } from './ipc/index'
import { registerChatEventForwarding } from './ipc/chat.ipc'
import { mainLogger } from './utils/logger'
import { inspectOpenClawSetup, readGatewayToken } from './services/OpenClawConfigWriter'
import { syncAllProvidersToRuntime, syncRoutingProfilesAfterProviderChange } from './services/ProviderRuntimeSync'
import { ensureAllChannelPlugins } from './services/ChannelConfigService'
import { deviceOAuthManager } from './services/DeviceOAuthManager'
import { browserOAuthManager } from './services/BrowserOAuthManager'
import { syncUsageFromGateway } from './ipc/dashboard.ipc'

// Keep dev and packaged builds on the same userData root.
app.setName('ClawPilot')
app.setPath('userData', join(app.getPath('appData'), 'ClawPilot'))

let mainWindow: BrowserWindow | null = null
const gotSingleInstanceLock = app.requestSingleInstanceLock()

const state = new RuntimeState()
const processManager = new OpenClawProcessManager(state)
let wsClient: WsGatewayClient | null = null
let wsConnectInFlight = false

async function refreshSetup(): Promise<void> {
  state.setSetup(await inspectOpenClawSetup())
}

// ── WS connection with retry ──────────────────────────────────────

const WS_MAX_RETRIES = 10
const WS_BASE_DELAY_MS = 1000
const WS_MAX_DELAY_MS = 5000

async function connectWsWithRetry(port: number): Promise<void> {
  for (let attempt = 1; attempt <= WS_MAX_RETRIES; attempt++) {
    if (state.snapshot.status !== 'STARTING') return // process died or was stopped

    // Read token (may not exist yet during bootstrap)
    const token = await readGatewayToken()
    if (!token && attempt < WS_MAX_RETRIES) {
      mainLogger.info(`[Main] Gateway token not ready (attempt ${attempt}/${WS_MAX_RETRIES}), retrying...`)
      await sleep(WS_BASE_DELAY_MS)
      continue
    }

    const client = new WsGatewayClient(port)
    try {
      await client.connect()
      wsClient = client
      mainLogger.info('[Main] WsGatewayClient connected')

      // Transition to RUNNING — this is the single source of truth
      state.transition('RUNNING', {
        pid: processManager.pid,
        startedAt: Date.now(),
        port,
      })
      state.setWsConnected(true)
      state.setHealth('ok', Date.now())

      // Post-connection setup
      registerChatEventForwarding(client, () => mainWindow)
      processManager.startHealthMonitor()

      syncUsageFromGateway(client, () => mainWindow).catch((err) => {
        mainLogger.warn('[Main] Initial usage sync failed:', String(err))
      })

      let sessionsChangedTimer: ReturnType<typeof setTimeout> | null = null
      client.on('sessions.changed', () => {
        if (sessionsChangedTimer) clearTimeout(sessionsChangedTimer)
        sessionsChangedTimer = setTimeout(() => {
          sessionsChangedTimer = null
          syncUsageFromGateway(client!, () => mainWindow).catch((err) => {
            mainLogger.warn('[Main] sessions.changed usage sync failed:', String(err))
          })
        }, 500)
      })

      return // success
    } catch (err) {
      client.disconnect()
      const delay = Math.min(WS_BASE_DELAY_MS * Math.pow(1.5, attempt - 1), WS_MAX_DELAY_MS)
      mainLogger.warn(`[Main] WS connect failed (attempt ${attempt}/${WS_MAX_RETRIES}): ${String(err)}, retrying in ${Math.round(delay)}ms`)
      await sleep(delay)
    }
  }

  // All retries exhausted
  mainLogger.error('[Main] WS connection failed after all retries')
  state.transition('ERROR', { error: 'WebSocket connection failed after all retries' })
  state.setFailure('ws_connect_failed', 'WebSocket connection failed after all retries')
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
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

  // Background sync — don't block startup
  void (async () => {
    try {
      await syncAllProvidersToRuntime()
      await syncRoutingProfilesAfterProviderChange()
      await ensureAllChannelPlugins()
      mainLogger.info('Provider, routing, and channel plugins synced')
    } catch (err) {
      mainLogger.warn('Background sync failed:', err)
    }
  })()

  // WS connection when process is spawned, cleanup on stop/error
  let lastStatus = state.snapshot.status
  state.onChange(async (snap) => {
    const statusChanged = snap.status !== lastStatus
    lastStatus = snap.status

    if (snap.status === 'STARTING' && statusChanged) {
      if (wsClient?.isConnected || wsConnectInFlight) return
      wsConnectInFlight = true
      try {
        await connectWsWithRetry(processManager.port)
      } finally {
        wsConnectInFlight = false
      }
    } else if ((snap.status === 'STOPPED' || snap.status === 'ERROR') && statusChanged) {
      if (wsClient?.isConnected) {
        wsClient.disconnect()
      }
      wsClient = null
      wsConnectInFlight = false
      state.setWsConnected(false)
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
