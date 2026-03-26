import type { OpenClawSetup } from '../services/OpenClawConfigWriter'

export type RuntimeStatus = 'STOPPED' | 'STARTING' | 'RUNNING' | 'ERROR' | 'UPDATING'

export interface RuntimeSnapshot {
  status: RuntimeStatus
  pid?: number
  error?: string
  port: number
  startedAt?: number
  setup: OpenClawSetup
}

type ChangeHandler = (snap: RuntimeSnapshot) => void

export class RuntimeState {
  private _snapshot: RuntimeSnapshot = {
    status: 'STOPPED',
    port: 18790,
    setup: {
      hasConfig: false,
      hasProvider: false,
      hasDefaultModel: false,
      bootstrapPending: false,
      workspaceRoot: '',
      configPath: '',
      phase: 'gateway_setup',
      blockingReason: 'missing_gateway_config',
    },
  }

  private handlers = new Set<ChangeHandler>()

  get snapshot(): RuntimeSnapshot {
    return { ...this._snapshot }
  }

  transition(to: RuntimeStatus, meta: Partial<Omit<RuntimeSnapshot, 'status'>> = {}): void {
    this._snapshot = {
      ...this._snapshot,
      status: to,
      // Clear error on successful transitions
      error: to === 'RUNNING' || to === 'STOPPED' ? undefined : this._snapshot.error,
      ...meta,
    }
    this.emit()
  }

  setSetup(setup: OpenClawSetup): void {
    this._snapshot = {
      ...this._snapshot,
      setup,
    }
    this.emit()
  }

  onChange(cb: ChangeHandler): () => void {
    this.handlers.add(cb)
    return () => this.handlers.delete(cb)
  }

  private emit(): void {
    const snap = this.snapshot
    for (const h of this.handlers) {
      try {
        h(snap)
      } catch {
        // ignore handler errors
      }
    }
  }
}
