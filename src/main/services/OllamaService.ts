import { shell } from 'electron'

const OLLAMA_BASE_URL = 'http://127.0.0.1:11434'
const RECOMMENDED_MODEL = 'qwen2.5:7b'
const OLLAMA_INSTALL_URL = 'https://ollama.com/download'
const MAX_LOG_LINES = 80

export interface OllamaStatus {
  installed: boolean
  running: boolean
  recommendedModel: string
  recommendedInstalled: boolean
  availableModels: string[]
  downloading: boolean
  downloadProgress: number
  downloadLog: string[]
  error?: string
}

export class OllamaService {
  private pullInFlight = false
  private pullProgress = 0
  private pullLog: string[] = []
  private lastError: string | undefined

  async getStatus(): Promise<OllamaStatus> {
    const running = await this.isRunning()
    const availableModels = running ? await this.listModels() : []

    return {
      installed: running,
      running,
      recommendedModel: RECOMMENDED_MODEL,
      recommendedInstalled: availableModels.includes(RECOMMENDED_MODEL),
      availableModels,
      downloading: this.pullInFlight,
      downloadProgress: this.pullProgress,
      downloadLog: [...this.pullLog],
      ...(this.lastError ? { error: this.lastError } : {}),
    }
  }

  async pullRecommended(): Promise<{ ok: boolean }> {
    if (this.pullInFlight) return { ok: true }

    const running = await this.isRunning()
    if (!running) {
      this.lastError = 'Ollama runtime is not reachable at http://127.0.0.1:11434'
      return { ok: false }
    }

    this.pullInFlight = true
    this.pullProgress = 0
    this.pullLog = []
    this.lastError = undefined

    try {
      const response = await fetch(`${OLLAMA_BASE_URL}/api/pull`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: RECOMMENDED_MODEL, stream: true }),
      })

      if (!response.ok || !response.body) {
        this.lastError = `Ollama pull failed with HTTP ${response.status}`
        return { ok: false }
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          this.consumePullEvent(line)
        }
      }

      const trailing = buffer.trim()
      if (trailing) {
        this.consumePullEvent(trailing)
      }

      this.pullProgress = 100
      return { ok: true }
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error)
      this.appendPullLog(`Download failed: ${this.lastError}`)
      return { ok: false }
    } finally {
      this.pullInFlight = false
    }
  }

  async openInstallPage(): Promise<{ ok: boolean }> {
    const result = await shell.openExternal(OLLAMA_INSTALL_URL)
    if (result) {
      this.lastError = result
      return { ok: false }
    }
    this.lastError = undefined
    return { ok: true }
  }

  private consumePullEvent(line: string): void {
    const trimmed = line.trim()
    if (!trimmed) return

    try {
      const event = JSON.parse(trimmed) as {
        status?: string
        error?: string
        completed?: number
        total?: number
      }

      if (event.error) {
        this.lastError = event.error
        this.appendPullLog(`Error: ${event.error}`)
        return
      }

      if (event.status) {
        this.appendPullLog(event.status)
      }

      if (typeof event.completed === 'number' && typeof event.total === 'number' && event.total > 0) {
        this.pullProgress = Math.min(99, Math.floor((event.completed / event.total) * 100))
      }
    } catch {
      this.appendPullLog(trimmed)
    }
  }

  private appendPullLog(line: string): void {
    this.pullLog.push(line)
    if (this.pullLog.length > MAX_LOG_LINES) {
      this.pullLog = this.pullLog.slice(-MAX_LOG_LINES)
    }
  }

  private async isRunning(): Promise<boolean> {
    try {
      const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`, { signal: AbortSignal.timeout(3000) })
      return res.ok
    } catch {
      return false
    }
  }

  private async listModels(): Promise<string[]> {
    try {
      const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`, { signal: AbortSignal.timeout(5000) })
      if (!res.ok) return []
      const data = await res.json() as { models?: Array<{ name?: string; model?: string }> }
      return (data.models ?? [])
        .map((item) => item.name ?? item.model ?? '')
        .map((item) => item.trim())
        .filter(Boolean)
    } catch {
      return []
    }
  }
}

export const ollamaService = new OllamaService()
export const OLLAMA_PROVIDER_NAME = 'ollama'
export const OLLAMA_BASE_URL_DEFAULT = OLLAMA_BASE_URL
export const OLLAMA_RECOMMENDED_MODEL = RECOMMENDED_MODEL
