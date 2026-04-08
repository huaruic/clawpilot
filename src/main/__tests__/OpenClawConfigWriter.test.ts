import { describe, it, expect, vi, beforeEach } from 'vitest'
import JSON5 from 'json5'

// ── Mocks ────────────────────────────────────────────────────────

const writtenFiles = new Map<string, string>()

const mocks = vi.hoisted(() => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
  access: vi.fn(),
}))

vi.mock('node:fs/promises', () => ({
  default: {
    readFile: mocks.readFile,
    writeFile: (...args: unknown[]) => {
      writtenFiles.set(args[0] as string, args[1] as string)
      return mocks.writeFile(...args)
    },
    mkdir: mocks.mkdir,
    access: mocks.access,
    rm: vi.fn(),
  },
}))

vi.mock('../services/RuntimeLocator', () => ({
  getOpenClawStateDir: vi.fn(() => '/fake/state'),
  getDefaultOpenClawWorkspaceRoot: vi.fn(() => '/fake/workspace'),
}))

import {
  readExistingConfig,
  writeOpenClawConfig,
  readRoutingConfig,
  writeRoutingConfig,
  syncRoutingToGatewayFormat,
  inspectOpenClawSetup,
  readDefaultModel,
} from '../services/OpenClawConfigWriter'

