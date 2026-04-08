import { describe, it, expect, vi, beforeEach } from 'vitest'
import JSON5 from 'json5'

// ── Mocks ────────────────────────────────────────────────────────

const writtenFiles = new Map<string, string>()

vi.mock('node:fs/promises', () => ({
  default: {
    readFile: vi.fn(),
    writeFile: vi.fn(async (p: string, content: string) => {
      writtenFiles.set(p, content)
    }),
    mkdir: vi.fn(),
    rm: vi.fn(),
  },
}))

vi.mock('../services/RuntimeLocator', () => ({
  getOpenClawStateDir: vi.fn(() => '/fake/state'),
}))

vi.mock('../services/RoutingService', () => ({
  clearAllRoutesForChannel: vi.fn(),
}))

import fs from 'node:fs/promises'
import {
  loadChannelConfig,
  saveChannelConfig,
  deleteChannelConfig,
  listConfiguredChannels,
} from '../services/ChannelConfigService'

function setupConfig(config: Record<string, unknown>) {
  vi.mocked(fs.readFile).mockResolvedValue(JSON5.stringify(config) as any)
}

describe('ChannelConfigService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    writtenFiles.clear()
  })

  // ── loadChannelConfig ───────────────────────────────────────

  describe('loadChannelConfig', () => {
    it('extracts Discord config fields', async () => {
      setupConfig({
        channels: {
          discord: {
            enabled: true,
            defaultAccount: 'main',
            accounts: {
              main: {
                token: 'bot-token-123',
                guilds: [{ id: 'guild-1', channels: [{ id: 'ch-1' }] }],
              },
            },
          },
        },
      })

      const config = await loadChannelConfig('discord')
      expect(config.enabled).toBe(true)
      expect(config.values.token).toBe('bot-token-123')
      expect(config.values.guildId).toBe('guild-1')
      expect(config.values.channelId).toBe('ch-1')
    })

    it('extracts Telegram config fields', async () => {
      setupConfig({
        channels: {
          telegram: {
            enabled: true,
            defaultAccount: 'main',
            accounts: {
              main: {
                botToken: '123456:ABC-DEF',
                allowFrom: ['user1', 'user2'],
              },
            },
          },
        },
      })

      const config = await loadChannelConfig('telegram')
      expect(config.values.botToken).toBe('123456:ABC-DEF')
      expect(config.values.allowedUsers).toBe('user1, user2')
    })

    it('maps wechat to openclaw-weixin stored type', async () => {
      setupConfig({
        channels: {
          'openclaw-weixin': {
            enabled: true,
            defaultAccount: 'main',
            accounts: { main: {} },
          },
        },
      })

      const config = await loadChannelConfig('wechat')
      expect(config.channelType).toBe('wechat')
      expect(config.enabled).toBe(true)
    })

    it('returns empty values when channel not configured', async () => {
      setupConfig({})
      const config = await loadChannelConfig('telegram')
      expect(config.enabled).toBe(false)
      expect(config.values).toEqual({})
    })
  })

  // ── saveChannelConfig ───────────────────────────────────────

  describe('saveChannelConfig', () => {
    it('transforms Discord values with guild structure', async () => {
      setupConfig({})

      await saveChannelConfig('discord', {
        token: 'bot-token',
        guildId: 'g1',
        channelId: 'c1',
      })

      const written = writtenFiles.get('/fake/state/openclaw.json')
      const parsed = JSON5.parse(written!)
      const account = parsed.channels.discord.accounts.main
      expect(account.token).toBe('bot-token')
      expect(account.guilds[0].id).toBe('g1')
      expect(account.guilds[0].channels[0].id).toBe('c1')
    })

    it('adds channel to plugins.allow list', async () => {
      setupConfig({})

      await saveChannelConfig('telegram', { botToken: '123:ABC' })

      const written = writtenFiles.get('/fake/state/openclaw.json')
      const parsed = JSON5.parse(written!)
      expect(parsed.plugins.allow).toContain('telegram')
    })
  })

  // ── deleteChannelConfig ─────────────────────────────────────

  describe('deleteChannelConfig', () => {
    it('removes channel section and clears routes', async () => {
      setupConfig({
        channels: { telegram: { enabled: true } },
        plugins: { allow: ['telegram'] },
      })

      await deleteChannelConfig('telegram')

      const written = writtenFiles.get('/fake/state/openclaw.json')
      const parsed = JSON5.parse(written!)
      expect(parsed.channels.telegram).toBeUndefined()
    })

    it('removes from plugins.allow', async () => {
      setupConfig({
        channels: { discord: { enabled: true } },
        plugins: { allow: ['discord', 'telegram'] },
      })

      await deleteChannelConfig('discord')

      const written = writtenFiles.get('/fake/state/openclaw.json')
      const parsed = JSON5.parse(written!)
      expect(parsed.plugins.allow).not.toContain('discord')
      expect(parsed.plugins.allow).toContain('telegram')
    })
  })

  // ── listConfiguredChannels ──────────────────────────────────

  describe('listConfiguredChannels', () => {
    it('lists all configured channels with correct UI types', async () => {
      setupConfig({
        channels: {
          telegram: { enabled: true },
          discord: { enabled: false },
          'openclaw-weixin': { enabled: true },
        },
      })

      const channels = await listConfiguredChannels()
      expect(channels).toHaveLength(3)

      const types = channels.map((c) => c.type)
      expect(types).toContain('telegram')
      expect(types).toContain('discord')
      expect(types).toContain('wechat') // mapped from openclaw-weixin
    })
  })
})
