import { EventEmitter } from 'node:events'
import { shell, type BrowserWindow } from 'electron'
import { loginMiniMaxPortalOAuth, type MiniMaxRegion } from './minimax-oauth'
import { loginQwenPortalOAuth } from './qwen-oauth'
import { getProviderService, ProviderService } from './ProviderService'
import { setProviderSecret } from './SecretStore'
import { getProviderDefinition } from '../../shared/providers/registry'
import type { ProviderAccount } from '../../shared/providers/types'
import { mainLogger } from '../utils/logger'

export type OAuthProviderType = 'minimax-portal' | 'minimax-portal-cn' | 'qwen-portal'

export class DeviceOAuthManager extends EventEmitter {
  private activeProvider: OAuthProviderType | null = null
  private activeAccountId: string | null = null
  private activeLabel: string | null = null
  private active = false
  private mainWindow: BrowserWindow | null = null

  get currentProvider(): OAuthProviderType | null {
    return this.activeProvider
  }

  setWindow(window: BrowserWindow): void {
    this.mainWindow = window
  }

  async startFlow(
    provider: OAuthProviderType,
    region?: MiniMaxRegion,
    options?: { accountId?: string; label?: string },
  ): Promise<boolean> {
    if (this.active) {
      mainLogger.warn('[device-oauth] Flow already active, ignoring')
      return false
    }

    this.active = true
    this.activeProvider = provider
    this.activeAccountId = options?.accountId ?? provider
    this.activeLabel = options?.label ?? getProviderDefinition(provider)?.name ?? provider

    this.emitToAll('oauth:start', { provider, accountId: this.activeAccountId })

    try {
      if (provider === 'minimax-portal' || provider === 'minimax-portal-cn') {
        await this.runMiniMaxFlow(provider, region ?? (provider === 'minimax-portal-cn' ? 'cn' : 'global'))
      } else if (provider === 'qwen-portal') {
        await this.runQwenFlow()
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      mainLogger.error(`[device-oauth] Flow failed for ${provider}:`, message)
      this.emitToAll('oauth:error', { message })
    } finally {
      this.active = false
      this.activeProvider = null
    }

    return true
  }

  async stopFlow(): Promise<void> {
    this.active = false
    this.activeProvider = null
    this.activeAccountId = null
    this.activeLabel = null
  }

  private async runMiniMaxFlow(provider: OAuthProviderType, region: MiniMaxRegion): Promise<void> {
    const token = await loginMiniMaxPortalOAuth({
      region,
      openUrl: async (url) => { await shell.openExternal(url) },
      note: async (message, title) => {
        this.emitToAll('oauth:code', {
          provider,
          message,
          title,
          ...this.extractCodeFromMessage(message),
        })
      },
      progress: {
        update: (msg) => mainLogger.info(`[device-oauth] ${msg}`),
        stop: (msg) => mainLogger.info(`[device-oauth] ${msg ?? 'Done'}`),
      },
    })

    await this.onSuccess(provider, {
      access: token.access,
      refresh: token.refresh,
      expires: token.expires,
      resourceUrl: token.resourceUrl,
    })
  }

  private async runQwenFlow(): Promise<void> {
    const token = await loginQwenPortalOAuth({
      openUrl: async (url) => { await shell.openExternal(url) },
      note: async (message, title) => {
        this.emitToAll('oauth:code', {
          provider: 'qwen-portal',
          message,
          title,
          ...this.extractCodeFromMessage(message),
        })
      },
      progress: {
        update: (msg) => mainLogger.info(`[device-oauth] ${msg}`),
        stop: (msg) => mainLogger.info(`[device-oauth] ${msg ?? 'Done'}`),
      },
    })

    await this.onSuccess('qwen-portal', {
      access: token.access,
      refresh: token.refresh,
      expires: token.expires,
      resourceUrl: token.resourceUrl,
    })
  }

  private async onSuccess(
    provider: OAuthProviderType,
    token: { access: string; refresh: string; expires: number; resourceUrl?: string },
  ): Promise<void> {
    const accountId = this.activeAccountId ?? provider
    const label = this.activeLabel ?? getProviderDefinition(provider)?.name ?? provider
    const definition = getProviderDefinition(provider)

    // Build the account
    const account: ProviderAccount = ProviderService.buildAccount({
      id: accountId,
      vendorId: provider,
      label,
      baseUrl: token.resourceUrl ?? definition?.providerConfig?.baseUrl,
      model: definition?.defaultModelId,
      api: definition?.providerConfig?.api,
      isDefault: false,
    })
    account.authMode = 'oauth_device'
    if (token.resourceUrl) {
      account.metadata = { ...account.metadata, resourceUrl: token.resourceUrl }
    }

    // Save account + secret
    const service = getProviderService()
    await service.createAccount(account)
    await setProviderSecret({
      type: 'oauth',
      accountId,
      accessToken: token.access,
      refreshToken: token.refresh,
      expiresAt: token.expires,
    })

    mainLogger.info(`[device-oauth] Successfully created account "${accountId}" for ${provider}`)
    this.emitToAll('oauth:success', { provider, accountId })
  }

  private extractCodeFromMessage(message: string): { verificationUri?: string; userCode?: string } {
    // Extract URL: "Open <url> to authorize"
    const urlMatch = message.match(/Open\s+(https?:\/\/\S+)\s+to/i)
    const verificationUri = urlMatch?.[1]

    // Extract code: "Code: <code>"
    const codeMatch = message.match(/Code:\s+(\S+)/i)
    const userCode = codeMatch?.[1]

    return { verificationUri, userCode }
  }

  private emitToAll(event: string, data: unknown): void {
    this.emit(event, data)
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(event, data)
    }
  }
}

export const deviceOAuthManager = new DeviceOAuthManager()
