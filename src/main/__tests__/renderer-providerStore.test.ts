import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock window.catclaw before importing store ───────────────────

const mockProvider = vi.hoisted(() => ({
  listVendors: vi.fn(),
  listAccounts: vi.fn(),
  getDefaultAccount: vi.fn(),
  createAccount: vi.fn(),
  updateAccount: vi.fn(),
  deleteAccount: vi.fn(),
  setDefaultAccount: vi.fn(),
  validate: vi.fn(),
  getAccountKey: vi.fn(),
  hasAccountKey: vi.fn(),
  oauthStart: vi.fn(),
  oauthCancel: vi.fn(),
  onOAuthEvent: vi.fn(),
}))

vi.stubGlobal('window', {
  catclaw: { provider: mockProvider },
})

import { useProviderStore, getVendorForAccount, getUnconfiguredVendors } from '../../renderer/src/stores/providerStore'
import type { ProviderAccount, ProviderDefinition } from '../../shared/providers/types'

const fakeVendor = (id: string): ProviderDefinition => ({
  id: id as any,
  name: id,
  icon: '',
  placeholder: '',
  requiresApiKey: true,
  category: 'official',
  supportedAuthModes: ['api_key'],
  defaultAuthMode: 'api_key',
  supportsMultipleAccounts: false,
})

const fakeAccount = (id: string, vendorId: string): ProviderAccount => ({
  id,
  vendorId: vendorId as any,
  label: id,
  authMode: 'api_key',
  enabled: true,
  isDefault: false,
  createdAt: '',
  updatedAt: '',
})

describe('providerStore (renderer)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useProviderStore.setState({
      accounts: [],
      vendors: [],
      defaultAccountId: null,
      loading: false,
      oauthFlow: { active: false, provider: null },
    })
  })

  it('init loads vendors, accounts, defaultAccountId', async () => {
    const vendors = [fakeVendor('openai')]
    const accounts = [fakeAccount('a1', 'openai')]
    mockProvider.listVendors.mockResolvedValue(vendors)
    mockProvider.listAccounts.mockResolvedValue(accounts)
    mockProvider.getDefaultAccount.mockResolvedValue('a1')

    await useProviderStore.getState().init()
    const state = useProviderStore.getState()

    expect(state.vendors).toEqual(vendors)
    expect(state.accounts).toEqual(accounts)
    expect(state.defaultAccountId).toBe('a1')
    expect(state.loading).toBe(false)
  })

  it('init is idempotent (skips if vendors already loaded)', async () => {
    useProviderStore.setState({ vendors: [fakeVendor('openai')] })

    await useProviderStore.getState().init()
    expect(mockProvider.listVendors).not.toHaveBeenCalled()
  })

  it('createAccount calls IPC and refreshes', async () => {
    const account = fakeAccount('new', 'openai')
    mockProvider.createAccount.mockResolvedValue({ account })
    mockProvider.listAccounts.mockResolvedValue([account])
    mockProvider.getDefaultAccount.mockResolvedValue('new')

    const result = await useProviderStore.getState().createAccount(account, 'sk-key')
    expect(result.id).toBe('new')
    expect(mockProvider.createAccount).toHaveBeenCalledWith({
      account, apiKey: 'sk-key',
    })
  })

  it('removeAccount auto-sets default when one account remains', async () => {
    const remaining = fakeAccount('only-one', 'openai')
    mockProvider.deleteAccount.mockResolvedValue(undefined)
    mockProvider.listAccounts.mockResolvedValue([remaining])
    mockProvider.getDefaultAccount.mockResolvedValue(null)
    mockProvider.setDefaultAccount.mockResolvedValue(undefined)

    useProviderStore.setState({ defaultAccountId: 'deleted-one' })
    await useProviderStore.getState().removeAccount('deleted-one')

    expect(mockProvider.setDefaultAccount).toHaveBeenCalledWith({ accountId: 'only-one' })
  })

  it('setDefault updates defaultAccountId in store immediately', async () => {
    mockProvider.setDefaultAccount.mockResolvedValue(undefined)

    await useProviderStore.getState().setDefault('my-account')
    expect(useProviderStore.getState().defaultAccountId).toBe('my-account')
  })

  it('startOAuth sets oauthFlow active', async () => {
    mockProvider.oauthStart.mockResolvedValue({ ok: true })

    await useProviderStore.getState().startOAuth('google')
    expect(mockProvider.oauthStart).toHaveBeenCalledWith({
      provider: 'google',
      region: undefined,
      accountId: undefined,
      label: undefined,
    })
  })

  it('startOAuth clears oauthFlow on error', async () => {
    mockProvider.oauthStart.mockResolvedValue({ ok: false, error: 'denied' })

    const result = await useProviderStore.getState().startOAuth('google')
    expect(result).toBe(false)
    expect(useProviderStore.getState().oauthFlow.active).toBe(false)
    expect(useProviderStore.getState().oauthFlow.error).toBe('denied')
  })
})

// ── Pure utility functions ────────────────────────────────────

describe('getVendorForAccount', () => {
  it('finds matching vendor', () => {
    const vendors = [fakeVendor('openai'), fakeVendor('anthropic')]
    const account = fakeAccount('a1', 'anthropic')
    expect(getVendorForAccount(vendors, account)?.id).toBe('anthropic')
  })

  it('returns undefined for unknown vendor', () => {
    const vendors = [fakeVendor('openai')]
    const account = fakeAccount('a1', 'custom')
    expect(getVendorForAccount(vendors, account)).toBeUndefined()
  })
})

describe('getUnconfiguredVendors', () => {
  it('excludes already-configured vendors', () => {
    const vendors = [fakeVendor('openai'), fakeVendor('anthropic'), fakeVendor('google')]
    const accounts = [fakeAccount('a1', 'openai')]
    const result = getUnconfiguredVendors(vendors, accounts)
    expect(result.map((v) => v.id)).toEqual(['anthropic', 'google'])
  })

  it('always excludes custom vendor', () => {
    const vendors = [fakeVendor('openai'), { ...fakeVendor('custom'), id: 'custom' as any }]
    const result = getUnconfiguredVendors(vendors, [])
    expect(result.map((v) => v.id)).toEqual(['openai'])
  })
})
