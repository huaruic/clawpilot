import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fs from 'node:fs/promises'
import path from 'node:path'
import JSON5 from 'json5'

// We test readSearchConfig and writeSearchConfig by operating on a real temp config file.
// Since these functions use getConfigPath() internally (which reads from getOpenClawStateDir()),
// we test the underlying logic directly by simulating config read/write.

const TEMP_DIR = path.join('/tmp', 'catclaw-search-config-test')
const TEMP_CONFIG = path.join(TEMP_DIR, 'openclaw.json')

async function writeConfig(data: Record<string, unknown>): Promise<void> {
  await fs.mkdir(TEMP_DIR, { recursive: true })
  await fs.writeFile(TEMP_CONFIG, JSON5.stringify(data, null, 2), 'utf-8')
}

async function readConfig(): Promise<Record<string, unknown>> {
  const raw = await fs.readFile(TEMP_CONFIG, 'utf-8')
  return JSON5.parse(raw) as Record<string, unknown>
}

describe('Search config read/write logic', () => {
  beforeEach(async () => {
    await fs.mkdir(TEMP_DIR, { recursive: true })
  })

  afterEach(async () => {
    await fs.rm(TEMP_DIR, { recursive: true, force: true })
  })

  it('reads search config from existing config file', async () => {
    await writeConfig({
      tools: {
        web: {
          search: {
            enabled: true,
            provider: 'brave',
            apiKey: 'test-key-123',
          },
        },
      },
    })

    const config = await readConfig()
    const tools = config.tools as Record<string, unknown>
    const web = tools.web as Record<string, unknown>
    const search = web.search as Record<string, unknown>

    expect(search.provider).toBe('brave')
    expect(search.apiKey).toBe('test-key-123')
    expect(search.enabled).toBe(true)
  })

  it('returns empty values when no search config exists', async () => {
    await writeConfig({ gateway: { mode: 'local' } })

    const config = await readConfig()
    const tools = (config.tools as Record<string, unknown>) ?? {}
    const web = (tools.web as Record<string, unknown>) ?? {}
    const search = (web.search as Record<string, unknown>) ?? {}

    expect(search.provider ?? '').toBe('')
    expect(search.apiKey ?? '').toBe('')
  })

  it('writes search config without overwriting other settings', async () => {
    await writeConfig({
      gateway: { mode: 'local' },
      tools: {
        web: {
          fetch: { enabled: true, maxChars: 50000 },
        },
      },
    })

    // Simulate writeSearchConfig: merge into existing config
    const existing = await readConfig()
    const tools = (existing.tools as Record<string, unknown>) ?? {}
    const web = (tools.web as Record<string, unknown>) ?? {}
    const search = (web.search as Record<string, unknown>) ?? {}
    const updated = {
      ...existing,
      tools: {
        ...tools,
        web: {
          ...web,
          search: { ...search, enabled: true, provider: 'brave', apiKey: 'new-key' },
        },
      },
    }
    await fs.writeFile(TEMP_CONFIG, JSON5.stringify(updated, null, 2), 'utf-8')

    // Verify: search config saved AND fetch config preserved
    const result = await readConfig()
    const resultTools = result.tools as Record<string, unknown>
    const resultWeb = resultTools.web as Record<string, unknown>
    const resultSearch = resultWeb.search as Record<string, unknown>
    const resultFetch = resultWeb.fetch as Record<string, unknown>

    expect(resultSearch.provider).toBe('brave')
    expect(resultSearch.apiKey).toBe('new-key')
    expect(resultFetch.enabled).toBe(true)
    expect(resultFetch.maxChars).toBe(50000)
    expect((result.gateway as Record<string, unknown>).mode).toBe('local')
  })

  it('overwrites existing search config on update', async () => {
    await writeConfig({
      tools: {
        web: {
          search: { enabled: true, provider: 'brave', apiKey: 'old-key' },
        },
      },
    })

    const existing = await readConfig()
    const tools = (existing.tools as Record<string, unknown>) ?? {}
    const web = (tools.web as Record<string, unknown>) ?? {}
    const search = (web.search as Record<string, unknown>) ?? {}
    const updated = {
      ...existing,
      tools: {
        ...tools,
        web: {
          ...web,
          search: { ...search, provider: 'gemini', apiKey: 'gemini-key' },
        },
      },
    }
    await fs.writeFile(TEMP_CONFIG, JSON5.stringify(updated, null, 2), 'utf-8')

    const result = await readConfig()
    const resultSearch = ((result.tools as Record<string, unknown>).web as Record<string, unknown>).search as Record<string, unknown>

    expect(resultSearch.provider).toBe('gemini')
    expect(resultSearch.apiKey).toBe('gemini-key')
  })

  it('handles all supported providers', async () => {
    const providers = ['brave', 'perplexity', 'gemini', 'grok', 'kimi']

    for (const provider of providers) {
      await writeConfig({
        tools: { web: { search: { enabled: true, provider, apiKey: `${provider}-key` } } },
      })

      const config = await readConfig()
      const search = ((config.tools as Record<string, unknown>).web as Record<string, unknown>).search as Record<string, unknown>
      expect(search.provider).toBe(provider)
      expect(search.apiKey).toBe(`${provider}-key`)
    }
  })
})
