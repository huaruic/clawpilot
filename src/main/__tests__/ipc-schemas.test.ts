/**
 * IPC Schema contract tests — ensure renderer ↔ main data contracts stay valid.
 * These tests validate Zod schemas accept good input and reject bad input.
 */
import { describe, it, expect } from 'vitest'
import {
  CreateProfileSchema,
  UpdateProfileSchema,
  DeleteProfileSchema,
  SetRouteSchema,
  ClearRouteSchema,
} from '../ipc/schemas/routing.schema'
import {
  CreateAccountSchema,
  UpdateAccountSchema,
  DeleteAccountSchema,
  SetDefaultAccountSchema,
  ValidateKeySchema,
} from '../ipc/schemas/provider.schema'
import {
  SaveChannelConfigSchema,
  ChannelTypeSchema,
  ValidateChannelCredentialsSchema,
} from '../ipc/schemas/channels.schema'

// ── Routing Schemas ─────────────────────────────────────────────

describe('Routing Schemas', () => {
  describe('CreateProfileSchema', () => {
    it('accepts valid input', () => {
      const result = CreateProfileSchema.safeParse({
        name: 'Support Bot',
        modelRef: 'openai/gpt-4o',
        inheritWorkspace: true,
      })
      expect(result.success).toBe(true)
    })

    it('accepts with channelBindings', () => {
      const result = CreateProfileSchema.safeParse({
        name: 'Bot',
        channelBindings: [{ channelType: 'telegram', accountId: 'main' }],
      })
      expect(result.success).toBe(true)
    })

    it('rejects empty name', () => {
      const result = CreateProfileSchema.safeParse({ name: '' })
      expect(result.success).toBe(false)
    })

    it('rejects invalid modelRef format', () => {
      const result = CreateProfileSchema.safeParse({
        name: 'Bot',
        modelRef: 'no-slash',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('UpdateProfileSchema', () => {
    it('accepts partial update (name only)', () => {
      const result = UpdateProfileSchema.safeParse({
        id: 'default',
        name: 'New Name',
      })
      expect(result.success).toBe(true)
    })

    it('accepts null modelRef (clear override)', () => {
      const result = UpdateProfileSchema.safeParse({
        id: 'bot',
        modelRef: null,
      })
      expect(result.success).toBe(true)
    })

    it('rejects missing id', () => {
      const result = UpdateProfileSchema.safeParse({ name: 'x' })
      expect(result.success).toBe(false)
    })
  })

  describe('DeleteProfileSchema', () => {
    it('accepts valid id', () => {
      expect(DeleteProfileSchema.safeParse({ id: 'bot' }).success).toBe(true)
    })

    it('rejects empty id', () => {
      expect(DeleteProfileSchema.safeParse({ id: '' }).success).toBe(false)
    })
  })

  describe('SetRouteSchema', () => {
    it('requires all 3 fields', () => {
      expect(SetRouteSchema.safeParse({
        channelType: 'telegram',
        accountId: 'main',
        profileId: 'bot',
      }).success).toBe(true)

      expect(SetRouteSchema.safeParse({
        channelType: 'telegram',
        accountId: 'main',
      }).success).toBe(false)
    })
  })

  describe('ClearRouteSchema', () => {
    it('requires channelType and accountId', () => {
      expect(ClearRouteSchema.safeParse({
        channelType: 'telegram',
        accountId: 'main',
      }).success).toBe(true)

      expect(ClearRouteSchema.safeParse({
        channelType: 'telegram',
      }).success).toBe(false)
    })
  })
})

// ── Provider Schemas ────────────────────────────────────────────

describe('Provider Schemas', () => {
  describe('CreateAccountSchema', () => {
    it('accepts valid account', () => {
      const result = CreateAccountSchema.safeParse({
        account: {
          id: 'my-openai',
          vendorId: 'openai',
          label: 'My OpenAI',
          authMode: 'api_key',
        },
        apiKey: 'sk-test',
      })
      expect(result.success).toBe(true)
    })

    it('rejects invalid authMode', () => {
      const result = CreateAccountSchema.safeParse({
        account: {
          id: 'x',
          vendorId: 'openai',
          label: 'X',
          authMode: 'password',
        },
      })
      expect(result.success).toBe(false)
    })

    it('accepts optional apiProtocol', () => {
      const result = CreateAccountSchema.safeParse({
        account: {
          id: 'x',
          vendorId: 'custom',
          label: 'Custom',
          authMode: 'api_key',
          apiProtocol: 'openai-responses',
        },
      })
      expect(result.success).toBe(true)
    })
  })

  describe('UpdateAccountSchema', () => {
    it('accepts partial updates', () => {
      const result = UpdateAccountSchema.safeParse({
        accountId: 'my-openai',
        updates: { label: 'Renamed' },
      })
      expect(result.success).toBe(true)
    })

    it('rejects empty accountId', () => {
      const result = UpdateAccountSchema.safeParse({
        accountId: '',
        updates: {},
      })
      expect(result.success).toBe(false)
    })
  })

  describe('DeleteAccountSchema / SetDefaultAccountSchema', () => {
    it('accepts valid accountId', () => {
      expect(DeleteAccountSchema.safeParse({ accountId: 'x' }).success).toBe(true)
      expect(SetDefaultAccountSchema.safeParse({ accountId: 'x' }).success).toBe(true)
    })

    it('rejects empty accountId', () => {
      expect(DeleteAccountSchema.safeParse({ accountId: '' }).success).toBe(false)
    })
  })

  describe('ValidateKeySchema', () => {
    it('accepts valid input', () => {
      const result = ValidateKeySchema.safeParse({
        providerType: 'openai',
        apiKey: 'sk-test',
        baseUrl: 'https://api.openai.com/v1',
      })
      expect(result.success).toBe(true)
    })

    it('rejects missing providerType', () => {
      const result = ValidateKeySchema.safeParse({
        apiKey: 'sk-test',
      })
      expect(result.success).toBe(false)
    })
  })
})

// ── Channel Schemas ─────────────────────────────────────────────

describe('Channel Schemas', () => {
  describe('SaveChannelConfigSchema', () => {
    it('accepts valid config', () => {
      const result = SaveChannelConfigSchema.safeParse({
        channelType: 'telegram',
        values: { botToken: '123:ABC' },
      })
      expect(result.success).toBe(true)
    })

    it('rejects empty channelType', () => {
      const result = SaveChannelConfigSchema.safeParse({
        channelType: '',
        values: {},
      })
      expect(result.success).toBe(false)
    })
  })

  describe('ChannelTypeSchema', () => {
    it('accepts valid channelType', () => {
      expect(ChannelTypeSchema.safeParse({ channelType: 'discord' }).success).toBe(true)
    })
  })

  describe('ValidateChannelCredentialsSchema', () => {
    it('accepts valid input', () => {
      const result = ValidateChannelCredentialsSchema.safeParse({
        channelType: 'feishu',
        values: { appId: 'cli_xxx', appSecret: 'secret' },
      })
      expect(result.success).toBe(true)
    })
  })
})
