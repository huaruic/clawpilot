import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createFakeProviderAccount } from './fixtures'

// ── Mocks ────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  listProviderAccounts: vi.fn(),
  getProviderAccount: vi.fn(),
  saveProviderAccount: vi.fn(),
  deleteProviderAccount: vi.fn(),
  setDefaultProviderAccount: vi.fn(),
  getDefaultProviderAccountId: vi.fn(),
  getProviderSecret: vi.fn(),
  setProviderSecret: vi.fn(),
  deleteProviderSecret: vi.fn(),
}))

vi.mock('../services/ProviderStore', () => ({
  listProviderAccounts: mocks.listProviderAccounts,
  getProviderAccount: mocks.getProviderAccount,
  saveProviderAccount: mocks.saveProviderAccount,
  deleteProviderAccount: mocks.deleteProviderAccount,
  setDefaultProviderAccount: mocks.setDefaultProviderAccount,
  getDefaultProviderAccountId: mocks.getDefaultProviderAccountId,
}))

vi.mock('../services/SecretStore', () => ({
  getProviderSecret: mocks.getProviderSecret,
  setProviderSecret: mocks.setProviderSecret,
  deleteProviderSecret: mocks.deleteProviderSecret,
}))

vi.mock('../utils/logger', () => ({
  mainLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('../../shared/providers/registry', () => ({
  PROVIDER_DEFINITIONS: [],
  getProviderDefinition: vi.fn((id: string) => {
    if (id === 'openai') return { defaultAuthMode: 'api_key', defaultModelId: 'gpt-4o', providerConfig: { api: 'openai-completions' } }
    if (id === 'anthropic') return { defaultAuthMode: 'api_key', defaultModelId: 'claude-opus-4-6', providerConfig: { api: 'anthropic-messages' } }
    return undefined
  }),
}))

import { ProviderService } from '../services/ProviderService'

describe('ProviderService', () => {
  let service: ProviderService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new ProviderService()
    mocks.saveProviderAccount.mockResolvedValue(undefined)
    mocks.deleteProviderAccount.mockResolvedValue(undefined)
    mocks.setDefaultProviderAccount.mockResolvedValue(undefined)
    mocks.setProviderSecret.mockResolvedValue(undefined)
    mocks.deleteProviderSecret.mockResolvedValue(undefined)
  })

  // ── createAccount ───────────────────────────────────────────

  describe('createAccount', () => {
    it('saves account and secret', async () => {
      const account = createFakeProviderAccount()
      mocks.getDefaultProviderAccountId.mockResolvedValue('existing-default')
      mocks.getProviderAccount.mockResolvedValue(account)

      await service.createAccount(account, 'sk-test-key')
      expect(mocks.saveProviderAccount).toHaveBeenCalledWith(account)
      expect(mocks.setProviderSecret).toHaveBeenCalledWith({
        type: 'api_key',
        accountId: account.id,
        apiKey: 'sk-test-key',
      })
    })

    it('auto-sets default when no default exists', async () => {
      const account = createFakeProviderAccount()
      mocks.getDefaultProviderAccountId.mockResolvedValue(undefined)
      mocks.getProviderAccount.mockResolvedValue(account)

      await service.createAccount(account, 'sk-key')
      expect(mocks.setDefaultProviderAccount).toHaveBeenCalledWith(account.id)
    })

    it('does NOT auto-set default when one exists', async () => {
      const account = createFakeProviderAccount()
      mocks.getDefaultProviderAccountId.mockResolvedValue('other-account')
      mocks.getProviderAccount.mockResolvedValue(account)

      await service.createAccount(account, 'sk-key')
      expect(mocks.setDefaultProviderAccount).not.toHaveBeenCalled()
    })

    it('trims API key whitespace', async () => {
      const account = createFakeProviderAccount()
      mocks.getDefaultProviderAccountId.mockResolvedValue('x')
      mocks.getProviderAccount.mockResolvedValue(account)

      await service.createAccount(account, '  sk-with-spaces  ')
      expect(mocks.setProviderSecret).toHaveBeenCalledWith(
        expect.objectContaining({ apiKey: 'sk-with-spaces' }),
      )
    })

    it('skips secret when apiKey is empty', async () => {
      const account = createFakeProviderAccount()
      mocks.getDefaultProviderAccountId.mockResolvedValue('x')
      mocks.getProviderAccount.mockResolvedValue(account)

      await service.createAccount(account, '  ')
      expect(mocks.setProviderSecret).not.toHaveBeenCalled()
    })

    it('skips secret when apiKey is undefined', async () => {
      const account = createFakeProviderAccount()
      mocks.getDefaultProviderAccountId.mockResolvedValue('x')
      mocks.getProviderAccount.mockResolvedValue(account)

      await service.createAccount(account)
      expect(mocks.setProviderSecret).not.toHaveBeenCalled()
    })
  })

  // ── updateAccount ───────────────────────────────────────────

  describe('updateAccount', () => {
    it('throws for nonexistent account', async () => {
      mocks.getProviderAccount.mockResolvedValue(null)
      await expect(
        service.updateAccount('ghost', { label: 'x' }),
      ).rejects.toThrow('Provider account not found')
    })

    it('merges patch with existing account', async () => {
      const existing = createFakeProviderAccount({ label: 'Old' })
      mocks.getProviderAccount
        .mockResolvedValueOnce(existing) // first call: check existence
        .mockResolvedValueOnce({ ...existing, label: 'New' }) // second call: return updated

      const result = await service.updateAccount(existing.id, { label: 'New' })
      expect(result.label).toBe('New')
      expect(mocks.saveProviderAccount).toHaveBeenCalledWith(
        expect.objectContaining({ label: 'New', id: existing.id }),
      )
    })

    it('clears secret when apiKey is empty string', async () => {
      const existing = createFakeProviderAccount()
      mocks.getProviderAccount
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce(existing)

      await service.updateAccount(existing.id, {}, '')
      expect(mocks.deleteProviderSecret).toHaveBeenCalledWith(existing.id)
    })

    it('updates secret when apiKey provided', async () => {
      const existing = createFakeProviderAccount()
      mocks.getProviderAccount
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce(existing)

      await service.updateAccount(existing.id, {}, 'new-key')
      expect(mocks.setProviderSecret).toHaveBeenCalledWith({
        type: 'api_key',
        accountId: existing.id,
        apiKey: 'new-key',
      })
    })
  })

  // ── deleteAccount ───────────────────────────────────────────

  describe('deleteAccount', () => {
    it('deletes secret and account', async () => {
      const account = createFakeProviderAccount()
      mocks.getProviderAccount.mockResolvedValue(account)

      const result = await service.deleteAccount(account.id)
      expect(result).toBe(true)
      expect(mocks.deleteProviderSecret).toHaveBeenCalledWith(account.id)
      expect(mocks.deleteProviderAccount).toHaveBeenCalledWith(account.id)
    })

    it('returns false for nonexistent account', async () => {
      mocks.getProviderAccount.mockResolvedValue(null)
      const result = await service.deleteAccount('ghost')
      expect(result).toBe(false)
      expect(mocks.deleteProviderSecret).not.toHaveBeenCalled()
    })
  })

  // ── getAccountApiKey ────────────────────────────────────────

  describe('getAccountApiKey', () => {
    it('returns apiKey for api_key type', async () => {
      mocks.getProviderSecret.mockResolvedValue({
        type: 'api_key',
        accountId: 'x',
        apiKey: 'sk-test',
      })
      const key = await service.getAccountApiKey('x')
      expect(key).toBe('sk-test')
    })

    it('returns accessToken for oauth type', async () => {
      mocks.getProviderSecret.mockResolvedValue({
        type: 'oauth',
        accountId: 'x',
        accessToken: 'ya29.token',
        refreshToken: 'rt',
        expiresAt: 0,
      })
      const key = await service.getAccountApiKey('x')
      expect(key).toBe('ya29.token')
    })

    it('returns null when no secret', async () => {
      mocks.getProviderSecret.mockResolvedValue(null)
      const key = await service.getAccountApiKey('x')
      expect(key).toBeNull()
    })
  })

  // ── getAccountKeyMasked ─────────────────────────────────────

  describe('getAccountKeyMasked', () => {
    it('masks key (first 4 + last 4 visible)', async () => {
      mocks.getProviderSecret.mockResolvedValue({
        type: 'api_key',
        accountId: 'x',
        apiKey: 'sk-1234567890abcdef',
      })
      const masked = await service.getAccountKeyMasked('x')
      expect(masked).toMatch(/^sk-1.+cdef$/)
      expect(masked!.length).toBe('sk-1234567890abcdef'.length)
    })

    it('returns null when no key', async () => {
      mocks.getProviderSecret.mockResolvedValue(null)
      const masked = await service.getAccountKeyMasked('x')
      expect(masked).toBeNull()
    })
  })

  // ── buildAccount (static) ───────────────────────────────────

  describe('buildAccount', () => {
    it('builds account with defaults from vendor definition', () => {
      const account = ProviderService.buildAccount({
        id: 'my-openai',
        vendorId: 'openai',
        label: 'My OpenAI',
      })
      expect(account.id).toBe('my-openai')
      expect(account.vendorId).toBe('openai')
      expect(account.label).toBe('My OpenAI')
      expect(account.authMode).toBe('api_key')
      expect(account.model).toBe('gpt-4o')
      expect(account.enabled).toBe(true)
    })

    it('uses provided model over default', () => {
      const account = ProviderService.buildAccount({
        id: 'x',
        vendorId: 'openai',
        label: 'X',
        model: 'gpt-3.5-turbo',
      })
      expect(account.model).toBe('gpt-3.5-turbo')
    })
  })
})
