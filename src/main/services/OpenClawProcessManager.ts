import { spawn, execSync, type ChildProcess } from 'node:child_process'
import { RuntimeState } from '../state/RuntimeState'
import {
  getBundledNodePath,
  getOpenClawEntryPath,
  getOpenClawStateDir,
} from './RuntimeLocator'
import { ensureOpenClawBaseConfig } from './OpenClawConfigWriter'
import { mainLogger } from '../utils/logger'

const GATEWAY_PORT = 18790
const HEALTH_MONITOR_INTERVAL_MS = 5000
const HEALTH_FAILURE_THRESHOLD = 3
const STDERR_BUFFER_LINES = 30

const RESTART_WINDOW_MS = 2 * 60 * 1000
const RESTART_MAX_ATTEMPTS = 3
const RESTART_DEBOUNCE_MS = 3000
const RESTART_BACKOFF_BASE_MS = 1500

export class OpenClawProcessManager {
  private child: ChildProcess | null = null
  private readonly state: RuntimeState
  private stderrBuffer: string[] = []
  private healthTimer: NodeJS.Timeout | null = null
  private healthFailures = 0
  private restartAttempts = 0
  private restartWindowStart = 0
  private restartInFlight = false
  private restartTimer: ReturnType<typeof setTimeout> | null = null
  private stopRequested = false
  private lastRestartAt = 0

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

    this.stopRequested = false
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
        const text = chunk.toString().trim()
        if (text) {
          this.appendStderr(text)
          mainLogger.warn('[openclaw]', text)
        }
      })

      this.child.on('error', (err) => {
        const reason = classifyFailure(err.message, this.stderrBuffer)
        mainLogger.error('[ProcessManager] spawn error:', err.message)
        this.state.transition('ERROR', { error: err.message })
        this.state.setFailure(reason, err.message)
        this.child = null
      })

      this.child.on('exit', (code, signal) => {
        mainLogger.info(`[ProcessManager] exited code=${code} signal=${signal}`)
        this.stopHealthMonitor()
        const wasRunning = this.state.snapshot.status === 'RUNNING'

        if (this.stopRequested) {
          this.state.transition('STOPPED')
          this.child = null
          return
        }

        if (wasRunning && code !== 0) {
          const reason = classifyFailure(`Exit code ${code}`, this.stderrBuffer)
          this.state.transition('ERROR', { error: `Exit code ${code}` })
          this.state.setFailure(reason, `Exit code ${code}`)
          this.child = null
          this.scheduleRestart(reason)
          return
        }

        this.state.transition(code !== 0 ? 'ERROR' : 'STOPPED', code !== 0 ? { error: `Exit code ${code}` } : {})
        if (code !== 0) {
          const reason = classifyFailure(`Exit code ${code}`, this.stderrBuffer)
          this.state.setFailure(reason, `Exit code ${code}`)
          this.scheduleRestart(reason)
        }
        this.child = null
      })

      // Process spawned — stay in STARTING until WS connects (handled by index.ts)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const reason = classifyFailure(message, this.stderrBuffer)
      mainLogger.error('[ProcessManager] Failed to start:', message)
      this.state.transition('ERROR', { error: message })
      this.state.setFailure(reason, message)
      this.child = null
      this.scheduleRestart(reason)
    }
  }

  async stop(): Promise<void> {
    if (!this.child) {
      this.state.transition('STOPPED')
      return
    }

    this.stopRequested = true
    this.stopHealthMonitor()

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

  /** Cancel all pending timers and mark as disposed. Call before stop() during app quit. */
  dispose(): void {
    this.stopRequested = true
    this.stopHealthMonitor()
    if (this.restartTimer) {
      clearTimeout(this.restartTimer)
      this.restartTimer = null
      this.restartInFlight = false
    }
  }

  async restart(): Promise<void> {
    const now = Date.now()
    if (now - this.lastRestartAt < RESTART_DEBOUNCE_MS) {
      mainLogger.warn('[ProcessManager] Restart suppressed due to debounce window')
      return
    }

    this.lastRestartAt = now
    mainLogger.info('[ProcessManager] Restarting...')
    await this.stop()
    await this.start()
  }

  private scheduleRestart(reason: string): void {
    if (this.restartInFlight) return

    const now = Date.now()
    if (now - this.restartWindowStart > RESTART_WINDOW_MS) {
      this.restartWindowStart = now
      this.restartAttempts = 0
    }

    if (this.restartAttempts >= RESTART_MAX_ATTEMPTS) {
      mainLogger.error('[ProcessManager] Restart suppressed: too many failures')
      this.state.setFailure('restart_suppressed', `Restart suppressed after ${this.restartAttempts} failures`) 
      return
    }

    this.restartAttempts += 1
    this.restartInFlight = true
    const delay = RESTART_BACKOFF_BASE_MS * this.restartAttempts

    mainLogger.warn(`[ProcessManager] Scheduling restart in ${delay}ms (${reason})`)
    this.restartTimer = setTimeout(() => {
      this.restartTimer = null
      this.restartInFlight = false
      void this.restart()
    }, delay)
  }

  private buildSpawnArgs(nodePath: string, entryPath: string): string[] {
    return [nodePath, entryPath, 'gateway', '--port', String(GATEWAY_PORT)]
  }

  private buildEnv(): NodeJS.ProcessEnv {
    return {
      ...process.env,
      ...getSystemProxyEnv(),
      OPENCLAW_STATE_DIR: getOpenClawStateDir(),
      OPENCLAW_NO_RESPAWN: '1',
      OPENCLAW_NODE_OPTIONS_READY: '1',
      OPENCLAW_DISABLE_BONJOUR: '1',
      OPENCLAW_SKIP_GMAIL_WATCHER: '1',
      NO_COLOR: '1',
      FORCE_COLOR: undefined,
    }
  }

  get port(): number {
    return GATEWAY_PORT
  }

  get pid(): number | undefined {
    return this.child?.pid
  }

  startHealthMonitor(): void {
    this.stopHealthMonitor()
    this.healthFailures = 0

    this.healthTimer = setInterval(async () => {
      if (!this.child) return
      const url = `http://127.0.0.1:${GATEWAY_PORT}/health`
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(800) })
        // Any HTTP response means the gateway is alive
        this.healthFailures = 0
        this.state.setHealth(res.ok ? 'ok' : 'degraded', Date.now())
      } catch {
        // Connection failed — gateway may be down
        this.healthFailures += 1
        this.state.setHealth('degraded', Date.now())

        if (this.healthFailures >= HEALTH_FAILURE_THRESHOLD) {
          mainLogger.warn('[ProcessManager] Health check failed (connection refused), triggering restart')
          this.state.setFailure('health_check_failed', 'Gateway health check failed')
          this.scheduleRestart('health_check_failed')
          this.healthFailures = 0
        }
      }
    }, HEALTH_MONITOR_INTERVAL_MS)
  }

  private stopHealthMonitor(): void {
    if (this.healthTimer) {
      clearInterval(this.healthTimer)
      this.healthTimer = null
    }
  }

  private appendStderr(text: string): void {
    const lines = text.split('\n').map((line) => line.trim()).filter(Boolean)
    this.stderrBuffer.push(...lines)
    if (this.stderrBuffer.length > STDERR_BUFFER_LINES) {
      this.stderrBuffer = this.stderrBuffer.slice(-STDERR_BUFFER_LINES)
    }
  }
}

