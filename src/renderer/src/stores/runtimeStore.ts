import { create } from 'zustand'
import type { RuntimeSnapshot } from '../api/ipc'

interface RuntimeStore {
  snapshot: RuntimeSnapshot
  setSnapshot: (snap: RuntimeSnapshot) => void
}

export const useRuntimeStore = create<RuntimeStore>((set) => {
  // Subscribe to IPC status changes from main process
  if (typeof window !== 'undefined' && window.clawpilot) {
    window.clawpilot.app.onStatusChange((snap) => {
      set({ snapshot: snap })
    })

    // Load initial status
    window.clawpilot.app.status().then((snap) => {
      set({ snapshot: snap })
    })
  }

  return {
    snapshot: {
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
      healthStatus: 'degraded',
    },
    setSnapshot: (snapshot) => set({ snapshot }),
  }
})
