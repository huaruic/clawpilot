import { describe, it, expect, vi } from 'vitest'
import { RuntimeState } from '../state/RuntimeState'
import type { OpenClawSetup } from '../services/OpenClawConfigWriter'

function createSetup(overrides: Partial<OpenClawSetup> = {}): OpenClawSetup {
  return {
    hasConfig: false,
    hasProvider: false,
    hasDefaultModel: false,
    bootstrapPending: false,
    workspaceRoot: '',
    configPath: '',
    phase: 'gateway_setup',
    blockingReason: 'missing_gateway_config',
    ...overrides,
  }
}

describe('RuntimeState', () => {
  it('initial snapshot is STOPPED with degraded health', () => {
    const state = new RuntimeState()
    const snap = state.snapshot
    expect(snap.status).toBe('STOPPED')
    expect(snap.healthStatus).toBe('degraded')
    expect(snap.port).toBe(18790)
    expect(snap.error).toBeUndefined()
  })

  it('snapshot returns a copy (not a reference)', () => {
    const state = new RuntimeState()
    const a = state.snapshot
    const b = state.snapshot
    expect(a).not.toBe(b)
    expect(a).toEqual(b)
  })

  it('transition to RUNNING clears error', () => {
    const state = new RuntimeState()
    state.transition('ERROR', { error: 'boom' })
    expect(state.snapshot.error).toBe('boom')

    state.transition('RUNNING')
    expect(state.snapshot.status).toBe('RUNNING')
    expect(state.snapshot.error).toBeUndefined()
  })

  it('transition to STOPPED clears error', () => {
    const state = new RuntimeState()
    state.transition('ERROR', { error: 'crash' })
    state.transition('STOPPED')
    expect(state.snapshot.status).toBe('STOPPED')
    expect(state.snapshot.error).toBeUndefined()
  })

  it('transition to ERROR preserves error from meta', () => {
    const state = new RuntimeState()
    state.transition('ERROR', { error: 'something broke' })
    expect(state.snapshot.status).toBe('ERROR')
    expect(state.snapshot.error).toBe('something broke')
  })

  it('transition preserves meta fields (pid, startedAt)', () => {
    const state = new RuntimeState()
    const startedAt = Date.now()
    state.transition('RUNNING', { pid: 1234, startedAt })
    expect(state.snapshot.pid).toBe(1234)
    expect(state.snapshot.startedAt).toBe(startedAt)
  })

  it('setSetup updates setup block', () => {
    const state = new RuntimeState()
    const setup = createSetup({ hasConfig: true, phase: 'ready' })
    state.setSetup(setup)
    expect(state.snapshot.setup).toEqual(setup)
  })

  it('setHealth updates healthStatus and lastHealthAt', () => {
    const state = new RuntimeState()
    const ts = Date.now()
    state.setHealth('ok', ts)
    expect(state.snapshot.healthStatus).toBe('ok')
    expect(state.snapshot.lastHealthAt).toBe(ts)
  })

  it('setWsConnected updates wsConnected flag', () => {
    const state = new RuntimeState()
    expect(state.snapshot.wsConnected).toBeUndefined()
    state.setWsConnected(true)
    expect(state.snapshot.wsConnected).toBe(true)
    state.setWsConnected(false)
    expect(state.snapshot.wsConnected).toBe(false)
  })

  it('setFailure sets error, lastFailureReason and lastFailureAt', () => {
    const state = new RuntimeState()
    state.setFailure('process_crash', 'exit code 1')
    const snap = state.snapshot
    expect(snap.error).toBe('exit code 1')
    expect(snap.lastFailureReason).toBe('process_crash')
    expect(snap.lastFailureAt).toBeTypeOf('number')
  })

  it('onChange fires on every state change', () => {
    const state = new RuntimeState()
    const handler = vi.fn()
    state.onChange(handler)

    state.transition('STARTING')
    state.transition('RUNNING')
    state.setHealth('ok', Date.now())

    expect(handler).toHaveBeenCalledTimes(3)
    expect(handler.mock.calls[0][0].status).toBe('STARTING')
    expect(handler.mock.calls[1][0].status).toBe('RUNNING')
  })

  it('onChange returns unsubscribe function', () => {
    const state = new RuntimeState()
    const handler = vi.fn()
    const unsub = state.onChange(handler)

    state.transition('STARTING')
    expect(handler).toHaveBeenCalledTimes(1)

    unsub()
    state.transition('RUNNING')
    expect(handler).toHaveBeenCalledTimes(1) // no more calls
  })

  it('handler errors do not crash emit', () => {
    const state = new RuntimeState()
    const bad = vi.fn(() => { throw new Error('oops') })
    const good = vi.fn()
    state.onChange(bad)
    state.onChange(good)

    state.transition('RUNNING')
    expect(bad).toHaveBeenCalledTimes(1)
    expect(good).toHaveBeenCalledTimes(1) // still called despite bad throwing
  })
})
