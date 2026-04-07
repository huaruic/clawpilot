import { EventEmitter } from 'node:events'
import { shell, type BrowserWindow } from 'electron'
import { getProviderService, ProviderService } from './ProviderService'
import { setProviderSecret } from './SecretStore'
import { getProviderDefinition } from '../../shared/providers/registry'
import type { ProviderAccount } from '../../shared/providers/types'
import { mainLogger } from '../utils/logger'
import { loginGeminiCliOAuth } from './gemini-cli-oauth'
import { loginOpenAICodexOAuth } from './openai-codex-oauth'

export type BrowserOAuthProviderType = 'google' | 'openai'

const GOOGLE_RUNTIME_PROVIDER_ID = 'google-gemini-cli'
const GOOGLE_OAUTH_DEFAULT_MODEL = 'gemini-3-pro-preview'
const OPENAI_RUNTIME_PROVIDER_ID = 'openai-codex'
const OPENAI_OAUTH_DEFAULT_MODEL = 'gpt-5.4'

export class BrowserOAuthManager extends EventEmitter {
  private activeProvider: BrowserOAuthProviderType | null = null
  private activeAccountId: string | null = null
  private activeLabel: string | null = null
  private active = false
  private mainWindow: BrowserWindow | null = null
  private abortController: AbortController | null = null

  get currentProvider(): BrowserOAuthProviderType | null {
    return this.activeProvider
  }

  setWindow(window: BrowserWindow): void {
    this.mainWindow = window
  }

  async startFlow(
    provider: BrowserOAuthProviderType,
    options?: { accountId?: string; label?: string },
  ): Promise<boolean> {
    if (this.active) {
      mainLogger.warn('[browser-oauth] Flow already active, ignoring')
      return false
    }

    this.active = true
    this.activeProvider = provider
    this.activeAccountId = options?.accountId ?? provider
    this.activeLabel = options?.label ?? getProviderDefinition(provider)?.name ?? provider
    this.abortController = new AbortController()

    this.emitToAll('oauth:start', { provider, accountId: this.activeAccountId })

    try {
      if (provider === 'google') {
        await this.runGoogleFlow()
      } else if (provider === 'openai') {
        await this.runOpenAIFlow()
      }
    } catch (err) {
      // Don't emit error if flow was intentionally cancelled
      if (this.abortController?.signal.aborted) {
        mainLogger.info(`[browser-oauth] Flow cancelled for ${provider}`)
      } else {
        const message = err instanceof Error ? err.message : String(err)
        mainLogger.error(`[browser-oauth] Flow failed for ${provider}:`, message)
        this.emitToAll('oauth:error', { message })
      }
    } finally {
      this.active = false
      this.activeProvider = null
      this.abortController = null
    }

    return true
  }

  async stopFlow(): Promise<void> {
    // Abort any in-progress OAuth flow — this closes the local callback server
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }
    this.active = false
    this.activeProvider = null
    this.activeAccountId = null
    this.activeLabel = null
  }

  private async runGoogleFlow(): Promise<void> {
    const credentials = await loginGeminiCliOAuth({
      openUrl: async (url) => { await shell.openExternal(url) },
      log: (msg) => mainLogger.info(`[browser-oauth] ${msg}`),
      note: async (message, title) => {
        this.emitToAll('oauth:code', { provider: 'google', message, title })
      },
      progress: {
        update: (msg) => mainLogger.info(`[browser-oauth] ${msg}`),
        stop: (msg) => mainLogger.info(`[browser-oauth] ${msg ?? 'Done'}`),
      },
    })

    await this.onSuccess('google', {
      accessToken: credentials.access,
      refreshToken: credentials.refresh,
      expiresAt: credentials.expires,
      email: credentials.email,
    })
  }

  private async runOpenAIFlow(): Promise<void> {
    const credentials = await loginOpenAICodexOAuth({
      openUrl: async (url) => { await shell.openExternal(url) },
      onProgress: (msg) => mainLogger.info(`[browser-oauth] ${msg}`),
      signal: this.abortController?.signal,
    })

    await this.onSuccess('openai', {
      accessToken: credentials.access,
      refreshToken: credentials.refresh,
      expiresAt: credentials.expires,
      subject: credentials.accountId,
    })
  }

  private async onSuccess(
    provider: BrowserOAuthProviderType,
    token: {
      accessToken: string
      refreshToken: string
      expiresAt: number
      email?: string
      subject?: string
    },
  ): Promise<void> {
    const accountId = this.activeAccountId ?? provider
    const label = this.activeLabel ?? getProviderDefinition(provider)?.name ?? provider

    const runtimeProviderId = provider === 'google'
      ? GOOGLE_RUNTIME_PROVIDER_ID
      : OPENAI_RUNTIME_PROVIDER_ID

    const defaultModel = provider === 'google'
      ? GOOGLE_OAUTH_DEFAULT_MODEL
      : OPENAI_OAUTH_DEFAULT_MODEL

    const account: ProviderAccount = ProviderService.buildAccount({
      id: accountId,
      vendorId: provider,
      label,
      model: defaultModel,
    })
    account.authMode = 'oauth_browser'
    account.metadata = {
      ...account.metadata,
      email: token.email,
      resourceUrl: runtimeProviderId,
    }

    const service = getProviderService()
    await service.createAccount(account)
    await setProviderSecret({
      type: 'oauth',
      accountId,
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
      expiresAt: token.expiresAt,
      email: token.email,
      subject: token.subject,
    })

    mainLogger.info(`[browser-oauth] Successfully created account "${accountId}" for ${provider}`)
    this.emitToAll('oauth:success', { provider, accountId })
  }

  private emitToAll(event: string, data: unknown): void {
    this.emit(event, data)
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(event, data)
    }
  }
}

export const browserOAuthManager = new BrowserOAuthManager()
