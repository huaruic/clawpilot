import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createFakeProviderAccount } from './fixtures'

// ── Mocks ────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  listProviderAccounts: vi.fn(),
  getProviderSecret: vi.fn(),
  writeOpenClawConfig: vi.fn(),
  writeDefaultModel: vi.fn(),
  readRoutingConfig: vi.fn(),
  syncRoutingToGatewayFormat: vi.fn(),
  syncManagedAuthProfiles: vi.fn(),
}))

vi.mock('../services/ProviderStore', () => ({
  listProviderAccounts: mocks.listProviderAccounts,
}))

vi.mock('../services/SecretStore', () => ({
  getProviderSecret: mocks.getProviderSecret,
}))

vi.mock('../services/OpenClawConfigWriter', () => ({
  writeOpenClawConfig: mocks.writeOpenClawConfig,
  writeDefaultModel: mocks.writeDefaultModel,
  readRoutingConfig: mocks.readRoutingConfig,
  syncRoutingToGatewayFormat: mocks.syncRoutingToGatewayFormat,
}))

vi.mock('../services/OpenClawAuthProfileWriter', () => ({
  syncManagedAuthProfiles: mocks.syncManagedAuthProfiles,
}))

vi.mock('../../shared/providers/registry', () => ({
  getProviderDefinition: vi.fn(() => null),
  getProviderBackendConfig: vi.fn((type: string) => {
    if (type === 'openai') return { baseUrl: 'https://api.openai.com/v1', api: 'openai-completions' }
    if (type === 'anthropic') return { baseUrl: 'https://api.anthropic.com/v1', api: 'anthropic-messages' }
    return null
  }),
}))

