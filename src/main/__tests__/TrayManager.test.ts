import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Electron mock ────────────────────────────────────────────────
const { MockTray, mockMenuBuildFromTemplate } = vi.hoisted(() => {
  class _MockTray {
    setToolTip = vi.fn()
    setContextMenu = vi.fn()
    on = vi.fn()
    destroy = vi.fn()
  }
  return {
    MockTray: _MockTray,
    mockMenuBuildFromTemplate: vi.fn((template: unknown[]) => template),
  }
})

// Helper to get the current tray instance created during a test
let lastTrayInstance: InstanceType<typeof MockTray>

vi.mock('electron', () => ({
  Tray: class extends MockTray {
    constructor(...args: unknown[]) {
      super(...args)
      lastTrayInstance = this
    }
  },
  Menu: { buildFromTemplate: mockMenuBuildFromTemplate },
  nativeImage: {
    createFromPath: vi.fn((p: string) => ({ path: p })),
  },
}))

vi.mock('../utils/logger', () => ({
  mainLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { TrayManager, type TrayManagerDeps } from '../TrayManager'

function createMockDeps(): TrayManagerDeps {
  return {
    onShowWindow: vi.fn(),
    onQuit: vi.fn(),
    iconPath: '/fake/trayTemplate.png',
  }
}

describe('TrayManager', () => {
  let deps: TrayManagerDeps
  let tray: TrayManager

  beforeEach(() => {
    vi.clearAllMocks()
    deps = createMockDeps()
    tray = new TrayManager(deps)
  })

  describe('create', () => {
    it('creates a Tray instance and sets tooltip', () => {
      tray.create()
      expect(lastTrayInstance.setToolTip).toHaveBeenCalledWith('ClawPilot')
    })

    it('sets a context menu', () => {
      tray.create()
      expect(lastTrayInstance.setContextMenu).toHaveBeenCalled()
    })

    it('registers click handler', () => {
      tray.create()
      expect(lastTrayInstance.on).toHaveBeenCalledWith('click', expect.any(Function))
    })

    it('click handler calls onShowWindow', () => {
      tray.create()
      const clickHandler = lastTrayInstance.on.mock.calls.find(
        ([event]: [string]) => event === 'click'
      )?.[1]
      clickHandler()
      expect(deps.onShowWindow).toHaveBeenCalled()
    })
  })

  describe('context menu', () => {
    it('contains "打开 ClawPilot" item', () => {
      tray.create()
      const template = mockMenuBuildFromTemplate.mock.calls[0][0] as Array<{ label?: string }>
      const showItem = template.find((item) => item.label === '打开 ClawPilot')
      expect(showItem).toBeDefined()
    })

    it('"打开 ClawPilot" item calls onShowWindow', () => {
      tray.create()
      const template = mockMenuBuildFromTemplate.mock.calls[0][0] as Array<{ label?: string; click?: () => void }>
      const showItem = template.find((item) => item.label === '打开 ClawPilot')
      showItem!.click!()
      expect(deps.onShowWindow).toHaveBeenCalled()
    })

    it('contains "退出" item', () => {
      tray.create()
      const template = mockMenuBuildFromTemplate.mock.calls[0][0] as Array<{ label?: string }>
      const quitItem = template.find((item) => item.label === '退出')
      expect(quitItem).toBeDefined()
    })

    it('"退出" item calls onQuit', () => {
      tray.create()
      const template = mockMenuBuildFromTemplate.mock.calls[0][0] as Array<{ label?: string; click?: () => void }>
      const quitItem = template.find((item) => item.label === '退出')
      quitItem!.click!()
      expect(deps.onQuit).toHaveBeenCalled()
    })

    it('contains a disabled status label', () => {
      tray.create()
      const template = mockMenuBuildFromTemplate.mock.calls[0][0] as Array<{ label?: string; enabled?: boolean }>
      const statusItem = template.find((item) => item.enabled === false && item.label)
      expect(statusItem).toBeDefined()
    })
  })

  describe('updateStatus', () => {
    it('updates tooltip with status', () => {
      tray.create()
      lastTrayInstance.setToolTip.mockClear()

      tray.updateStatus('RUNNING')
      expect(lastTrayInstance.setToolTip).toHaveBeenCalledWith(expect.stringContaining('Running'))
    })

    it('rebuilds context menu with new status', () => {
      tray.create()
      mockMenuBuildFromTemplate.mockClear()

      tray.updateStatus('ERROR')
      expect(mockMenuBuildFromTemplate).toHaveBeenCalled()
      const template = mockMenuBuildFromTemplate.mock.calls[0][0] as Array<{ label?: string; enabled?: boolean }>
      const statusItem = template.find((item) => item.enabled === false && item.label)
      expect(statusItem!.label).toContain('Error')
    })
  })

  describe('destroy', () => {
    it('destroys the tray instance', () => {
      tray.create()
      tray.destroy()
      expect(lastTrayInstance.destroy).toHaveBeenCalled()
    })

    it('can be called multiple times safely', () => {
      tray.create()
      expect(() => {
        tray.destroy()
        tray.destroy()
      }).not.toThrow()
    })

    it('is safe to call without create', () => {
      expect(() => tray.destroy()).not.toThrow()
    })
  })
})
