import { describe, it, expect, vi } from 'vitest'

// ── Mocks ────────────────────────────────────────────────────────

vi.mock('../services/FeishuService', () => ({
  validateFeishuCredentials: vi.fn().mockResolvedValue({ ok: true, botOpenId: 'bot-1', botName: 'TestBot' }),
}))

vi.mock('../../shared/types/channel', () => ({
  CHANNEL_META: {
    telegram: {
      configFields: [
        { key: 'botToken', label: 'Bot Token', required: true },
      ],
    },
    discord: {
      configFields: [
        { key: 'token', label: 'Bot Token', required: true },
      ],
    },
    feishu: {
      configFields: [
        { key: 'appId', label: 'App ID', required: true },
        { key: 'appSecret', label: 'App Secret', required: true },
      ],
    },
  },
}))

import { validateChannelCredentials } from '../services/ChannelValidationService'

describe('ChannelValidationService', () => {
  it('returns error for unknown channel type', async () => {
    const result = await validateChannelCredentials('nonexistent', {})
    expect(result.ok).toBe(false)
    expect(result.error).toContain('Unknown channel type')
  })

  it('returns error for missing required fields', async () => {
    const result = await validateChannelCredentials('telegram', {})
    expect(result.ok).toBe(false)
    expect(result.error).toContain('Missing required field')
  })

  it('validates telegram bot token format', async () => {
    const bad = await validateChannelCredentials('telegram', { botToken: 'invalid' })
    expect(bad.ok).toBe(false)
    expect(bad.error).toContain('Invalid bot token format')

    const good = await validateChannelCredentials('telegram', { botToken: '123456:ABC-DEF' })
    expect(good.ok).toBe(true)
  })

  it('validates discord token minimum length', async () => {
    const bad = await validateChannelCredentials('discord', { token: 'short' })
    expect(bad.ok).toBe(false)
    expect(bad.error).toContain('too short')

    const good = await validateChannelCredentials('discord', { token: 'a'.repeat(50) })
    expect(good.ok).toBe(true)
  })

  it('delegates feishu validation to FeishuService', async () => {
    const result = await validateChannelCredentials('feishu', {
      appId: 'cli_xxx',
      appSecret: 'secret',
    })
    expect(result.ok).toBe(true)
    expect(result.meta?.botName).toBe('TestBot')
  })
})
