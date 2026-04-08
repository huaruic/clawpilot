import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createFakeStore, createFakeProviderAccount } from './fixtures'

// ── Mock ProviderStoreInstance ────────────────────────────────────

const fakeStore = createFakeStore()

vi.mock('../services/ProviderStoreInstance', () => ({
  getProviderStore: vi.fn(async () => fakeStore),
}))

vi.mock('../../shared/providers/registry', () => ({
  getProviderDefinition: vi.fn((id: string) => {
    if (id === 'openai') return { defaultAuthMode: 'api_key', providerConfig: { api: 'openai-completions' } }
    if (id === 'custom') return undefined
    return { defaultAuthMode: 'api_key' }
  }),
}))

import {
  listProviderAccounts,
  getProviderAccount,
  saveProviderAccount,
  deleteProviderAccount,
  setDefaultProviderAccount,
  getDefaultProviderAccountId,
  providerConfigToAccount,
  providerAccountToConfig,
} from '../services/ProviderStore'

describe('ProviderStore', () => {
  beforeEach(() => {
    fakeStore.store.clear()
  })

  describe('listProviderAccounts', () => {
    it('returns empty array when no accounts', async () => {
      const accounts = await listProviderAccounts()
      expect(accounts).toEqual([])
    })

    it('returns all stored accounts', async () => {
      const a = createFakeProviderAccount({ id: 'a' })
      const b = createFakeProviderAccount({ id: 'b' })
      fakeStore.set('providerAccounts', { a, b })

      const accounts = await listProviderAccounts()
      expect(accounts).toHaveLength(2)
    })
  })

  describe('getProviderAccount', () => {
    it('returns account by id', async () => {
      const a = createFakeProviderAccount({ id: 'a' })
      fakeStore.set('providerAccounts', { a })

      const result = await getProviderAccount('a')
      expect(result?.id).toBe('a')
    })

    it('returns null for missing account', async () => {
      const result = await getProviderAccount('missing')
      expect(result).toBeNull()
    })
  })

  describe('saveProviderAccount', () => {
    it('persists account by id', async () => {
      const a = createFakeProviderAccount({ id: 'new-account' })
      await saveProviderAccount(a)

      const stored = fakeStore.get('providerAccounts') as Record<string, unknown>
      expect(stored['new-account']).toBeDefined()
    })

    it('overwrites existing account', async () => {
      const a = createFakeProviderAccount({ id: 'x', label: 'Old' })
      fakeStore.set('providerAccounts', { x: a })

      const updated = createFakeProviderAccount({ id: 'x', label: 'New' })
      await saveProviderAccount(updated)

      const stored = fakeStore.get('providerAccounts') as Record<string, { label: string }>
      expect(stored['x'].label).toBe('New')
    })
  })

  describe('deleteProviderAccount', () => {
    it('removes account', async () => {
      const a = createFakeProviderAccount({ id: 'del-me' })
      fakeStore.set('providerAccounts', { 'del-me': a })

      await deleteProviderAccount('del-me')
      const stored = fakeStore.get('providerAccounts') as Record<string, unknown>
      expect(stored['del-me']).toBeUndefined()
    })

    it('clears defaultProviderAccountId if deleted account was default', async () => {
      const a = createFakeProviderAccount({ id: 'default-one' })
      fakeStore.set('providerAccounts', { 'default-one': a })
      fakeStore.set('defaultProviderAccountId', 'default-one')

      await deleteProviderAccount('default-one')
      expect(fakeStore.get('defaultProviderAccountId')).toBeUndefined()
    })

    it('keeps defaultProviderAccountId when deleting non-default', async () => {
      const a = createFakeProviderAccount({ id: 'a' })
      fakeStore.set('providerAccounts', { a })
      fakeStore.set('defaultProviderAccountId', 'other')

      await deleteProviderAccount('a')
      expect(fakeStore.get('defaultProviderAccountId')).toBe('other')
    })
  })

  describe('setDefaultProviderAccount', () => {
    it('updates defaultProviderAccountId', async () => {
      await setDefaultProviderAccount('my-account')
      expect(fakeStore.get('defaultProviderAccountId')).toBe('my-account')
    })

    it('sets isDefault flag on matching account, clears on others', async () => {
      const a = createFakeProviderAccount({ id: 'a', isDefault: true })
      const b = createFakeProviderAccount({ id: 'b', isDefault: false })
      fakeStore.set('providerAccounts', { a, b })

      await setDefaultProviderAccount('b')
      const stored = fakeStore.get('providerAccounts') as Record<string, { isDefault: boolean }>
      expect(stored['a'].isDefault).toBe(false)
      expect(stored['b'].isDefault).toBe(true)
    })
  })

  describe('getDefaultProviderAccountId', () => {
    it('returns stored id', async () => {
      fakeStore.set('defaultProviderAccountId', 'my-id')
      const id = await getDefaultProviderAccountId()
      expect(id).toBe('my-id')
    })

    it('returns undefined when not set', async () => {
      const id = await getDefaultProviderAccountId()
      expect(id).toBeUndefined()
    })
  })

  describe('providerConfigToAccount', () => {
    it('maps ProviderConfig fields correctly', () => {
      const account = providerConfigToAccount({
        id: 'cfg-1',
        name: 'My Provider',
        type: 'openai',
        enabled: true,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-02',
      })
      expect(account.id).toBe('cfg-1')
      expect(account.vendorId).toBe('openai')
      expect(account.label).toBe('My Provider')
      expect(account.authMode).toBe('api_key')
      expect(account.isDefault).toBe(false)
    })

    it('respects isDefault option', () => {
      const account = providerConfigToAccount(
        { id: 'x', name: 'X', type: 'openai', enabled: true, createdAt: '', updatedAt: '' },
        { isDefault: true },
      )
      expect(account.isDefault).toBe(true)
    })
  })

  describe('providerAccountToConfig', () => {
    it('maps ProviderAccount fields back', () => {
      const config = providerAccountToConfig(
        createFakeProviderAccount({
          id: 'a-1',
          label: 'My Account',
          vendorId: 'openai',
        }),
      )
      expect(config.id).toBe('a-1')
      expect(config.name).toBe('My Account')
      expect(config.type).toBe('openai')
    })
  })
})
