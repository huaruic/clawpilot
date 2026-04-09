import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Electron mock (vi.hoisted to avoid TDZ issues) ──────────────
const { mockQuit, appHandlers, MockBrowserWindow } = vi.hoisted(() => {
  class _MockBrowserWindow {
    on = vi.fn()
    loadURL = vi.fn()
    loadFile = vi.fn()
    isDestroyed = vi.fn(() => false)
    isMinimized = vi.fn(() => false)
    restore = vi.fn()
    focus = vi.fn()
    webContents = { setWindowOpenHandler: vi.fn() }
  }
  return {
    mockQuit: vi.fn(),
    appHandlers: new Map<string, (...args: unknown[]) => void>(),
    MockBrowserWindow: _MockBrowserWindow,
  }
})

vi.mock('electron', () => ({
  app: {
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      appHandlers.set(event, handler)
    }),
    quit: mockQuit,
    dock: { setIcon: vi.fn() },
  },
  BrowserWindow: MockBrowserWindow,
  shell: { openExternal: vi.fn() },
  nativeImage: {
    createFromPath: vi.fn(() => ({ isEmpty: () => true })),
  },
}))

vi.mock('../utils/logger', () => ({
  mainLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

// ── Import after mock ────────────────────────────────────────────
import { AppLifecycle, type AppLifecycleDeps } from '../AppLifecycle'

function createMockDeps(): AppLifecycleDeps {
  return {
    processManager: {
      dispose: vi.fn(),
      stop: vi.fn().mockResolvedValue(undefined),
    },
    disconnectWs: vi.fn(),
    trayManager: {
      destroy: vi.fn(),
    },
    createWindowOptions: {
      preloadPath: '/fake/preload.js',
      rendererUrl: undefined,
      rendererHtmlPath: '/fake/index.html',
    },
  }
}

describe('AppLifecycle', () => {
  let deps: AppLifecycleDeps
  let lifecycle: AppLifecycle

  beforeEach(() => {
    vi.clearAllMocks()
    appHandlers.clear()
    deps = createMockDeps()
    lifecycle = new AppLifecycle(deps)
  })

  // ── handleQuit ──────────────────────────────────────────────────

  describe('handleQuit', () => {
    it('calls trayDestroy → dispose → disconnectWs → stop → app.quit in order', async () => {
      const callOrder: string[] = []
      vi.mocked(deps.trayManager!.destroy).mockImplementation(() => { callOrder.push('trayDestroy') })
      vi.mocked(deps.processManager.dispose).mockImplementation(() => { callOrder.push('dispose') })
      vi.mocked(deps.disconnectWs).mockImplementation(() => { callOrder.push('disconnectWs') })
      vi.mocked(deps.processManager.stop).mockImplementation(async () => { callOrder.push('stop') })
      mockQuit.mockImplementation(() => { callOrder.push('quit') })

      await lifecycle.handleQuit()

      expect(callOrder).toEqual(['trayDestroy', 'dispose', 'disconnectWs', 'stop', 'quit'])
    })

    it('sets isQuitting to true', async () => {
      expect(lifecycle.quitting).toBe(false)
      await lifecycle.handleQuit()
      expect(lifecycle.quitting).toBe(true)
    })

    it('is reentrant-safe: second call is a no-op', async () => {
      await lifecycle.handleQuit()
      mockQuit.mockClear()
      vi.mocked(deps.processManager.stop).mockClear()

      await lifecycle.handleQuit()

      expect(deps.processManager.stop).not.toHaveBeenCalled()
      expect(mockQuit).not.toHaveBeenCalled()
    })

    it('destroys tray during quit', async () => {
      await lifecycle.handleQuit()
      expect(deps.trayManager!.destroy).toHaveBeenCalled()
    })

    it('calls event.preventDefault when event is provided', async () => {
      const event = { preventDefault: vi.fn() }
      await lifecycle.handleQuit(event as unknown as Electron.Event)
      expect(event.preventDefault).toHaveBeenCalled()
    })
  })

  // ── registerAppEvents ───────────────────────────────────────────

  describe('registerAppEvents', () => {
    beforeEach(() => {
      lifecycle.registerAppEvents()
    })

    it('registers window-all-closed handler', () => {
      expect(appHandlers.has('window-all-closed')).toBe(true)
    })

    it('registers before-quit handler', () => {
      expect(appHandlers.has('before-quit')).toBe(true)
    })

    it('registers activate handler', () => {
      expect(appHandlers.has('activate')).toBe(true)
    })

    it('window-all-closed behavior depends on platform', async () => {
      const handler = appHandlers.get('window-all-closed')!
      await handler()

      if (process.platform === 'darwin') {
        // macOS: tray mode — no quit
        expect(deps.processManager.dispose).not.toHaveBeenCalled()
        expect(deps.processManager.stop).not.toHaveBeenCalled()
        expect(mockQuit).not.toHaveBeenCalled()
      } else {
        // Windows/Linux: quit app
        expect(mockQuit).toHaveBeenCalled()
      }
    })

    it('before-quit triggers handleQuit with event.preventDefault', async () => {
      const handler = appHandlers.get('before-quit')!
      const event = { preventDefault: vi.fn() }
      await handler(event)

      expect(event.preventDefault).toHaveBeenCalled()
      expect(deps.processManager.dispose).toHaveBeenCalled()
      expect(deps.processManager.stop).toHaveBeenCalled()
      expect(mockQuit).toHaveBeenCalled()
    })
  })

  // ── ensureWindow ────────────────────────────────────────────────

  describe('ensureWindow / activate / second-instance', () => {
    it('createWindow creates a window and stores reference', () => {
      expect(lifecycle.window).toBeNull()
      lifecycle.createWindow()
      expect(lifecycle.window).not.toBeNull()
    })

    it('activate creates window when none exists', () => {
      lifecycle.registerAppEvents()
      expect(lifecycle.window).toBeNull()

      const handler = appHandlers.get('activate')!
      handler()

      expect(lifecycle.window).not.toBeNull()
    })

    it('activate focuses existing window instead of creating new one', () => {
      lifecycle.createWindow()
      const existingWindow = lifecycle.window!
      lifecycle.registerAppEvents()

      const handler = appHandlers.get('activate')!
      handler()

      expect(lifecycle.window).toBe(existingWindow)
      expect(existingWindow.focus).toHaveBeenCalled()
    })

    it('activate restores minimized window', () => {
      lifecycle.createWindow()
      const win = lifecycle.window!
      vi.mocked(win.isMinimized).mockReturnValue(true)
      lifecycle.registerAppEvents()

      const handler = appHandlers.get('activate')!
      handler()

      expect(win.restore).toHaveBeenCalled()
      expect(win.focus).toHaveBeenCalled()
    })

    it('ensureWindow after closed event creates new window', () => {
      lifecycle.createWindow()
      // Simulate window 'closed' event — sets mainWindow to null
      lifecycle.handleWindowClosed()
      expect(lifecycle.window).toBeNull()

      lifecycle.registerAppEvents()
      const handler = appHandlers.get('activate')!
      handler()

      expect(lifecycle.window).not.toBeNull()
    })
  })

  // ── quitting getter ─────────────────────────────────────────────

  describe('quitting getter', () => {
    it('is false initially', () => {
      expect(lifecycle.quitting).toBe(false)
    })

    it('is true after handleQuit', async () => {
      await lifecycle.handleQuit()
      expect(lifecycle.quitting).toBe(true)
    })
  })
})
