import WebSocket from 'ws'
import { randomUUID } from 'node:crypto'
import { mainLogger } from '../utils/logger'
import { waitForGatewayToken } from './OpenClawConfigWriter'
import { getOrCreateDeviceIdentity, buildDeviceParams } from './DeviceIdentity'

type RequestFrame = { type: 'req'; id: string; method: string; params?: unknown }
type ResponseFrame = { type: 'res'; id: string; ok: boolean; payload?: unknown; error?: { code: string; message: string } }
type EventFrame = { type: 'event'; event: string; payload?: unknown; seq?: number }

interface Pending {
  resolve: (v: unknown) => void
  reject: (e: Error) => void
}

type EventHandler = (payload: unknown) => void

const CLIENT_ID = 'cli'
const CLIENT_MODE = 'cli'
const ROLE = 'operator'
const SCOPES = ['operator.read', 'operator.write', 'operator.admin']

export class WsGatewayClient {
  private ws: WebSocket | null = null
  private pending = new Map<string, Pending>()
  private eventHandlers = new Map<string, Set<EventHandler>>()
  private agentLogBuffers = new Map<string, {
    sessionKey?: string
    startedAt?: number
    lastSeq?: number
    text: string
  }>()
  private port: number
  private _isConnected = false

  constructor(port: number) {
    this.port = port
  }

