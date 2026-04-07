import type { ProviderAccount, ProviderConfig, ProviderType } from '../../shared/providers/types'
import { getProviderDefinition } from '../../shared/providers/registry'
import { getProviderStore } from './ProviderStoreInstance'

const PROVIDER_STORE_SCHEMA_VERSION = 1

function inferAuthMode(type: ProviderType): ProviderAccount['authMode'] {
  const definition = getProviderDefinition(type)
  if (definition?.defaultAuthMode) {
    return definition.defaultAuthMode
  }

  return 'api_key'
}

export function providerConfigToAccount(
  config: ProviderConfig,
  options?: { isDefault?: boolean },
): ProviderAccount {
  return {
    id: config.id,
    vendorId: config.type,
    label: config.name,
    authMode: inferAuthMode(config.type),
    baseUrl: config.baseUrl,
    apiProtocol: config.apiProtocol || (config.type === 'custom'
      ? 'openai-completions'
      : getProviderDefinition(config.type)?.providerConfig?.api),
    headers: config.headers,
    model: config.model,
    fallbackModels: config.fallbackModels,
    fallbackAccountIds: config.fallbackProviderIds,
    enabled: config.enabled,
    isDefault: options?.isDefault ?? false,
    createdAt: config.createdAt,
    updatedAt: config.updatedAt,
  }
}

export function providerAccountToConfig(account: ProviderAccount): ProviderConfig {
  return {
    id: account.id,
    name: account.label,
    type: account.vendorId,
    baseUrl: account.baseUrl,
    apiProtocol: account.apiProtocol,
    headers: account.headers,
    model: account.model,
    fallbackModels: account.fallbackModels,
    fallbackProviderIds: account.fallbackAccountIds,
    enabled: account.enabled,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  }
}

export async function listProviderAccounts(): Promise<ProviderAccount[]> {
  const store = await getProviderStore()
  const accounts = store.get('providerAccounts') as Record<string, ProviderAccount> | undefined
  return Object.values(accounts ?? {})
}

export async function getProviderAccount(accountId: string): Promise<ProviderAccount | null> {
  const store = await getProviderStore()
  const accounts = store.get('providerAccounts') as Record<string, ProviderAccount> | undefined
  return accounts?.[accountId] ?? null
}

export async function saveProviderAccount(account: ProviderAccount): Promise<void> {
  const store = await getProviderStore()
  const accounts = (store.get('providerAccounts') ?? {}) as Record<string, ProviderAccount>
  accounts[account.id] = account
  store.set('providerAccounts', accounts)
  store.set('schemaVersion', PROVIDER_STORE_SCHEMA_VERSION)
}

export async function deleteProviderAccount(accountId: string): Promise<void> {
  const store = await getProviderStore()
  const accounts = (store.get('providerAccounts') ?? {}) as Record<string, ProviderAccount>
  delete accounts[accountId]
  store.set('providerAccounts', accounts)

  if (store.get('defaultProviderAccountId') === accountId) {
    store.delete('defaultProviderAccountId')
  }
}

export async function setDefaultProviderAccount(accountId: string): Promise<void> {
  const store = await getProviderStore()
  store.set('defaultProviderAccountId', accountId)

  const accounts = (store.get('providerAccounts') ?? {}) as Record<string, ProviderAccount>
  for (const account of Object.values(accounts)) {
    account.isDefault = account.id === accountId
  }
  store.set('providerAccounts', accounts)
}

export async function getDefaultProviderAccountId(): Promise<string | undefined> {
  const store = await getProviderStore()
  return store.get('defaultProviderAccountId') as string | undefined
}

export async function getSchemaVersion(): Promise<number> {
  const store = await getProviderStore()
  return (store.get('schemaVersion') as number) ?? 0
}

export async function setSchemaVersion(version: number): Promise<void> {
  const store = await getProviderStore()
  store.set('schemaVersion', version)
}