/**
 * Read macOS system proxy settings via `scutil --proxy`.
 * GUI apps don't inherit terminal env vars (http_proxy, etc.),
 * so we detect the system proxy and inject them for the child process.
 */
function getSystemProxyEnv(): Record<string, string> {
  // Skip if already set (e.g. launched from terminal)
  if (process.env.http_proxy || process.env.HTTP_PROXY) return {}
  if (process.platform !== 'darwin') return {}

  try {
    const raw = execSync('scutil --proxy', { encoding: 'utf-8', timeout: 3000 })
    const env: Record<string, string> = {}

    // HTTP proxy
    if (/HTTPEnable\s*:\s*1/.test(raw)) {
      const host = raw.match(/HTTPProxy\s*:\s*(\S+)/)?.[1]
      const port = raw.match(/HTTPPort\s*:\s*(\d+)/)?.[1]
      if (host && port) {
        env.http_proxy = `http://${host}:${port}`
      }
    }

    // HTTPS proxy
    if (/HTTPSEnable\s*:\s*1/.test(raw)) {
      const host = raw.match(/HTTPSProxy\s*:\s*(\S+)/)?.[1]
      const port = raw.match(/HTTPSPort\s*:\s*(\d+)/)?.[1]
      if (host && port) {
        env.https_proxy = `http://${host}:${port}`
      }
    }

    // SOCKS proxy
    if (/SOCKSEnable\s*:\s*1/.test(raw)) {
      const host = raw.match(/SOCKSProxy\s*:\s*(\S+)/)?.[1]
      const port = raw.match(/SOCKSPort\s*:\s*(\d+)/)?.[1]
      if (host && port) {
        env.all_proxy = `socks5://${host}:${port}`
      }
    }

    if (Object.keys(env).length > 0) {
      mainLogger.info(`[ProcessManager] Injecting system proxy: ${JSON.stringify(env)}`)
    }
    return env
  } catch {
    return {}
  }
}

function classifyFailure(message: string, stderr: string[]): string {
  const combined = [message, ...stderr].join(' ').toLowerCase()
  if (combined.includes('address already in use') || combined.includes('port') && combined.includes('in use')) {
    return 'port_in_use'
  }
  if (combined.includes('already listening') || combined.includes('gateway instance')) {
    return 'gateway_already_running'
  }
  if (combined.includes('gateway did not start') || combined.includes('did not start within')) {
    return 'gateway_timeout'
  }
  if (combined.includes('openclaw process exited before becoming ready')) {
    return 'early_exit'
  }
  if (combined.includes('missing bundled node runtime') || combined.includes('missing vendored openclaw')) {
    return 'missing_runtime'
  }
  return 'unknown'
}
