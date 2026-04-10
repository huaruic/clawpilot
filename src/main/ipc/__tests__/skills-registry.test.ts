import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SkillRegistryClient } from '../../services/SkillRegistryClient'

const VALID_REGISTRY = {
  version: 1,
  updatedAt: '2026-04-10T00:00:00Z',
  skills: [
    {
      skillKey: 'web-scraper',
      name: 'Web Scraper',
      icon: 'globe',
      category: 'data',
      description: 'Scrape data from websites',
      tags: ['scraping'],
      risk: 'Low',
      files: ['SKILL.md'],
      downloadUrl: 'https://raw.githubusercontent.com/test/skills/main/skills/web-scraper/',
    },
    {
      skillKey: 'summarizer',
      name: 'Summarizer',
      icon: 'file-text',
      category: 'tools',
      description: 'Summarize long text',
      tags: ['summary'],
      risk: 'Low',
      files: ['SKILL.md'],
      downloadUrl: 'https://raw.githubusercontent.com/test/skills/main/skills/summarizer/',
    },
  ],
}

describe('SkillRegistryClient', () => {
  let client: SkillRegistryClient

  beforeEach(() => {
    client = new SkillRegistryClient('https://example.com/registry.json')
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('fetches and returns skill list on success', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(VALID_REGISTRY), { status: 200 }),
    )

    const result = await client.fetchRegistry()

    expect(result.skills).toHaveLength(2)
    expect(result.skills[0].skillKey).toBe('web-scraper')
    expect(result.skills[1].skillKey).toBe('summarizer')
    expect(result.error).toBeUndefined()
  })

  it('returns empty list with error on network failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'))

    const result = await client.fetchRegistry()

    expect(result.skills).toHaveLength(0)
    expect(result.error).toContain('Network error')
  })

  it('uses cache on second call within TTL', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(VALID_REGISTRY), { status: 200 }),
    )

    await client.fetchRegistry()
    await client.fetchRegistry()

    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('returns empty list on invalid JSON', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('not json {{{', { status: 200 }),
    )

    const result = await client.fetchRegistry()

    expect(result.skills).toHaveLength(0)
    expect(result.error).toBeDefined()
  })

  it('filters out entries missing required fields', async () => {
    const registryWithInvalid = {
      ...VALID_REGISTRY,
      skills: [
        ...VALID_REGISTRY.skills,
        { skillKey: 'incomplete' },
        { name: 'no-key' },
      ],
    }
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(registryWithInvalid), { status: 200 }),
    )

    const result = await client.fetchRegistry()

    expect(result.skills).toHaveLength(2)
  })

  it('invalidates cache after calling invalidateCache', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(VALID_REGISTRY), { status: 200 }),
    )

    await client.fetchRegistry()
    client.invalidateCache()
    await client.fetchRegistry()

    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it('finds a skill by key', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(VALID_REGISTRY), { status: 200 }),
    )

    const skill = await client.findSkill('web-scraper')

    expect(skill).toBeDefined()
    expect(skill!.name).toBe('Web Scraper')
  })

  it('returns undefined for unknown skill key', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(VALID_REGISTRY), { status: 200 }),
    )

    const skill = await client.findSkill('nonexistent')

    expect(skill).toBeUndefined()
  })
})
