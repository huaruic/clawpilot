import { describe, it, expect, vi } from 'vitest'

// ── Mock window.catclaw before importing store ───────────────────

vi.stubGlobal('window', {
  catclaw: {
    app: {
      onStatusChange: vi.fn(),
      status: vi.fn().mockResolvedValue({
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
      }),
    },
  },
})

import { useRuntimeStore } from '../../renderer/src/stores/runtimeStore'

describe('runtimeStore', () => {
  it('initial snapshot is STOPPED', () => {
    const { snapshot } = useRuntimeStore.getState()
    expect(snapshot.status).toBe('STOPPED')
    expect(snapshot.port).toBe(18790)
    expect(snapshot.healthStatus).toBe('degraded')
  })

  it('initial setup phase is gateway_setup', () => {
    const { snapshot } = useRuntimeStore.getState()
    expect(snapshot.setup.phase).toBe('gateway_setup')
    expect(snapshot.setup.hasConfig).toBe(false)
  })

  it('setSnapshot updates the snapshot', () => {
    useRuntimeStore.getState().setSnapshot({
      status: 'RUNNING',
      port: 18790,
      pid: 1234,
      setup: {
        hasConfig: true,
        hasProvider: true,
        hasDefaultModel: true,
        bootstrapPending: false,
        workspaceRoot: '/ws',
        configPath: '/cfg',
        phase: 'ready',
      },
      healthStatus: 'ok',
    })

    const { snapshot } = useRuntimeStore.getState()
    expect(snapshot.status).toBe('RUNNING')
    expect(snapshot.pid).toBe(1234)
    expect(snapshot.setup.phase).toBe('ready')
  })

  it('setSnapshot replaces the entire snapshot', () => {
    useRuntimeStore.getState().setSnapshot({
      status: 'ERROR',
      port: 18790,
      error: 'crashed',
      setup: {
        hasConfig: true,
        hasProvider: true,
        hasDefaultModel: true,
        bootstrapPending: false,
        workspaceRoot: '',
        configPath: '',
        phase: 'ready',
      },
      healthStatus: 'error',
    })

    const { snapshot } = useRuntimeStore.getState()
    expect(snapshot.status).toBe('ERROR')
    expect(snapshot.error).toBe('crashed')
    expect(snapshot.healthStatus).toBe('error')
  })
})
