import { createHash, randomBytes, randomUUID } from 'node:crypto'

export type MiniMaxRegion = 'cn' | 'global'

export interface MiniMaxOAuthToken {
  access: string
  refresh: string
  expires: number
  resourceUrl?: string
  notificationMessage?: string
}

export interface MiniMaxOAuthOptions {
  openUrl: (url: string) => Promise<void>
  note: (message: string, title?: string) => Promise<void>
  progress: { update: (message: string) => void; stop: (message?: string) => void }
  region?: MiniMaxRegion
}

const MINIMAX_OAUTH_CONFIG = {
  cn: {
    baseUrl: 'https://api.minimaxi.com',
    clientId: '78257093-7e40-4613-99e0-527b14b39113',
  },
  global: {
    baseUrl: 'https://api.minimax.io',
    clientId: '78257093-7e40-4613-99e0-527b14b39113',
  },
}

const MINIMAX_OAUTH_SCOPE = 'group_id profile model.completion'
const MINIMAX_OAUTH_GRANT_TYPE = 'urn:ietf:params:oauth:grant-type:user_code'

function base64url(buffer: Buffer): string {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function generatePkce(): { verifier: string; challenge: string; state: string } {
  const verifier = base64url(randomBytes(32))
  const challenge = base64url(createHash('sha256').update(verifier).digest())
  const state = base64url(randomBytes(16))
  return { verifier, challenge, state }
}

export async function loginMiniMaxPortalOAuth(params: MiniMaxOAuthOptions): Promise<MiniMaxOAuthToken> {
  const region = params.region ?? 'global'
  const config = MINIMAX_OAUTH_CONFIG[region]
  const codeEndpoint = `${config.baseUrl}/oauth/code`
  const tokenEndpoint = `${config.baseUrl}/oauth/token`
  const pkce = generatePkce()

  // Step 1: Request device code
  const codeBody = new URLSearchParams({
    response_type: 'user_code',
    client_id: config.clientId,
    scope: MINIMAX_OAUTH_SCOPE,
    code_challenge: pkce.challenge,
    code_challenge_method: 'S256',
    state: pkce.state,
  })

  const codeRes = await fetch(codeEndpoint, {
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
    throw new Error(`MiniMax OAuth code request failed: ${codeRes.status} ${text}`)
  }

  const codeData = await codeRes.json() as {
    user_code: string
    verification_uri: string
    expired_in: number
    interval?: number
    state?: string
  }

  if (codeData.state && codeData.state !== pkce.state) {
    throw new Error('MiniMax OAuth state mismatch — possible CSRF attack')
  }

  // Step 2: Show verification URI to user
  await params.note(
    `Open ${codeData.verification_uri} to authorize. Code: ${codeData.user_code}`,
    'MiniMax Authorization',
  )
  await params.openUrl(codeData.verification_uri)
  params.progress.update('Waiting for authorization...')

  // Step 3: Poll for token
  const pollInterval = (codeData.interval ?? 2) * 1000
  const deadline = codeData.expired_in * 1000 // absolute unix timestamp in ms

  while (Date.now() < deadline) {
    await sleep(pollInterval)

    const tokenBody = new URLSearchParams({
      grant_type: MINIMAX_OAUTH_GRANT_TYPE,
      client_id: config.clientId,
      user_code: codeData.user_code,
      code_verifier: pkce.verifier,
    })

    const tokenRes = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'x-request-id': randomUUID(),
      },
      body: tokenBody.toString(),
    })

    const tokenData = await tokenRes.json() as {
      status?: string
      access_token?: string
      refresh_token?: string
      expired_in?: number
      resource_url?: string
      notification_message?: string
      error?: string
      error_description?: string
    }

    if (tokenData.status === 'success' && tokenData.access_token) {
      params.progress.stop('Authorization successful')
      return {
        access: tokenData.access_token,
        refresh: tokenData.refresh_token ?? '',
        expires: Date.now() + (tokenData.expired_in ?? 3600) * 1000,
        resourceUrl: tokenData.resource_url,
        notificationMessage: tokenData.notification_message,
      }
    }

    if (tokenData.status === 'error' || tokenData.error) {
      throw new Error(tokenData.error_description || tokenData.error || 'MiniMax OAuth token request failed')
    }

    // Still pending, continue polling
    params.progress.update('Waiting for authorization...')
  }

  throw new Error('MiniMax OAuth authorization timed out')
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
