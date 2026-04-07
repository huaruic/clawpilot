import {
  PROVIDER_DEFINITIONS,
  getProviderDefinition,
} from '../../shared/providers/registry'
import type {
  ProviderAccount,
  ProviderDefinition,
  ProviderType,
} from '../../shared/providers/types'
import {
  deleteProviderAccount,
  getDefaultProviderAccountId,
  getProviderAccount,
  listProviderAccounts,
  saveProviderAccount,
  setDefaultProviderAccount,
} from './ProviderStore'
import {
  deleteProviderSecret,
  getProviderSecret,
  setProviderSecret,
} from './SecretStore'
import { mainLogger } from '../utils/logger'

function maskApiKey(apiKey: string | null): string | null {
  if (!apiKey) return null
  if (apiKey.length > 12) {
    return `${apiKey.substring(0, 4)}${'*'.repeat(apiKey.length - 8)}${apiKey.substring(apiKey.length - 4)}`
  }
  return '*'.repeat(apiKey.length)
}

export class ProviderService {
  async listVendors(): Promise<ProviderDefinition[]> {
    return PROVIDER_DEFINITIONS
  }

  async listAccounts(): Promise<ProviderAccount[]> {
    return listProviderAccounts()
  }

  async getAccount(accountId: string): Promise<ProviderAccount | null> {
    return getProviderAccount(accountId)
  }

  async getDefaultAccountId(): Promise<string | undefined> {
    return getDefaultProviderAccountId()
  }

  async createAccount(account: ProviderAccount, apiKey?: string): Promise<ProviderAccount> {
    await saveProviderAccount(account)

    if (apiKey !== undefined && apiKey.trim()) {
      await setProviderSecret({
        type: 'api_key',
        accountId: account.id,
        apiKey: apiKey.trim(),
      })
    }

    // Auto-set as default if no default exists
    const currentDefault = await getDefaultProviderAccountId()
    if (!currentDefault) {
      await setDefaultProviderAccount(account.id)
      mainLogger.info(`[provider-service] Auto-set "${account.id}" as default (first provider)`)
    }

    return (await getProviderAccount(account.id)) ?? account
  }

  async updateAccount(
    accountId: string,
    patch: Partial<ProviderAccount>,
    apiKey?: string,
  ): Promise<ProviderAccount> {
    const existing = await getProviderAccount(accountId)
    if (!existing) {
      throw new Error('Provider account not found')
    }

    const nextAccount: ProviderAccount = {
      ...existing,
      ...patch,
      id: accountId,
      updatedAt: patch.updatedAt ?? new Date().toISOString(),
    }

    await saveProviderAccount(nextAccount)

    if (apiKey !== undefined) {
      const trimmedKey = apiKey.trim()
      if (trimmedKey) {
        await setProviderSecret({
          type: 'api_key',
          accountId,
          apiKey: trimmedKey,
        })
      } else {
        await deleteProviderSecret(accountId)
      }
    }

    return (await getProviderAccount(accountId)) ?? nextAccount
  }

  async deleteAccount(accountId: string): Promise<boolean> {
    const account = await getProviderAccount(accountId)
    if (!account) {
      return false
    }

    await deleteProviderSecret(accountId)
    await deleteProviderAccount(accountId)

    mainLogger.info(`[provider-service] Deleted account "${accountId}" (vendor: ${account.vendorId})`)
    return true
  }

  async setDefaultAccount(accountId: string): Promise<void> {
    await setDefaultProviderAccount(accountId)
  }

  async getAccountApiKey(accountId: string): Promise<string | null> {
    const secret = await getProviderSecret(accountId)
    if (!secret) return null

    if (secret.type === 'api_key') return secret.apiKey
    if (secret.type === 'oauth') return secret.accessToken

    return null
  }

  async getAccountKeyMasked(accountId: string): Promise<string | null> {
    const key = await this.getAccountApiKey(accountId)
    return maskApiKey(key)
  }

  async hasAccountKey(accountId: string): Promise<boolean> {
    const secret = await getProviderSecret(accountId)
    return secret !== null
  }

  getVendorDefinition(vendorId: string): ProviderDefinition | undefined {
    return getProviderDefinition(vendorId)
  }

  /**
   * Build a ProviderAccount from minimal info (used by migration and Ollama integration).
   */
  static buildAccount(params: {
    id: string
    vendorId: ProviderType
    label: string
    baseUrl?: string
    model?: string
    api?: string
    isDefault?: boolean
  }): ProviderAccount {
    const definition = getProviderDefinition(params.vendorId)
    const now = new Date().toISOString()

    return {
      id: params.id,
      vendorId: params.vendorId,
      label: params.label,
      authMode: definition?.defaultAuthMode ?? 'api_key',
      baseUrl: params.baseUrl,
      apiProtocol: (params.api as ProviderAccount['apiProtocol']) ?? definition?.providerConfig?.api,
      model: params.model ?? definition?.defaultModelId,
      enabled: true,
      isDefault: params.isDefault ?? false,
      createdAt: now,
      updatedAt: now,
    }
  }
}

const providerService = new ProviderService()

export function getProviderService(): ProviderService {
  return providerService
}
