import { Tray, Menu, nativeImage } from 'electron'
import type { RuntimeStatus } from './state/RuntimeState'
import { mainLogger } from './utils/logger'

export interface TrayManagerDeps {
  onShowWindow: () => void
  onQuit: () => void
  iconPath: string
}

const STATUS_LABELS: Record<RuntimeStatus, string> = {
  RUNNING: '● Running',
  STARTING: '◐ Starting',
  STOPPED: '○ Stopped',
  ERROR: '✕ Error',
  UPDATING: '◐ Updating',
}

export class TrayManager {
  private tray: Tray | null = null
  private readonly deps: TrayManagerDeps

  constructor(deps: TrayManagerDeps) {
    this.deps = deps
  }

  create(): void {
    const icon = nativeImage.createFromPath(this.deps.iconPath)
    this.tray = new Tray(icon)
    this.tray.setToolTip('ClawPilot')
    this.tray.on('click', () => this.deps.onShowWindow())
    this.rebuildMenu('STOPPED')
    mainLogger.info('[TrayManager] Tray created')
  }

  updateStatus(status: RuntimeStatus): void {
    if (!this.tray) return
    const label = STATUS_LABELS[status] ?? status
    this.tray.setToolTip(`ClawPilot — ${label}`)
    this.rebuildMenu(status)
  }

  destroy(): void {
    if (!this.tray) return
    this.tray.destroy()
    this.tray = null
    mainLogger.info('[TrayManager] Tray destroyed')
  }

  private rebuildMenu(status: RuntimeStatus): void {
    if (!this.tray) return
    const statusLabel = STATUS_LABELS[status] ?? status

    const menu = Menu.buildFromTemplate([
      { label: '打开 ClawPilot', click: () => this.deps.onShowWindow() },
      { type: 'separator' },
      { label: statusLabel, enabled: false },
      { type: 'separator' },
      { label: '退出', click: () => this.deps.onQuit() },
    ])

    this.tray.setContextMenu(menu)
  }
}
