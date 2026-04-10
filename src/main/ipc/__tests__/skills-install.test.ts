import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs/promises'
import path from 'node:path'
import { SkillInstaller } from '../../services/SkillInstaller'
import type { SkillRegistryClient, RegistrySkill } from '../../services/SkillRegistryClient'

const MOCK_SKILL: RegistrySkill = {
  skillKey: 'test-skill',
  name: 'Test Skill',
  icon: 'zap',
  category: 'tools',
  description: 'A test skill',
  tags: ['test'],
  risk: 'Low',
  files: ['SKILL.md'],
  downloadUrl: 'https://example.com/skills/test-skill/',
}

const MOCK_SKILL_CONTENT = `---
name: test-skill
description: A test skill
---
# Test Skill
Do the thing.
`

function createMockRegistryClient(skills: RegistrySkill[] = [MOCK_SKILL]): SkillRegistryClient {
  return {
    fetchRegistry: vi.fn().mockResolvedValue({ skills }),
    findSkill: vi.fn().mockImplementation(async (key: string) => skills.find((s) => s.skillKey === key)),
    invalidateCache: vi.fn(),
  } as unknown as SkillRegistryClient
}

describe('SkillInstaller', () => {
  const managedDir = '/tmp/catclaw-test-skills'
  let installer: SkillInstaller
  let mockRegistry: SkillRegistryClient
  let mockWriteSkillEnabled: ReturnType<typeof vi.fn>
  let mockRestartRuntime: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    mockRegistry = createMockRegistryClient()
    mockWriteSkillEnabled = vi.fn().mockResolvedValue(undefined)
    mockRestartRuntime = vi.fn().mockResolvedValue(undefined)

    installer = new SkillInstaller({
      registryClient: mockRegistry,
      managedSkillsDir: managedDir,
      writeSkillEnabled: mockWriteSkillEnabled,
      restartRuntime: mockRestartRuntime,
    })

    await fs.mkdir(managedDir, { recursive: true })
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await fs.rm(managedDir, { recursive: true, force: true })
  })

  it('downloads skill files and writes to managed directory', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(MOCK_SKILL_CONTENT, { status: 200 }),
    )

    await installer.install('test-skill')

    const skillDir = path.join(managedDir, 'test-skill')
    const content = await fs.readFile(path.join(skillDir, 'SKILL.md'), 'utf-8')
    expect(content).toBe(MOCK_SKILL_CONTENT)
  })

  it('calls writeSkillEnabled after install', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(MOCK_SKILL_CONTENT, { status: 200 }),
    )

    await installer.install('test-skill')

    expect(mockWriteSkillEnabled).toHaveBeenCalledWith('test-skill', true)
  })

  it('calls restartRuntime after install', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(MOCK_SKILL_CONTENT, { status: 200 }),
    )

    await installer.install('test-skill')

    expect(mockRestartRuntime).toHaveBeenCalledOnce()
  })

  it('throws when skill key is not in registry', async () => {
    await expect(installer.install('nonexistent')).rejects.toThrow(
      'Skill "nonexistent" not found in registry',
    )
  })

  it('cleans up partial files on download failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Download failed'))

    await expect(installer.install('test-skill')).rejects.toThrow('Download failed')

    const skillDir = path.join(managedDir, 'test-skill')
    await expect(fs.access(skillDir)).rejects.toThrow()
  })

  it('overwrites existing skill on re-install', async () => {
    const skillDir = path.join(managedDir, 'test-skill')
    await fs.mkdir(skillDir, { recursive: true })
    await fs.writeFile(path.join(skillDir, 'SKILL.md'), 'old content')

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(MOCK_SKILL_CONTENT, { status: 200 }),
    )

    await installer.install('test-skill')

    const content = await fs.readFile(path.join(skillDir, 'SKILL.md'), 'utf-8')
    expect(content).toBe(MOCK_SKILL_CONTENT)
  })

  it('creates managed directory if it does not exist', async () => {
    await fs.rm(managedDir, { recursive: true, force: true })

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(MOCK_SKILL_CONTENT, { status: 200 }),
    )

    await installer.install('test-skill')

    const content = await fs.readFile(path.join(managedDir, 'test-skill', 'SKILL.md'), 'utf-8')
    expect(content).toBe(MOCK_SKILL_CONTENT)
  })

  it('downloads multiple files when specified', async () => {
    const multiFileSkill: RegistrySkill = {
      ...MOCK_SKILL,
      files: ['SKILL.md', 'reference.md'],
    }
    const multiRegistry = createMockRegistryClient([multiFileSkill])
    const multiInstaller = new SkillInstaller({
      registryClient: multiRegistry,
      managedSkillsDir: managedDir,
      writeSkillEnabled: mockWriteSkillEnabled,
      restartRuntime: mockRestartRuntime,
    })

    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(MOCK_SKILL_CONTENT, { status: 200 }))
      .mockResolvedValueOnce(new Response('# Reference\nExtra info', { status: 200 }))

    await multiInstaller.install('test-skill')

    const skillDir = path.join(managedDir, 'test-skill')
    expect(await fs.readFile(path.join(skillDir, 'SKILL.md'), 'utf-8')).toBe(MOCK_SKILL_CONTENT)
    expect(await fs.readFile(path.join(skillDir, 'reference.md'), 'utf-8')).toBe('# Reference\nExtra info')
  })
})
