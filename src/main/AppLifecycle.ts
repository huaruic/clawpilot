import { app, BrowserWindow, shell } from 'electron'
import { join } from 'node:path'
import { mainLogger } from './utils/logger'

export interface AppLifecycleDeps {
  processManager: {
    dispose(): void
    stop(): Promise<void>
  }
  disconnectWs: () => void
  trayManager?: {
    destroy(): void
  }
  createWindowOptions: {
    preloadPath: string
    rendererUrl: string | undefined
    rendererHtmlPath: string
  }
}

export class AppLifecycle {
  private _quitting = false
  private mainWindow: BrowserWindow | null = null
  private readonly deps: AppLifecycleDeps

  constructor(deps: AppLifecycleDeps) {
    this.deps = deps
  }

  get quitting(): boolean {
    return this._quitting
  }

  get window(): BrowserWindow | null {
    return this.mainWindow
  }

  /** Register all app lifecycle event handlers in one place. */
  registerAppEvents(): void {
    app.on('window-all-closed', () => {
      // Tray mode: keep app alive in background.
      // User quits via Cmd+Q, Dock Quit, or tray menu.
    })

    app.on('before-quit', (event) => {
      void this.handleQuit(event)
    })

    app.on('activate', () => {
      this.ensureWindow()
    })
  }

  /**
   * Unified quit entry — all quit paths converge here.
   * Reentrant-safe: second call is a no-op.
   */
  async handleQuit(event?: Electron.Event): Promise<void> {
    if (this._quitting) return
    this._quitting = true
    event?.preventDefault()

    mainLogger.info('[Lifecycle] Shutting down...')

    // 1. Destroy tray
    this.deps.trayManager?.destroy()

    // 2. Cancel all pending timers (restart, health check)
    this.deps.processManager.dispose()

    // 3. Disconnect WebSocket
    this.deps.disconnectWs()

    // 4. Stop child process (SIGTERM → 3s → SIGKILL)
    await this.deps.processManager.stop()

    // 5. Actually quit
    app.quit()
  }

  /** Ensure a window exists — used by activate and second-instance. */
  ensureWindow(): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      if (this.mainWindow.isMinimized()) this.mainWindow.restore()
      this.mainWindow.focus()
    } else {
      this.createWindow()
    }
  }

  /** Create the main BrowserWindow. */
  createWindow(): BrowserWindow {
    const { preloadPath, rendererUrl, rendererHtmlPath } = this.deps.createWindowOptions

    this.mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 900,
      minHeight: 600,
      titleBarStyle: 'hiddenInset',
      backgroundColor: '#0a0a0a',
      webPreferences: {
        preload: preloadPath,
        sandbox: false,
        contextIsolation: true,
        nodeIntegration: false,
      },
    })

    this.mainWindow.on('closed', () => {
      this.handleWindowClosed()
    })

    this.mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url)
      return { action: 'deny' }
    })

    if (rendererUrl) {
      this.mainWindow.loadURL(rendererUrl)
    } else {
      this.mainWindow.loadFile(rendererHtmlPath)
    }

    return this.mainWindow
  }

  /** Called when the window emits 'closed'. Clears the reference. */
  handleWindowClosed(): void {
    this.mainWindow = null
  }
}
