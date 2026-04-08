import { createHash, randomBytes } from 'node:crypto'
import { createServer, type Server } from 'node:http'
import { net } from 'electron'

const CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann'
const AUTHORIZE_URL = 'https://auth.openai.com/oauth/authorize'
const TOKEN_URL = 'https://auth.openai.com/oauth/token'
const REDIRECT_URI = 'http://localhost:1455/auth/callback'
const SCOPE = 'openid profile email offline_access'
const JWT_CLAIM_PATH = 'https://api.openai.com/auth'
const ORIGINATOR = 'codex_cli_rs'

const SUCCESS_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Authentication successful</title>
</head>
<body>
  <p>Authentication successful. Return to CatClaw to continue.</p>
</body>
</html>`

export interface OpenAICodexOAuthCredentials {
  access: string
  refresh: string
  expires: number
  accountId: string
}

function toBase64Url(buffer: Buffer): string {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function createPkce(): { verifier: string; challenge: string } {
  const verifier = toBase64Url(randomBytes(32))
  const challenge = toBase64Url(createHash('sha256').update(verifier).digest())
  return { verifier, challenge }
}

function createState(): string {
  return toBase64Url(randomBytes(32))
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3 || !parts[1]) return null

    const normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4)
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8')) as Record<string, unknown>
  } catch {
    return null
  }
}

function getAccountIdFromAccessToken(accessToken: string): string | null {
  const payload = decodeJwtPayload(accessToken)
  const authClaims = payload?.[JWT_CLAIM_PATH]
  if (!authClaims || typeof authClaims !== 'object') return null

  const accountId = (authClaims as Record<string, unknown>).chatgpt_account_id
  if (typeof accountId !== 'string' || !accountId.trim()) return null

  return accountId
}

/** Force-close a server: stop accepting + destroy all existing connections */
function forceCloseServer(server: Server): void {
  try { server.close() } catch { /* ignore */ }
  try {
    if (typeof server.closeAllConnections === 'function') {
      server.closeAllConnections()
    }
  } catch { /* ignore */ }
}

// Module-level singleton: ensures only one callback server exists at a time.
// If a previous flow's server is still alive (e.g. app hot-reload), it gets
// force-closed before starting a new one.
let activeCallbackServer: Server | null = null

/**
 * Start a local HTTP server that waits for the OAuth callback.
 * Returns a Promise that resolves with the authorization code,
 * or rejects if aborted/timed out.
 */
function waitForOAuthCallback(
  state: string,
  signal?: AbortSignal,
): { promise: Promise<string>; server: Server } {
  // Kill any leftover server from a previous flow
  if (activeCallbackServer) {
    forceCloseServer(activeCallbackServer)
    activeCallbackServer = null
  }

  let resolvePromise: (code: string) => void
  let rejectPromise: (err: Error) => void
  const promise = new Promise<string>((resolve, reject) => {
    resolvePromise = resolve
    rejectPromise = reject
  })

  const server = createServer((req, res) => {
    try {
      const url = new URL(req.url || '', 'http://localhost')
      if (url.pathname !== '/auth/callback') {
        res.statusCode = 404; res.end('Not found'); return
      }
      if (url.searchParams.get('state') !== state) {
        res.statusCode = 400; res.end('State mismatch — please try again.'); return
      }
      const code = url.searchParams.get('code')
      if (!code) {
        res.statusCode = 400; res.end('Missing authorization code'); return
      }
      res.statusCode = 200
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.end(SUCCESS_HTML)
      resolvePromise(code)
      cleanup()
    } catch {
      res.statusCode = 500; res.end('Internal error')
    }
  })

  activeCallbackServer = server

  const cleanup = () => {
    clearTimeout(timeout)
    forceCloseServer(server)
    activeCallbackServer = null
  }

  const timeout = setTimeout(() => {
    cleanup()
    rejectPromise(new Error('OAuth callback timed out (120s).'))
  }, 120_000)

  if (signal) {
    const onAbort = () => { cleanup(); rejectPromise(new Error('OAuth flow was cancelled')) }
    signal.aborted ? onAbort() : signal.addEventListener('abort', onAbort, { once: true })
  }

  server.listen(1455, 'localhost')
  server.on('error', (err) => {
    cleanup()
    rejectPromise(new Error(`Cannot start OAuth callback server on localhost:1455: ${err.message}`))
  })

  return { promise, server }
}

async function exchangeAuthorizationCode(
  code: string,
  verifier: string,
): Promise<{ access: string; refresh: string; expires: number }> {
  const response = await net.fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: CLIENT_ID,
      code,
      code_verifier: verifier,
      redirect_uri: REDIRECT_URI,
    }),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`OpenAI token exchange failed (${response.status}): ${text}`)
  }

  const json = (await response.json()) as {
    access_token?: string
    refresh_token?: string
    expires_in?: number
  }
  if (!json.access_token || !json.refresh_token || typeof json.expires_in !== 'number') {
    throw new Error('OpenAI token response missing fields')
  }

  return {
    access: json.access_token,
    refresh: json.refresh_token,
    expires: Date.now() + json.expires_in * 1000,
  }
}

export async function loginOpenAICodexOAuth(options: {
  openUrl: (url: string) => Promise<void>
  onProgress?: (message: string) => void
  signal?: AbortSignal
}): Promise<OpenAICodexOAuthCredentials> {
  const { verifier, challenge } = createPkce()
  const state = createState()

  const url = new URL(AUTHORIZE_URL)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', CLIENT_ID)
  url.searchParams.set('redirect_uri', REDIRECT_URI)
  url.searchParams.set('scope', SCOPE)
  url.searchParams.set('code_challenge', challenge)
  url.searchParams.set('code_challenge_method', 'S256')
  url.searchParams.set('state', state)
  url.searchParams.set('id_token_add_organizations', 'true')
  url.searchParams.set('codex_cli_simplified_flow', 'true')
  url.searchParams.set('originator', ORIGINATOR)

  options.onProgress?.('Opening OpenAI sign-in page…')

  const { promise: codePromise, server } = waitForOAuthCallback(state, options.signal)

  // Prevent unhandled rejection if codePromise rejects before we await it
  // (e.g. server error fires while openUrl is still running)
  codePromise.catch(() => {})

  try {
    await options.openUrl(url.toString())
    options.onProgress?.('Waiting for OpenAI OAuth callback…')

    const code = await codePromise

    options.onProgress?.('Exchanging authorization code…')
    const token = await exchangeAuthorizationCode(code, verifier)
    const accountId = getAccountIdFromAccessToken(token.access)
    if (!accountId) {
      throw new Error('Failed to extract OpenAI accountId from token')
    }

    return {
      access: token.access,
      refresh: token.refresh,
      expires: token.expires,
      accountId,
    }
  } finally {
    forceCloseServer(server)
  }
}
