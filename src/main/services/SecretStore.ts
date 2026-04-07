import type { ProviderSecret } from '../../shared/providers/types'
import { getProviderStore } from './ProviderStoreInstance'

export interface SecretStore {
  get(accountId: string): Promise<ProviderSecret | null>
  set(secret: ProviderSecret): Promise<void>
  delete(accountId: string): Promise<void>
}

export class ElectronStoreSecretStore implements SecretStore {
  async get(accountId: string): Promise<ProviderSecret | null> {
    const store = await getProviderStore()
    const secrets = (store.get('providerSecrets') ?? {}) as Record<string, ProviderSecret>
    return secrets[accountId] ?? null
  }

  async set(secret: ProviderSecret): Promise<void> {
    const store = await getProviderStore()
    const secrets = (store.get('providerSecrets') ?? {}) as Record<string, ProviderSecret>
    secrets[secret.accountId] = secret
    store.set('providerSecrets', secrets)
  }

  async delete(accountId: string): Promise<void> {
    const store = await getProviderStore()
    const secrets = (store.get('providerSecrets') ?? {}) as Record<string, ProviderSecret>
    delete secrets[accountId]
    store.set('providerSecrets', secrets)
  }
}

const secretStore = new ElectronStoreSecretStore()

export function getSecretStore(): SecretStore {
  return secretStore
}

export async function getProviderSecret(accountId: string): Promise<ProviderSecret | null> {
  return getSecretStore().get(accountId)
}

export async function setProviderSecret(secret: ProviderSecret): Promise<void> {
  await getSecretStore().set(secret)
}

export async function deleteProviderSecret(accountId: string): Promise<void> {
  await getSecretStore().delete(accountId)
}
