import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createFakeRoutingConfig, createFakeRoutingProfile } from './fixtures'

// ── Mocks (hoisted) ─────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  readRoutingConfig: vi.fn(),
  writeRoutingConfig: vi.fn(),
  syncRoutingToGatewayFormat: vi.fn(),
  readDefaultModel: vi.fn(),
  getOpenClawStateDir: vi.fn(() => '/fake/state'),
  getDefaultOpenClawWorkspaceRoot: vi.fn(() => '/fake/workspace'),
  syncAllProvidersToRuntime: vi.fn(),
}))

vi.mock('../services/OpenClawConfigWriter', () => ({
  readRoutingConfig: mocks.readRoutingConfig,
  writeRoutingConfig: mocks.writeRoutingConfig,
  syncRoutingToGatewayFormat: mocks.syncRoutingToGatewayFormat,
  readDefaultModel: mocks.readDefaultModel,
}))

vi.mock('../services/RuntimeLocator', () => ({
  getOpenClawStateDir: mocks.getOpenClawStateDir,
  getDefaultOpenClawWorkspaceRoot: mocks.getDefaultOpenClawWorkspaceRoot,
}))

vi.mock('../services/ProviderRuntimeSync', () => ({
  syncAllProvidersToRuntime: mocks.syncAllProvidersToRuntime,
}))