  get isConnected(): boolean {
    return this._isConnected
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = `ws://127.0.0.1:${this.port}`
      mainLogger.info(`[WsClient] Connecting to ${url}`)

      this.ws = new WebSocket(url)

      this.ws.on('open', () => {
        this.sendHandshake().then(resolve).catch(reject)
      })

      this.ws.on('message', (data) => {
        this.handleMessage(data.toString())
      })

      this.ws.on('error', (err) => {
        mainLogger.error('[WsClient] error:', err.message)
        if (!this._isConnected) reject(err)
      })

      this.ws.on('close', () => {
        mainLogger.info('[WsClient] closed')
        this._isConnected = false
        this.rejectAllPending(new Error('WebSocket closed'))
      })
    })
  }

  private sendHandshake(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.ws?.removeListener('message', onHandshakeMessage)
        reject(new Error('Handshake timeout'))
      }, 10000)

      const onHandshakeMessage = (raw: WebSocket.RawData): void => {
        try {
          const frame = JSON.parse(raw.toString())
          if (frame.type === 'event' && frame.event === 'connect.challenge') {
            const nonce = (frame.payload as { nonce?: string })?.nonce ?? ''
            mainLogger.info('[WsClient] Got connect.challenge, completing handshake...')
            void this.completeHandshake(nonce)
              .then(() => {
                clearTimeout(timeout)
                this.ws?.removeListener('message', onHandshakeMessage)
                this._isConnected = true
                mainLogger.info('[WsClient] Handshake complete')
                resolve()
              })
              .catch((err: Error) => {
                clearTimeout(timeout)
                this.ws?.removeListener('message', onHandshakeMessage)
                reject(err)
              })
          }
        } catch {
          // not a valid frame
        }
      }

      this.ws!.on('message', onHandshakeMessage)
    })
  }

  private async completeHandshake(nonce: string): Promise<void> {
    const token = await waitForGatewayToken()
    const identity = await getOrCreateDeviceIdentity()

    const device = buildDeviceParams({
      deviceId: identity.deviceId,
      privateKeyPem: identity.privateKeyPem,
      publicKeyPem: identity.publicKeyPem,
      clientId: CLIENT_ID,
      clientMode: CLIENT_MODE,
      role: ROLE,
      scopes: SCOPES,
      token,
      nonce,
      platform: process.platform,
    })

    const connectParams = {
      minProtocol: 1,
      maxProtocol: 99,
      client: {
        id: CLIENT_ID,
        displayName: 'ClawPilot',
        version: '1.0.0',
        platform: process.platform,
        mode: CLIENT_MODE,
      },
      caps: ['tool-events'],
      role: ROLE,
      scopes: SCOPES,
      ...(token ? { auth: { token } } : {}),
      device,
    }

    const id = randomUUID()
    await new Promise<void>((resolve, reject) => {
      this.pending.set(id, {
        resolve: () => resolve(),
        reject,
      })
      const frame: RequestFrame = { type: 'req', id, method: 'connect', params: connectParams }
      this.ws!.send(JSON.stringify(frame))
    })
  }

  async request<T = unknown>(method: string, params?: unknown): Promise<T> {
    if (!this.ws || !this._isConnected) {
      throw new Error('WebSocket not connected')
    }

    const id = randomUUID()
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, {
        resolve: (v) => resolve(v as T),
        reject,
      })

      const frame: RequestFrame = { type: 'req', id, method, params }
      this.ws!.send(JSON.stringify(frame))
    })
  }

  on(event: string, handler: EventHandler): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set())
    }
    this.eventHandlers.get(event)!.add(handler)
    return () => {
      this.eventHandlers.get(event)?.delete(handler)
    }
  }

  disconnect(): void {
    this._isConnected = false
    this.ws?.close()
    this.ws = null
  }

  private handleMessage(raw: string): void {
    let frame: RequestFrame | ResponseFrame | EventFrame
    try {
      frame = JSON.parse(raw)
    } catch {
      return
    }

    if ((frame as ResponseFrame).type === 'res') {
      const res = frame as ResponseFrame
      const pending = this.pending.get(res.id)
      if (pending) {
        this.pending.delete(res.id)
        if (res.ok) {
          pending.resolve(res.payload)
        } else {
          pending.reject(new Error(res.error?.message ?? 'RPC error'))
        }
      }
    } else if ((frame as EventFrame).type === 'event') {
      const evt = frame as EventFrame
      this.logEvent(evt)
      const handlers = this.eventHandlers.get(evt.event)
      handlers?.forEach((h) => {
        try { h(evt.payload) } catch { /* ignore */ }
      })
    }
  }

  private rejectAllPending(err: Error): void {
    for (const [, p] of this.pending) {
      p.reject(err)
    }
    this.pending.clear()
  }

  private logEvent(evt: EventFrame): void {
    if (evt.event === 'chat') {
      return
    }

    if (evt.event !== 'agent') {
      mainLogger.info(`[WsClient] event: ${evt.event}`, JSON.stringify(evt.payload).slice(0, 200))
      return
    }

    const payload = evt.payload
    if (!payload || typeof payload !== 'object') {
      mainLogger.info('[WsClient] event: agent', JSON.stringify(payload).slice(0, 200))
      return
    }

    const agentEvent = payload as {
      runId?: unknown
      seq?: unknown
      stream?: unknown
      sessionKey?: unknown
      data?: Record<string, unknown>
    }

    const runId = typeof agentEvent.runId === 'string' ? agentEvent.runId : ''
    const stream = typeof agentEvent.stream === 'string' ? agentEvent.stream : ''
    const seq = typeof agentEvent.seq === 'number' ? agentEvent.seq : undefined
    const sessionKey = typeof agentEvent.sessionKey === 'string' ? agentEvent.sessionKey : undefined
    const data = agentEvent.data ?? {}

    if (!runId) {
      mainLogger.info('[WsClient] event: agent', JSON.stringify(payload).slice(0, 200))
      return
    }

    const current = this.agentLogBuffers.get(runId) ?? { text: '' }
    if (sessionKey) current.sessionKey = sessionKey
    if (seq !== undefined) current.lastSeq = seq

    if (stream === 'lifecycle') {
      const phase = typeof data.phase === 'string' ? data.phase : ''
      if (phase === 'start') {
        current.startedAt = typeof data.startedAt === 'number' ? data.startedAt : Date.now()
        this.agentLogBuffers.set(runId, current)
        mainLogger.info(`[WsClient] agent start runId=${runId} sessionKey=${current.sessionKey ?? '-'}`)
        return
      }

      if (phase === 'end' || phase === 'error') {
        const durationMs = current.startedAt ? Math.max(0, Date.now() - current.startedAt) : undefined
        const normalizedText = current.text.replace(/\s+/g, ' ').trim()
        const preview = normalizedText ? JSON.stringify(normalizedText.slice(0, 120)) : '""'
        const reason = typeof data.reason === 'string' && data.reason.trim() ? ` reason=${JSON.stringify(data.reason.trim())}` : ''
        const duration = durationMs !== undefined ? ` durationMs=${durationMs}` : ''
        const seqText = current.lastSeq !== undefined ? ` lastSeq=${current.lastSeq}` : ''
        mainLogger.info(
          `[WsClient] agent ${phase} runId=${runId} sessionKey=${current.sessionKey ?? '-'}${duration}${seqText} textChars=${current.text.length} preview=${preview}${reason}`,
        )
        this.agentLogBuffers.delete(runId)
        return
      }
    }

    if (stream === 'assistant') {
      const delta = firstString(data.delta, data.text)
      if (delta) {
        current.text += delta
        this.agentLogBuffers.set(runId, current)
      }
      return
    }

    if (stream === 'error') {
      const reason = firstString(data.reason, data.message, 'Agent failed')
      const durationMs = current.startedAt ? Math.max(0, Date.now() - current.startedAt) : undefined
      const duration = durationMs !== undefined ? ` durationMs=${durationMs}` : ''
      const seqText = current.lastSeq !== undefined ? ` lastSeq=${current.lastSeq}` : ''
      mainLogger.warn(
        `[WsClient] agent error runId=${runId} sessionKey=${current.sessionKey ?? '-'}${duration}${seqText} textChars=${current.text.length} reason=${JSON.stringify(reason)}`,
      )
      this.agentLogBuffers.delete(runId)
      return
    }
  }
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value
    }
  }
  return ''
}