describe('OpenClawConfigWriter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    writtenFiles.clear()
    mocks.mkdir.mockResolvedValue(undefined)
    mocks.writeFile.mockResolvedValue(undefined)
  })

  // ── readExistingConfig ──────────────────────────────────────

  describe('readExistingConfig', () => {
    it('strips routing key from parsed config', async () => {
      mocks.readFile.mockResolvedValue(JSON5.stringify({
        gateway: { mode: 'local' },
        routing: { profiles: {}, routes: [] },
        models: { providers: {} },
      }))
      const config = await readExistingConfig()
      expect(config.routing).toBeUndefined()
      expect(config.gateway).toBeDefined()
    })

    it('returns empty object when file does not exist', async () => {
      mocks.readFile.mockRejectedValue(new Error('ENOENT'))
      const config = await readExistingConfig()
      expect(config).toEqual({})
    })
  })

  // ── writeOpenClawConfig ─────────────────────────────────────

  describe('writeOpenClawConfig', () => {
    it('merges providers into models.providers', async () => {
      mocks.readFile.mockResolvedValue(JSON5.stringify({ agents: { defaults: {} } }))

      await writeOpenClawConfig([
        { name: 'openai', baseUrl: 'https://api.openai.com/v1', apiKey: 'sk-x', api: 'openai-completions', models: [{ id: 'gpt-4o', name: 'GPT-4o' }] },
      ])

      const written = writtenFiles.get('/fake/state/openclaw.json')
      expect(written).toBeDefined()
      const parsed = JSON5.parse(written!)
      expect(parsed.models.providers.openai).toBeDefined()
      expect(parsed.models.providers.openai.baseUrl).toBe('https://api.openai.com/v1')
      expect(parsed.models.providers.openai.apiKey).toBe('sk-x')
    })

    it('preserves existing agents.defaults.workspace', async () => {
      mocks.readFile.mockResolvedValue(JSON5.stringify({
        agents: { defaults: { workspace: '/custom/workspace' } },
      }))

      await writeOpenClawConfig([])

      const written = writtenFiles.get('/fake/state/openclaw.json')
      const parsed = JSON5.parse(written!)
      expect(parsed.agents.defaults.workspace).toBe('/custom/workspace')
    })

    it('resolves default model from first provider', async () => {
      mocks.readFile.mockResolvedValue(JSON5.stringify({}))

      await writeOpenClawConfig([
        { name: 'anthropic', baseUrl: 'https://api.anthropic.com/v1', apiKey: 'sk-x', models: [{ id: 'claude-opus-4-6', name: 'Claude Opus' }] },
      ])

      const written = writtenFiles.get('/fake/state/openclaw.json')
      const parsed = JSON5.parse(written!)
      expect(parsed.agents.defaults.model.primary).toBe('anthropic/claude-opus-4-6')
    })

    it('keeps existing primary if still valid', async () => {
      mocks.readFile.mockResolvedValue(JSON5.stringify({
        agents: { defaults: { model: { primary: 'openai/gpt-4o' } } },
      }))

      await writeOpenClawConfig([
        { name: 'openai', baseUrl: 'https://api.openai.com/v1', apiKey: 'sk-x', models: [{ id: 'gpt-4o', name: 'GPT-4o' }] },
      ])

      const written = writtenFiles.get('/fake/state/openclaw.json')
      const parsed = JSON5.parse(written!)
      expect(parsed.agents.defaults.model.primary).toBe('openai/gpt-4o')
    })

    it('falls back to first provider when existing primary is no longer valid', async () => {
      mocks.readFile.mockResolvedValue(JSON5.stringify({
        agents: { defaults: { model: { primary: 'deleted-provider/model' } } },
      }))

      await writeOpenClawConfig([
        { name: 'anthropic', baseUrl: 'https://api.anthropic.com/v1', apiKey: 'sk-x', models: [{ id: 'claude-opus-4-6', name: 'Claude' }] },
      ])

      const written = writtenFiles.get('/fake/state/openclaw.json')
      const parsed = JSON5.parse(written!)
      expect(parsed.agents.defaults.model.primary).toBe('anthropic/claude-opus-4-6')
    })
  })

  // ── readRoutingConfig ───────────────────────────────────────

  describe('readRoutingConfig', () => {
    it('reads from dedicated routing.json', async () => {
      mocks.readFile.mockImplementation(async (p: string) => {
        if (p === '/fake/state/routing.json') {
          return JSON5.stringify({
            profiles: { default: { name: 'Default' } },
            routes: [{ channelType: 'telegram', accountId: 'main', profileId: 'default' }],
          })
        }
        throw new Error('ENOENT')
      })

      const config = await readRoutingConfig()
      expect(config.profiles).toBeDefined()
      expect(config.profiles!.default).toBeDefined()
      expect(config.routes).toHaveLength(1)
    })

    it('returns empty when no files exist', async () => {
      mocks.readFile.mockRejectedValue(new Error('ENOENT'))
      const config = await readRoutingConfig()
      expect(config.profiles).toEqual({})
      expect(config.routes).toEqual([])
    })
  })

  // ── writeRoutingConfig ──────────────────────────────────────

  describe('writeRoutingConfig', () => {
    it('writes to routing.json', async () => {
      await writeRoutingConfig({
        profiles: { bot: { name: 'Bot' } },
        routes: [{ channelType: 'telegram', accountId: 'main', profileId: 'bot' }],
      })

      const written = writtenFiles.get('/fake/state/routing.json')
      expect(written).toBeDefined()
      const parsed = JSON5.parse(written!)
      expect(parsed.profiles.bot).toBeDefined()
      expect(parsed.routes).toHaveLength(1)
    })
  })

  // ── syncRoutingToGatewayFormat ──────────────────────────────

  describe('syncRoutingToGatewayFormat', () => {
    it('builds agents.list from profiles', async () => {
      mocks.readFile.mockResolvedValue(JSON5.stringify({ agents: { defaults: {} } }))

      await syncRoutingToGatewayFormat(
        [
          { id: 'default', name: 'Default', modelRef: null },
          { id: 'bot', name: 'Bot', modelRef: 'openai/gpt-4o', workspacePath: '~/.openclaw/workspace-bot' },
        ],
        [],
      )

      const written = writtenFiles.get('/fake/state/openclaw.json')
      const parsed = JSON5.parse(written!)
      expect(parsed.agents.list).toHaveLength(2)
      expect(parsed.agents.list[0].id).toBe('default')
      expect(parsed.agents.list[0].default).toBe(true)
      expect(parsed.agents.list[1].model.primary).toBe('openai/gpt-4o')
    })

    it('builds bindings from non-default routes', async () => {
      mocks.readFile.mockResolvedValue(JSON5.stringify({ agents: { defaults: {} } }))

      await syncRoutingToGatewayFormat(
        [{ id: 'bot', name: 'Bot', modelRef: 'openai/gpt-4o' }],
        [
          { channelType: 'telegram', accountId: 'main', profileId: 'bot' },
          { channelType: 'discord', accountId: 'main', profileId: 'default' },
        ],
      )

      const written = writtenFiles.get('/fake/state/openclaw.json')
      const parsed = JSON5.parse(written!)
      // Only non-default routes become bindings
      expect(parsed.bindings).toHaveLength(1)
      expect(parsed.bindings[0].agentId).toBe('bot')
      expect(parsed.bindings[0].match.channel).toBe('telegram')
    })

    it('removes stale agents.list when no profiles', async () => {
      mocks.readFile.mockResolvedValue(JSON5.stringify({
        agents: { defaults: {}, list: [{ id: 'old' }] },
      }))

      await syncRoutingToGatewayFormat([], [])

      const written = writtenFiles.get('/fake/state/openclaw.json')
      const parsed = JSON5.parse(written!)
      expect(parsed.agents.list).toBeUndefined()
      expect(parsed.bindings).toBeUndefined()
    })
  })

  // ── readDefaultModel ────────────────────────────────────────

  describe('readDefaultModel', () => {
    it('reads model.primary from agents.defaults', async () => {
      mocks.readFile.mockResolvedValue(JSON5.stringify({
        agents: { defaults: { model: { primary: 'openai/gpt-4o' } } },
      }))
      const model = await readDefaultModel()
      expect(model).toBe('openai/gpt-4o')
    })

    it('returns empty string when not configured', async () => {
      mocks.readFile.mockRejectedValue(new Error('ENOENT'))
      const model = await readDefaultModel()
      expect(model).toBe('')
    })
  })

  // ── inspectOpenClawSetup ────────────────────────────────────

  describe('inspectOpenClawSetup', () => {
    it('returns gateway_setup when config does not exist', async () => {
      mocks.readFile.mockRejectedValue(new Error('ENOENT'))
      mocks.access.mockRejectedValue(new Error('ENOENT'))
      const setup = await inspectOpenClawSetup()
      expect(setup.phase).toBe('gateway_setup')
      expect(setup.blockingReason).toBe('missing_gateway_config')
    })

    it('returns model_setup when no provider', async () => {
      mocks.readFile.mockResolvedValue(JSON5.stringify({ agents: { defaults: {} } }))
      mocks.access.mockImplementation(async (p: string) => {
        if (p === '/fake/state/openclaw.json') return
        throw new Error('ENOENT')
      })
      const setup = await inspectOpenClawSetup()
      expect(setup.phase).toBe('model_setup')
      expect(setup.hasProvider).toBe(false)
    })

    it('returns ready when all configured', async () => {
      mocks.readFile.mockResolvedValue(JSON5.stringify({
        models: { providers: { openai: {} } },
        agents: { defaults: { model: { primary: 'openai/gpt-4o' } } },
      }))
      mocks.access.mockImplementation(async (p: string) => {
        if (p === '/fake/state/openclaw.json') return
        throw new Error('ENOENT') // no BOOTSTRAP.md
      })
      const setup = await inspectOpenClawSetup()
      expect(setup.phase).toBe('ready')
      expect(setup.hasProvider).toBe(true)
      expect(setup.hasDefaultModel).toBe(true)
    })
  })
})