vi.mock('../utils/logger', () => ({
  mainLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('node:fs/promises', () => ({
  default: {
    mkdir: vi.fn(),
    access: vi.fn().mockRejectedValue(new Error('ENOENT')),
    copyFile: vi.fn(),
    rm: vi.fn(),
    stat: vi.fn().mockRejectedValue(new Error('ENOENT')),
  },
}))

// ── Import after mocks ──────────────────────────────────────────

import {
  listProfiles,
  createProfile,
  updateProfile,
  deleteProfile,
  setRoute,
  clearRoute,
  getRoute,
  resolveModelRef,
  clearAllRoutesForChannel,
} from '../services/RoutingService'

// ── Helpers ─────────────────────────────────────────────────────

function setupEmptyConfig() {
  mocks.readRoutingConfig.mockResolvedValue(createFakeRoutingConfig())
  mocks.writeRoutingConfig.mockResolvedValue(undefined)
  mocks.syncRoutingToGatewayFormat.mockResolvedValue(undefined)
  mocks.readDefaultModel.mockResolvedValue(null)
  mocks.syncAllProvidersToRuntime.mockResolvedValue(undefined)
}

function setupConfigWith(
  profiles: Record<string, unknown>,
  routes: unknown[] = [],
  globalModel: string | null = null,
) {
  mocks.readRoutingConfig.mockResolvedValue(createFakeRoutingConfig(profiles, routes))
  mocks.writeRoutingConfig.mockResolvedValue(undefined)
  mocks.syncRoutingToGatewayFormat.mockResolvedValue(undefined)
  mocks.readDefaultModel.mockResolvedValue(globalModel)
  mocks.syncAllProvidersToRuntime.mockResolvedValue(undefined)
}

// ── Tests ───────────────────────────────────────────────────────

describe('RoutingService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── listProfiles ────────────────────────────────────────────

  describe('listProfiles', () => {
    it('returns implicit default profile when config is empty', async () => {
      setupEmptyConfig()
      const snap = await listProfiles()
      expect(snap.profiles).toHaveLength(1)
      expect(snap.profiles[0].id).toBe('default')
      expect(snap.profiles[0].name).toBe('Default')
      expect(snap.defaultProfileId).toBe('default')
    })

    it('returns stored profiles alongside default', async () => {
      setupConfigWith({
        'support-bot': {
          name: 'Support Bot',
          modelRef: 'openai/gpt-4o',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      })
      const snap = await listProfiles()
      expect(snap.profiles).toHaveLength(2)
      const ids = snap.profiles.map((p) => p.id)
      expect(ids).toContain('default')
      expect(ids).toContain('support-bot')
    })

    it('includes globalModelRef', async () => {
      setupConfigWith({}, [], 'anthropic/claude-opus-4-6')
      const snap = await listProfiles()
      expect(snap.globalModelRef).toBe('anthropic/claude-opus-4-6')
    })

    it('parses stored routes', async () => {
      setupConfigWith(
        {},
        [{ channelType: 'telegram', accountId: 'main', profileId: 'default' }],
      )
      const snap = await listProfiles()
      expect(snap.routes).toHaveLength(1)
      expect(snap.routes[0].channelType).toBe('telegram')
    })
  })

  // ── createProfile ───────────────────────────────────────────

  describe('createProfile', () => {
    it('generates slug from name', async () => {
      setupEmptyConfig()
      const profile = await createProfile({ name: 'Customer Support' })
      expect(profile.id).toBe('customer-support')
      expect(profile.name).toBe('Customer Support')
    })

    it('deduplicates slug with numeric suffix', async () => {
      setupConfigWith({
        'my-bot': { name: 'My Bot', createdAt: '', updatedAt: '' },
      })
      const profile = await createProfile({ name: 'My Bot' })
      expect(profile.id).toBe('my-bot-2')
    })

    it('falls back to "profile" when name slugifies to "default"', async () => {
      setupEmptyConfig()
      const profile = await createProfile({ name: 'default' })
      expect(profile.id).toBe('profile')
    })

    it('sets modelRef from input', async () => {
      setupEmptyConfig()
      const profile = await createProfile({
        name: 'Test',
        modelRef: 'openai/gpt-4o',
      })
      expect(profile.modelRef).toBe('openai/gpt-4o')
    })

    it('sets modelRef to null when not provided', async () => {
      setupEmptyConfig()
      const profile = await createProfile({ name: 'Test' })
      expect(profile.modelRef).toBeNull()
    })

    it('writes to config and syncs gateway', async () => {
      setupEmptyConfig()
      await createProfile({ name: 'Test' })
      expect(mocks.writeRoutingConfig).toHaveBeenCalledTimes(1)
      expect(mocks.syncRoutingToGatewayFormat).toHaveBeenCalledTimes(1)
    })

    it('syncs provider credentials after creation', async () => {
      setupEmptyConfig()
      await createProfile({ name: 'Test' })
      expect(mocks.syncAllProvidersToRuntime).toHaveBeenCalledTimes(1)
    })

    it('binds channels when channelBindings provided', async () => {
      setupEmptyConfig()
      await createProfile({
        name: 'Test',
        channelBindings: [{ channelType: 'telegram', accountId: 'main' }],
      })
      const writeCall = mocks.writeRoutingConfig.mock.calls[0][0]
      expect(writeCall.routes).toHaveLength(1)
      expect(writeCall.routes[0].channelType).toBe('telegram')
      expect(writeCall.routes[0].profileId).toBe('test')
    })

    it('replaces existing route for same channel+account', async () => {
      setupConfigWith(
        {},
        [{ channelType: 'telegram', accountId: 'main', profileId: 'old-bot' }],
      )
      await createProfile({
        name: 'New Bot',
        channelBindings: [{ channelType: 'telegram', accountId: 'main' }],
      })
      const writeCall = mocks.writeRoutingConfig.mock.calls[0][0]
      const telegramRoutes = writeCall.routes.filter(
        (r: { channelType: string }) => r.channelType === 'telegram',
      )
      expect(telegramRoutes).toHaveLength(1)
      expect(telegramRoutes[0].profileId).toBe('new-bot')
    })
  })

  // ── updateProfile ───────────────────────────────────────────

  describe('updateProfile', () => {
    it('updates default profile (loadState auto-creates it)', async () => {
      setupEmptyConfig()
      const updated = await updateProfile('default', { name: 'My Default' })
      expect(updated.name).toBe('My Default')
    })

    it('throws for nonexistent profile', async () => {
      setupEmptyConfig()
      await expect(
        updateProfile('nonexistent', { name: 'x' }),
      ).rejects.toThrow('Profile "nonexistent" not found')
    })

    it('merges partial input (name only)', async () => {
      setupConfigWith({
        'test': { name: 'Old Name', modelRef: 'openai/gpt-4o', createdAt: '', updatedAt: '' },
      })
      const updated = await updateProfile('test', { name: 'New Name' })
      expect(updated.name).toBe('New Name')
      expect(updated.modelRef).toBe('openai/gpt-4o') // preserved
    })

    it('merges partial input (modelRef only)', async () => {
      setupConfigWith({
        'test': { name: 'Test', modelRef: 'openai/gpt-4o', createdAt: '', updatedAt: '' },
      })
      const updated = await updateProfile('test', { modelRef: 'anthropic/claude-opus-4-6' })
      expect(updated.modelRef).toBe('anthropic/claude-opus-4-6')
      expect(updated.name).toBe('Test') // preserved
    })

    it('clears modelRef when set to empty string', async () => {
      setupConfigWith({
        'test': { name: 'Test', modelRef: 'openai/gpt-4o', createdAt: '', updatedAt: '' },
      })
      const updated = await updateProfile('test', { modelRef: '' })
      expect(updated.modelRef).toBeNull()
    })
  })

  // ── deleteProfile ───────────────────────────────────────────

  describe('deleteProfile', () => {
    it('throws when deleting default', async () => {
      await expect(deleteProfile('default')).rejects.toThrow(
        'Cannot delete the default profile',
      )
    })

    it('throws for nonexistent profile', async () => {
      setupEmptyConfig()
      await expect(deleteProfile('ghost')).rejects.toThrow(
        'Profile "ghost" not found',
      )
    })

    it('removes profile and cascading routes', async () => {
      setupConfigWith(
        {
          'bot-a': { name: 'Bot A', createdAt: '', updatedAt: '' },
        },
        [
          { channelType: 'telegram', accountId: 'main', profileId: 'bot-a' },
          { channelType: 'discord', accountId: 'main', profileId: 'default' },
        ],
      )
      await deleteProfile('bot-a')
      const writeCall = mocks.writeRoutingConfig.mock.calls[0][0]
      expect(writeCall.profiles['bot-a']).toBeUndefined()
      expect(writeCall.routes).toHaveLength(1)
      expect(writeCall.routes[0].profileId).toBe('default')
    })
  })

  // ── setRoute / clearRoute / getRoute ────────────────────────

  describe('setRoute', () => {
    it('adds a new route', async () => {
      setupEmptyConfig()
      await setRoute('telegram', 'main', 'default')
      const writeCall = mocks.writeRoutingConfig.mock.calls[0][0]
      expect(writeCall.routes).toHaveLength(1)
      expect(writeCall.routes[0]).toEqual({
        channelType: 'telegram',
        accountId: 'main',
        profileId: 'default',
      })
    })

    it('replaces existing route for same channel+account', async () => {
      setupConfigWith(
        { 'bot-a': { name: 'Bot A', createdAt: '', updatedAt: '' } },
        [{ channelType: 'telegram', accountId: 'main', profileId: 'default' }],
      )
      await setRoute('telegram', 'main', 'bot-a')
      const writeCall = mocks.writeRoutingConfig.mock.calls[0][0]
      const telegramRoutes = writeCall.routes.filter(
        (r: { channelType: string }) => r.channelType === 'telegram',
      )
      expect(telegramRoutes).toHaveLength(1)
      expect(telegramRoutes[0].profileId).toBe('bot-a')
    })

    it('throws for nonexistent profile', async () => {
      setupEmptyConfig()
      await expect(setRoute('telegram', 'main', 'ghost')).rejects.toThrow(
        'Profile "ghost" not found',
      )
    })
  })

  describe('clearRoute', () => {
    it('removes matching route', async () => {
      setupConfigWith(
        {},
        [
          { channelType: 'telegram', accountId: 'main', profileId: 'default' },
          { channelType: 'discord', accountId: 'main', profileId: 'default' },
        ],
      )
      await clearRoute('telegram', 'main')
      const writeCall = mocks.writeRoutingConfig.mock.calls[0][0]
      expect(writeCall.routes).toHaveLength(1)
      expect(writeCall.routes[0].channelType).toBe('discord')
    })

    it('does nothing when route does not exist', async () => {
      setupEmptyConfig()
      await clearRoute('telegram', 'main')
      expect(mocks.writeRoutingConfig).not.toHaveBeenCalled()
    })
  })

  describe('clearAllRoutesForChannel', () => {
    it('removes all routes for a channel type', async () => {
      setupConfigWith(
        {},
        [
          { channelType: 'telegram', accountId: 'main', profileId: 'default' },
          { channelType: 'telegram', accountId: 'bot2', profileId: 'default' },
          { channelType: 'discord', accountId: 'main', profileId: 'default' },
        ],
      )
      await clearAllRoutesForChannel('telegram')
      const writeCall = mocks.writeRoutingConfig.mock.calls[0][0]
      expect(writeCall.routes).toHaveLength(1)
      expect(writeCall.routes[0].channelType).toBe('discord')
    })
  })

  describe('getRoute', () => {
    it('returns matching route', async () => {
      setupConfigWith(
        {},
        [{ channelType: 'telegram', accountId: 'main', profileId: 'default' }],
      )
      const route = await getRoute('telegram', 'main')
      expect(route).toEqual({
        channelType: 'telegram',
        accountId: 'main',
        profileId: 'default',
      })
    })

    it('returns null when no match', async () => {
      setupEmptyConfig()
      const route = await getRoute('telegram', 'main')
      expect(route).toBeNull()
    })
  })

  // ── resolveModelRef ─────────────────────────────────────────

  describe('resolveModelRef', () => {
    it('returns profile modelRef for exact route match', async () => {
      setupConfigWith(
        { 'bot': { name: 'Bot', modelRef: 'openai/gpt-4o', createdAt: '', updatedAt: '' } },
        [{ channelType: 'telegram', accountId: 'main', profileId: 'bot' }],
      )
      const ref = await resolveModelRef('telegram', 'main')
      expect(ref).toBe('openai/gpt-4o')
    })

    it('falls back to global default when profile has no modelRef', async () => {
      setupConfigWith(
        {},
        [{ channelType: 'telegram', accountId: 'main', profileId: 'default' }],
        'anthropic/claude-opus-4-6',
      )
      const ref = await resolveModelRef('telegram', 'main')
      expect(ref).toBe('anthropic/claude-opus-4-6')
    })

    it('returns null when nothing is configured', async () => {
      setupEmptyConfig()
      const ref = await resolveModelRef('telegram', 'main')
      expect(ref).toBeNull()
    })
  })
})
