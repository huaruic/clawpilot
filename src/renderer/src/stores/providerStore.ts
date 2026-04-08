import { create } from 'zustand'
import type {
  ProviderAccount,
  ProviderDefinition,
  ProviderType,
} from '../../../shared/providers/types'

export interface OAuthFlowState {
  active: boolean
  provider: string | null
  verificationUri?: string
  userCode?: string
  message?: string
  error?: string
}

interface ProviderStore {
  accounts: ProviderAccount[]
  vendors: ProviderDefinition[]
  defaultAccountId: string | null
  loading: boolean
  oauthFlow: OAuthFlowState

  init: () => Promise<void>
  refresh: () => Promise<void>
  createAccount: (
    account: Omit<ProviderAccount, 'createdAt' | 'updatedAt'>,
    apiKey?: string,
  ) => Promise<ProviderAccount>
  updateAccount: (
    accountId: string,
    updates: Partial<ProviderAccount>,
    apiKey?: string,
  ) => Promise<ProviderAccount>
  removeAccount: (accountId: string) => Promise<void>
  setDefault: (accountId: string) => Promise<void>
  validateKey: (
    providerType: string,
    apiKey: string,
    options?: { baseUrl?: string; apiProtocol?: string },
  ) => Promise<{ valid: boolean; error?: string }>
  getAccountKey: (accountId: string) => Promise<string>
  hasAccountKey: (accountId: string) => Promise<boolean>
  startOAuth: (
    provider: string,
    options?: { region?: 'global' | 'cn'; accountId?: string; label?: string },
  ) => Promise<boolean>
  cancelOAuth: () => Promise<void>
}

export const useProviderStore = create<ProviderStore>((set, get) => {
  // Subscribe to OAuth events via the preload bridge
  if (typeof window !== 'undefined' && window.catclaw?.provider?.onOAuthEvent) {
    window.catclaw.provider.onOAuthEvent((event, raw) => {
      const data = raw as Record<string, unknown>
      switch (event) {
        case 'oauth:start':
          set({
            oauthFlow: {
              active: true,
              provider: data.provider as string,
            },
          })
          break
        case 'oauth:code':
          set({
            oauthFlow: {
              active: true,
              provider: data.provider as string,
              verificationUri: data.verificationUri as string | undefined,
              userCode: data.userCode as string | undefined,
              message: data.message as string | undefined,
            },
          })
          break
        case 'oauth:success':
          set({ oauthFlow: { active: false, provider: null } })
          void get().refresh()
          break
        case 'oauth:error':
          set({
            oauthFlow: {
              active: false,
              provider: null,
              error: (data.message as string) ?? 'OAuth failed',
            },
          })
          break
      }
    })
  }

  return {
    accounts: [],
    vendors: [],
    defaultAccountId: null,
    loading: false,
    oauthFlow: { active: false, provider: null },

    async init() {
      if (get().vendors.length > 0) return
      set({ loading: true })
      try {
        const [vendors, accounts, defaultId] = await Promise.all([
          window.catclaw.provider.listVendors(),
          window.catclaw.provider.listAccounts(),
          window.catclaw.provider.getDefaultAccount(),
        ])
        set({ vendors, accounts, defaultAccountId: defaultId, loading: false })
      } catch {
        set({ loading: false })
      }
    },

    async refresh() {
      try {
        const [accounts, defaultId] = await Promise.all([
          window.catclaw.provider.listAccounts(),
          window.catclaw.provider.getDefaultAccount(),
        ])
        set({ accounts, defaultAccountId: defaultId })
      } catch {
        // ignore
      }
    },

    async createAccount(account, apiKey) {
      const result = await window.catclaw.provider.createAccount({ account, apiKey })
      await get().refresh()
      return result.account
    },

    async updateAccount(accountId, updates, apiKey) {
      const result = await window.catclaw.provider.updateAccount({ accountId, updates, apiKey })
      await get().refresh()
      return result.account
    },

    async removeAccount(accountId) {
      await window.catclaw.provider.deleteAccount({ accountId })
      await get().refresh()
      // Auto-set default if only one account remains
      const { accounts, defaultAccountId } = get()
      if (accounts.length === 1 && defaultAccountId !== accounts[0].id) {
        await get().setDefault(accounts[0].id)
      }
    },

    async setDefault(accountId) {
      await window.catclaw.provider.setDefaultAccount({ accountId })
      set({ defaultAccountId: accountId })
    },

    async validateKey(providerType, apiKey, options) {
      return window.catclaw.provider.validate({
        providerType,
        apiKey,
        baseUrl: options?.baseUrl,
        apiProtocol: options?.apiProtocol,
      })
    },

    async getAccountKey(accountId) {
      return window.catclaw.provider.getAccountKey({ accountId })
    },

    async hasAccountKey(accountId) {
      return window.catclaw.provider.hasAccountKey({ accountId })
    },

    async startOAuth(provider, options) {
      set({ oauthFlow: { active: true, provider } })
      const result = await window.catclaw.provider.oauthStart({
        provider,
        region: options?.region,
        accountId: options?.accountId,
        label: options?.label,
      })
      if (!result.ok) {
        set({ oauthFlow: { active: false, provider: null, error: result.error } })
      }
      return result.ok
    },

    async cancelOAuth() {
      await window.catclaw.provider.oauthCancel()
      set({ oauthFlow: { active: false, provider: null } })
    },
  }
})

export function getVendorForAccount(
  vendors: ProviderDefinition[],
  account: ProviderAccount,
): ProviderDefinition | undefined {
  return vendors.find((v) => v.id === account.vendorId)
}

export function getUnconfiguredVendors(
  vendors: ProviderDefinition[],
  accounts: ProviderAccount[],
): ProviderDefinition[] {
  const configuredVendorIds = new Set(accounts.map((a) => a.vendorId))
  return vendors.filter((v) => v.id !== 'custom' && !configuredVendorIds.has(v.id as ProviderType))
}
