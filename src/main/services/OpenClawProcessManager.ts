import { spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import { RuntimeState } from '../state/RuntimeState'
import {
  getBundledNodePath,
  getOpenClawEntryPath,
  getOpenClawStateDir,
} from './RuntimeLocator'
import { ensureOpenClawBaseConfig } from './OpenClawConfigWriter'
import { mainLogger } from '../utils/logger'

const GATEWAY_PORT = 18790
const HEALTH_POLL_INTERVAL_MS = 500
const HEALTH_POLL_MAX_ATTEMPTS = 40 // 20 seconds total
const STDERR_BUFFER_LINES = 20

export class OpenClawProcessManager {
  private child: ChildProcess | null = null
  private readonly state: RuntimeState
  private stderrBuffer: string[] = []
  private exitInfo: { code: number | null; signal: string | null } | null = null

  constructor(state: RuntimeState) {
    this.state = state
  }

  get isRunning(): boolean {
    return this.state.snapshot.status === 'RUNNING' && this.child !== null
  }

  async start(): Promise<void> {
    if (this.child) {
      mainLogger.info('[ProcessManager] Already running, skipping start')
      return
    }

    this.state.transition('STARTING')

    try {
      await ensureOpenClawBaseConfig()

      const nodePath = getBundledNodePath()
      const entryPath = getOpenClawEntryPath()

      mainLogger.info(`[ProcessManager] node: ${nodePath}`)
      mainLogger.info(`[ProcessManager] entry: ${entryPath}`)

      const spawnArgs = this.buildSpawnArgs(nodePath, entryPath)

      this.child = spawn(spawnArgs[0], spawnArgs.slice(1), {
        env: this.buildEnv(),
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false,
      })

      this.child.stdout?.on('data', (chunk: Buffer) => {
        mainLogger.info('[openclaw]', chunk.toString().trim())
      })
      this.child.stderr?.on('data', (chunk: Buffer) => {
        mainLogger.warn('[openclaw]', chunk.toString().trim())
      })

      this.child.on('error', (err) => {
        mainLogger.error('[ProcessManager] spawn error:', err.message)
        this.state.transition('ERROR', { error: err.message })
        this.child = null
      })

      this.child.on('exit', (code, signal) => {
        mainLogger.info(`[ProcessManager] exited code=${code} signal=${signal}`)
        const wasRunning = this.state.snapshot.status === 'RUNNING'
        this.state.transition(
          wasRunning && code !== 0 ? 'ERROR' : 'STOPPED',
          code !== 0 ? { error: `Exit code ${code}` } : {}
        )
        this.child = null
      })

      await this.waitUntilReady()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      mainLogger.error('[ProcessManager] Failed to start:', message)
      this.state.transition('ERROR', { error: message })
      this.child = null
    }
  }

  async stop(): Promise<void> {
    if (!this.child) {
      this.state.transition('STOPPED')
      return
    }

    mainLogger.info('[ProcessManager] Stopping...')
    this.child.kill('SIGTERM')

    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        if (this.child) {
          mainLogger.warn('[ProcessManager] Force killing after timeout')
          this.child.kill('SIGKILL')
        }
        resolve()
      }, 3000)

      const checkExit = setInterval(() => {
        if (!this.child) {
          clearTimeout(timeout)
          clearInterval(checkExit)
          resolve()
        }
      }, 100)
    })
  }

  async restart(): Promise<void> {
    mainLogger.info('[ProcessManager] Restarting...')
    await this.stop()
    await this.start()
  }

  private buildSpawnArgs(nodePath: string, entryPath: string): string[] {
    return [nodePath, entryPath, 'gateway', '--port', String(GATEWAY_PORT)]
  }

  private buildEnv(): NodeJS.ProcessEnv {
    return {
      ...process.env,
      OPENCLAW_STATE_DIR: getOpenClawStateDir(),
      OPENCLAW_NO_RESPAWN: '1',
      OPENCLAW_NODE_OPTIONS_READY: '1',
      NO_COLOR: '1',
      FORCE_COLOR: undefined,
    }
  }

  private async waitUntilReady(): Promise<void> {
    const url = `http://127.0.0.1:${GATEWAY_PORT}/health`

    for (let i = 0; i < HEALTH_POLL_MAX_ATTEMPTS; i++) {
      if (!this.child) {
        throw new Error('OpenClaw process exited before becoming ready')
      }

      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(500) })
        if (res.ok) {
          mainLogger.info(`[ProcessManager] Gateway ready (attempt ${i + 1})`)
          this.state.transition('RUNNING', {
            pid: this.child?.pid,
            startedAt: Date.now(),
            port: GATEWAY_PORT,
          })
          return
        }
      } catch {
        // Not ready yet
      }

      await sleep(HEALTH_POLL_INTERVAL_MS)
    }

    throw new Error(`Gateway did not start within ${(HEALTH_POLL_INTERVAL_MS * HEALTH_POLL_MAX_ATTEMPTS) / 1000}s`)
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