vi.mock('../utils/logger', () => ({
  mainLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import {
  getOpenClawProviderKey,
  syncAllProvidersToRuntime,
  syncSavedProviderToRuntime,
  syncDeletedProviderToRuntime,
  syncRoutingProfilesAfterProviderChange,
} from '../services/ProviderRuntimeSync'

describe('ProviderRuntimeSync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.writeOpenClawConfig.mockResolvedValue(undefined)
    mocks.writeDefaultModel.mockResolvedValue(undefined)
    mocks.syncManagedAuthProfiles.mockResolvedValue(undefined)
    mocks.readRoutingConfig.mockResolvedValue({ profiles: {}, routes: [] })
    mocks.syncRoutingToGatewayFormat.mockResolvedValue(undefined)
  })

  // ── getOpenClawProviderKey ────────────────────────────────────

  describe('getOpenClawProviderKey', () => {
    it('returns vendorId for standard providers', () => {
      expect(getOpenClawProviderKey({ vendorId: 'openai', id: 'my-openai' })).toBe('openai')
      expect(getOpenClawProviderKey({ vendorId: 'anthropic', id: 'my-anthropic' })).toBe('anthropic')
    })

    it('returns "minimax-portal" for minimax-portal-cn', () => {
      expect(getOpenClawProviderKey({ vendorId: 'minimax-portal-cn', id: 'mm' })).toBe('minimax-portal')
    })

    it('returns custom-XXXXXXXX for custom providers', () => {
      const key = getOpenClawProviderKey({ vendorId: 'custom', id: 'my-custom-provider' })
      expect(key).toMatch(/^custom-[a-z0-9]{8}$/)
    })

    it('preserves existing custom-XXXXXXXX ids', () => {
      const key = getOpenClawProviderKey({ vendorId: 'custom', id: 'custom-abcd1234' })
      expect(key).toBe('custom-abcd1234')
    })

    it('returns openai-codex for openai oauth', () => {
      expect(getOpenClawProviderKey({ vendorId: 'openai', id: 'x', authMode: 'oauth_browser' })).toBe('openai-codex')
    })

    it('returns google-gemini-cli for google oauth', () => {
      expect(getOpenClawProviderKey({ vendorId: 'google', id: 'x', authMode: 'oauth_browser' })).toBe('google-gemini-cli')
    })
  })

  // ── syncAllProvidersToRuntime ─────────────────────────────────

  describe('syncAllProvidersToRuntime', () => {
    it('skips disabled accounts', async () => {
      mocks.listProviderAccounts.mockResolvedValue([
        createFakeProviderAccount({ id: 'enabled', enabled: true }),
        createFakeProviderAccount({ id: 'disabled', enabled: false }),
      ])
      mocks.getProviderSecret.mockResolvedValue({
        type: 'api_key', accountId: 'enabled', apiKey: 'sk-test',
      })

      await syncAllProvidersToRuntime()

      const entries = mocks.writeOpenClawConfig.mock.calls[0][0]
      expect(entries).toHaveLength(1)
      expect(entries[0].name).toBe('openai') // default vendorId from fixture
    })

    it('passes OAuth credentials to syncManagedAuthProfiles', async () => {
      mocks.listProviderAccounts.mockResolvedValue([
        createFakeProviderAccount({ id: 'google-acct', vendorId: 'google', authMode: 'oauth_browser' }),
      ])
      mocks.getProviderSecret.mockResolvedValue({
        type: 'oauth',
        accountId: 'google-acct',
        accessToken: 'ya29.token',
        refreshToken: 'rt',
        expiresAt: Date.now() + 3600000,
        email: 'test@gmail.com',
      })

      await syncAllProvidersToRuntime()

      expect(mocks.syncManagedAuthProfiles).toHaveBeenCalledTimes(1)
      const creds = mocks.syncManagedAuthProfiles.mock.calls[0][0]
      expect(creds).toHaveLength(1)
      expect(creds[0].oauth).toBeDefined()
      expect(creds[0].oauth.access).toBe('ya29.token')
    })

    it('writes api_key credentials', async () => {
      mocks.listProviderAccounts.mockResolvedValue([
        createFakeProviderAccount({ id: 'openai-1' }),
      ])
      mocks.getProviderSecret.mockResolvedValue({
        type: 'api_key', accountId: 'openai-1', apiKey: 'sk-my-key',
      })

      await syncAllProvidersToRuntime()

      const creds = mocks.syncManagedAuthProfiles.mock.calls[0][0]
      expect(creds[0].apiKey).toBe('sk-my-key')
    })
  })

  // ── syncSavedProviderToRuntime ────────────────────────────────

  describe('syncSavedProviderToRuntime', () => {
    it('auto-starts gateway when STOPPED and setup complete', async () => {
      mocks.listProviderAccounts.mockResolvedValue([])
      const startFn = vi.fn().mockResolvedValue(undefined)
      const deps = {
        processManager: { start: startFn },
        state: {
          snapshot: {
            status: 'STOPPED',
            setup: { hasProvider: true, hasDefaultModel: true },
          },
        },
        refreshSetup: vi.fn().mockResolvedValue(undefined),
      }

      await syncSavedProviderToRuntime(
        createFakeProviderAccount(),
        'sk-key',
        deps as any,
      )

      expect(startFn).toHaveBeenCalled()
    })

    it('does NOT auto-start when setup incomplete', async () => {
      mocks.listProviderAccounts.mockResolvedValue([])
      const startFn = vi.fn()
      const deps = {
        processManager: { start: startFn },
        state: {
          snapshot: {
            status: 'STOPPED',
            setup: { hasProvider: true, hasDefaultModel: false },
          },
        },
        refreshSetup: vi.fn().mockResolvedValue(undefined),
      }

      await syncSavedProviderToRuntime(
        createFakeProviderAccount(),
        undefined,
        deps as any,
      )

      expect(startFn).not.toHaveBeenCalled()
    })
  })

  // ── syncRoutingProfilesAfterProviderChange ────────────────────

  describe('syncRoutingProfilesAfterProviderChange', () => {
    it('reads routing config and re-syncs to gateway format', async () => {
      mocks.readRoutingConfig.mockResolvedValue({
        profiles: {
          default: { name: 'Default', modelRef: null },
          bot: { name: 'Bot', modelRef: 'openai/gpt-4o' },
        },
        routes: [
          { channelType: 'telegram', accountId: 'main', profileId: 'bot' },
        ],
      })

      await syncRoutingProfilesAfterProviderChange()

      expect(mocks.syncRoutingToGatewayFormat).toHaveBeenCalledTimes(1)
      const [profiles, routes] = mocks.syncRoutingToGatewayFormat.mock.calls[0]
      expect(profiles).toHaveLength(2)
      expect(routes).toHaveLength(1)
    })

    it('handles empty routing config gracefully', async () => {
      mocks.readRoutingConfig.mockResolvedValue({})

      await syncRoutingProfilesAfterProviderChange()

      expect(mocks.syncRoutingToGatewayFormat).toHaveBeenCalledWith([], [])
    })
  })
})
