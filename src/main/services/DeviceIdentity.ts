import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { app } from 'electron'

interface StoredDevice {
  deviceId: string
  publicKeyPem: string
  privateKeyPem: string
}

let cached: StoredDevice | null = null

function deviceFilePath(): string {
  return path.join(app.getPath('userData'), 'clawpilot', 'device.json')
}

function base64UrlEncode(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function derivePublicKeyRaw(publicKeyPem: string): Buffer {
  const key = crypto.createPublicKey(publicKeyPem)
  return key.export({ type: 'spki', format: 'der' }).subarray(-32) // last 32 bytes = Ed25519 raw key
}

function deriveDeviceId(publicKeyPem: string): string {
  const raw = derivePublicKeyRaw(publicKeyPem)
  return crypto.createHash('sha256').update(raw).digest('hex')
}

async function generate(): Promise<StoredDevice> {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519')
  const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }) as string
  const deviceId = deriveDeviceId(publicKeyPem)
  const identity: StoredDevice = { deviceId, publicKeyPem, privateKeyPem }
  const filePath = deviceFilePath()
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, JSON.stringify(identity, null, 2), { encoding: 'utf-8', mode: 0o600 })
  return identity
}

export async function getOrCreateDeviceIdentity(): Promise<StoredDevice> {
  if (cached) return cached
  try {
    const raw = await fs.readFile(deviceFilePath(), 'utf-8')
    cached = JSON.parse(raw) as StoredDevice
    return cached
  } catch {
    cached = await generate()
    return cached
  }
}

export interface DeviceConnectParams {
  id: string
  publicKey: string   // raw Ed25519 bytes, base64url
  signature: string   // Ed25519 signature of v3 payload, base64url
  signedAt: number
  nonce: string
}

export function buildDeviceParams(opts: {
  deviceId: string
  privateKeyPem: string
  publicKeyPem: string
  clientId: string
  clientMode: string
  role: string
  scopes: string[]
  token: string
  nonce: string
  platform: string
}): DeviceConnectParams {
  const signedAt = Date.now()

  // v3 payload format (matches openclaw's buildDeviceAuthPayloadV3)
  const scopesStr = opts.scopes.join(',')
  const platform = opts.platform.toLowerCase()
  const deviceFamily = ''
  const payload = [
    'v3',
    opts.deviceId,
    opts.clientId,
    opts.clientMode,
    opts.role,
    scopesStr,
    String(signedAt),
    opts.token ?? '',
    opts.nonce,
    platform,
    deviceFamily,
  ].join('|')

  const privateKey = crypto.createPrivateKey(opts.privateKeyPem)
  const signature = base64UrlEncode(crypto.sign(null, Buffer.from(payload, 'utf-8'), privateKey))
  const publicKey = base64UrlEncode(derivePublicKeyRaw(opts.publicKeyPem))

  return {
    id: opts.deviceId,
    publicKey,
    signature,
    signedAt,
    nonce: opts.nonce,
  }
}
