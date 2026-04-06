import { createHash, randomBytes, randomUUID } from 'node:crypto'

export interface QwenOAuthToken {
  access: string
  refresh: string
  expires: number
  resourceUrl?: string
}

export interface QwenOAuthOptions {
  openUrl: (url: string) => Promise<void>
  note: (message: string, title?: string) => Promise<void>
  progress: { update: (message: string) => void; stop: (message?: string) => void }
}

const QWEN_OAUTH_BASE_URL = 'https://chat.qwen.ai'
const QWEN_OAUTH_DEVICE_CODE_ENDPOINT = `${QWEN_OAUTH_BASE_URL}/api/v1/oauth2/device/code`
const QWEN_OAUTH_TOKEN_ENDPOINT = `${QWEN_OAUTH_BASE_URL}/api/v1/oauth2/token`
const QWEN_OAUTH_CLIENT_ID = 'f0304373b74a44d2b584a3fb70ca9e56'
const QWEN_OAUTH_SCOPE = 'openid profile email model.completion'
const QWEN_OAUTH_GRANT_TYPE = 'urn:ietf:params:oauth:grant-type:device_code'

function base64url(buffer: Buffer): string {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function generatePkce(): { verifier: string; challenge: string } {
  const verifier = base64url(randomBytes(32))
  const challenge = base64url(createHash('sha256').update(verifier).digest())
  return { verifier, challenge }
}

export async function loginQwenPortalOAuth(params: QwenOAuthOptions): Promise<QwenOAuthToken> {
  const pkce = generatePkce()

  // Step 1: Request device code
  const codeBody = new URLSearchParams({
    client_id: QWEN_OAUTH_CLIENT_ID,
    scope: QWEN_OAUTH_SCOPE,
    code_challenge: pkce.challenge,
    code_challenge_method: 'S256',
  })

  const codeRes = await fetch(QWEN_OAUTH_DEVICE_CODE_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
      'x-request-id': randomUUID(),
    },
    body: codeBody.toString(),
  })

  if (!codeRes.ok) {
    const text = await codeRes.text()
    throw new Error(`Qwen OAuth code request failed: ${codeRes.status} ${text}`)
  }

  const device = await codeRes.json() as {
    device_code: string
    user_code: string
    verification_uri: string
    verification_uri_complete?: string
    expires_in: number
    interval?: number
  }

  // Step 2: Show verification URI to user
  const verifyUrl = device.verification_uri_complete || device.verification_uri
  await params.note(
    `Open ${verifyUrl} to authorize. Code: ${device.user_code}`,
    'Qwen Authorization',
  )
  await params.openUrl(verifyUrl)
  params.progress.update('Waiting for authorization...')

  // Step 3: Poll for token
  let pollInterval = (device.interval ?? 2) * 1000
  const deadline = Date.now() + device.expires_in * 1000

  while (Date.now() < deadline) {
    await sleep(pollInterval)

    const tokenBody = new URLSearchParams({
      grant_type: QWEN_OAUTH_GRANT_TYPE,
      client_id: QWEN_OAUTH_CLIENT_ID,
      device_code: device.device_code,
      code_verifier: pkce.verifier,
    })

    const tokenRes = await fetch(QWEN_OAUTH_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'x-request-id': randomUUID(),
      },
      body: tokenBody.toString(),
    })

    const tokenData = await tokenRes.json() as {
      access_token?: string
      refresh_token?: string
      expires_in?: number
      token_type?: string
      resource_url?: string
      error?: string
      error_description?: string
    }

    if (tokenData.access_token) {
      params.progress.stop('Authorization successful')
      return {
        access: tokenData.access_token,
        refresh: tokenData.refresh_token ?? '',
        expires: Date.now() + (tokenData.expires_in ?? 3600) * 1000,
        resourceUrl: tokenData.resource_url,
      }
    }

    if (tokenData.error === 'authorization_pending') {
      params.progress.update('Waiting for authorization...')
      continue
    }

    if (tokenData.error === 'slow_down') {
      pollInterval = Math.min(pollInterval * 1.5, 10000)
      continue
    }

    if (tokenData.error) {
      throw new Error(tokenData.error_description || tokenData.error || 'Qwen OAuth token request failed')
    }
  }

  throw new Error('Qwen OAuth authorization timed out')
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
