import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ────────────────────────────────────────────────────────

vi.mock('../../shared/providers/registry', () => ({
  getProviderBackendConfig: vi.fn((type: string) => {
    const configs: Record<string, { baseUrl: string; api: string }> = {
      openai: { baseUrl: 'https://api.openai.com/v1', api: 'openai-completions' },
      anthropic: { baseUrl: 'https://api.anthropic.com/v1', api: 'anthropic-messages' },
      google: { baseUrl: 'https://generativelanguage.googleapis.com/v1beta', api: 'openai-completions' },
      openrouter: { baseUrl: 'https://openrouter.ai/api/v1', api: 'openai-completions' },
    }
    return configs[type] ?? null
  }),
}))

import { validateApiKeyWithProvider } from '../services/ProviderValidation'

describe('ProviderValidation', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns valid: true for ollama (profile: none)', async () => {
    const result = await validateApiKeyWithProvider('ollama', '')
    expect(result.valid).toBe(true)
  })

  it('returns error for empty key (non-ollama)', async () => {
    const result = await validateApiKeyWithProvider('openai', '')
    expect(result.valid).toBe(false)
    expect(result.error).toContain('API key is required')
  })

  it('returns error for whitespace-only key', async () => {
    const result = await validateApiKeyWithProvider('anthropic', '   ')
    expect(result.valid).toBe(false)
    expect(result.error).toContain('API key is required')
  })

  it('classifies 200 as valid (openai)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 200,
      json: async () => ({ data: [] }),
    }))
    const result = await validateApiKeyWithProvider('openai', 'sk-test', {
      baseUrl: 'https://api.openai.com/v1',
    })
    expect(result.valid).toBe(true)
  })

  it('classifies 429 as valid (rate limit means key works)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 429,
      json: async () => ({ error: { message: 'rate limited' } }),
    }))
    const result = await validateApiKeyWithProvider('openai', 'sk-test', {
      baseUrl: 'https://api.openai.com/v1',
    })
    expect(result.valid).toBe(true)
  })

  it('classifies 401 as invalid', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 401,
      json: async () => ({ error: { message: 'Invalid API key' } }),
    }))
    const result = await validateApiKeyWithProvider('openai', 'sk-bad', {
      baseUrl: 'https://api.openai.com/v1',
    })
    expect(result.valid).toBe(false)
    expect(result.error).toContain('Invalid API key')
  })

  it('classifies 403 as invalid', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 403,
      json: async () => ({}),
    }))
    const result = await validateApiKeyWithProvider('anthropic', 'sk-bad', {
      baseUrl: 'https://api.anthropic.com/v1',
    })
    expect(result.valid).toBe(false)
  })

  it('handles connection error gracefully', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')))
    const result = await validateApiKeyWithProvider('openai', 'sk-test', {
      baseUrl: 'https://api.openai.com/v1',
    })
    expect(result.valid).toBe(false)
    expect(result.error).toContain('Connection error')
  })
})
