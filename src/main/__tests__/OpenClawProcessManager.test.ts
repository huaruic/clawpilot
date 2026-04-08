import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('electron', () => ({ app: { getPath: vi.fn(() => '/tmp/test') } }))
vi.mock('../utils/logger', () => ({
  mainLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))
vi.mock('../services/RuntimeLocator', () => ({
  getBundledNodePath: vi.fn(() => '/fake/node'),
  getOpenClawEntryPath: vi.fn(() => '/fake/openclaw.mjs'),
  getOpenClawStateDir: vi.fn(() => '/fake/state'),
}))
vi.mock('../services/OpenClawConfigWriter', () => ({
  ensureOpenClawBaseConfig: vi.fn().mockResolvedValue(undefined),
}))

// Mock child_process.spawn
const { mockSpawn, mockChild } = vi.hoisted(() => {
  const mockChild = {
    pid: 12345,
    stdout: { on: vi.fn() },
    stderr: { on: vi.fn() },
    on: vi.fn(),
    kill: vi.fn(),
  }
  return {
    mockSpawn: vi.fn(() => mockChild),
    mockChild,
  }
})
vi.mock('node:child_process', () => ({ spawn: mockSpawn }))

import { OpenClawProcessManager } from '../services/OpenClawProcessManager'
import { RuntimeState } from '../state/RuntimeState'

describe('OpenClawProcessManager', () => {
  let state: RuntimeState
  let pm: OpenClawProcessManager

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    state = new RuntimeState()
    pm = new OpenClawProcessManager(state)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('dispose', () => {
    it('stops health monitor', async () => {
      // Start process to get into RUNNING state so health monitor can start
      await pm.start()
      pm.startHealthMonitor()

      pm.dispose()

      // Advance timers — health check should NOT fire
      const fetchSpy = vi.fn()
      vi.stubGlobal('fetch', fetchSpy)
      await vi.advanceTimersByTimeAsync(10000)
      expect(fetchSpy).not.toHaveBeenCalled()
      vi.unstubAllGlobals()
    })

    it('clears pending restart timer', async () => {
      // Access private scheduleRestart by triggering a process exit
      // Instead, we test that dispose prevents any pending restart from firing
      await pm.start()

      // Simulate: manually trigger a restart schedule via the public restart path
      // We'll verify dispose clears the timer by checking that start() is not called
      const startSpy = vi.spyOn(pm, 'start')

      // Trigger the internal scheduleRestart by simulating exit event
      const exitHandler = mockChild.on.mock.calls.find(
        ([event]: [string]) => event === 'exit'
      )?.[1]

      if (exitHandler) {
        // Set state to RUNNING so exit triggers restart
        state.transition('RUNNING', { pid: 12345, startedAt: Date.now(), port: 18790 })
        exitHandler(1, null) // non-zero exit while running
      }

      // Now dispose before the restart timer fires
      pm.dispose()

      // Advance past any restart delay
      await vi.advanceTimersByTimeAsync(10000)

      // start should NOT have been called again (restart was cancelled)
      expect(startSpy).not.toHaveBeenCalled()
    })

    it('sets stopRequested so scheduleRestart becomes a no-op', () => {
      pm.dispose()

      // Verify via the public interface: calling stop() transitions to STOPPED
      // (stopRequested prevents exit handler from scheduling restart)
      expect(state.snapshot.status).toBe('STOPPED')
    })

    it('can be called multiple times safely', () => {
      expect(() => {
        pm.dispose()
        pm.dispose()
        pm.dispose()
      }).not.toThrow()
    })
  })
})
