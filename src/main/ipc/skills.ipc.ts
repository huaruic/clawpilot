import { ipcMain } from 'electron'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import JSON5 from 'json5'
import { DeleteSkillSchema, InstallSkillSchema, SetSkillEnabledSchema } from './schemas/skills.schema'
import { getConfigPath, readWorkspaceRoot, removeSkillEntryConfig, writeSkillEnabled } from '../services/OpenClawConfigWriter'
import { getBundledOpenClawSkillsDir, getOpenClawStateDir } from '../services/RuntimeLocator'

type SkillSource =
  | 'openclaw-bundled'
  | 'openclaw-managed'
  | 'openclaw-workspace'
  | 'agents-skills-personal'
  | 'agents-skills-project'
  | 'openclaw-extra'

interface SkillSnapshot {
  skillKey: string
  name: string
  description?: string
  emoji?: string
  homepage?: string
  source: SkillSource
  enabled: boolean
  canDelete: boolean
  path: string
}

interface SkillsListPayload {
  summary: {
    total: number
    enabled: number
    builtIn: number
    local: number
  }
  skills: SkillSnapshot[]
}

interface OpenClawSkillsConfig {
  entries: Record<string, { enabled?: boolean }>
  extraDirs: string[]
}

interface FrontmatterSnapshot {
  skillKey: string
  name: string
  description?: string
  homepage?: string
  emoji?: string
}

interface SkillDiscoveryRoot {
  dir: string
  source: SkillSource
}

export function registerSkillsIpc(): void {
  ipcMain.handle('skills:list', async () => {
    return readSkillsList()
  })

  ipcMain.handle('skills:setEnabled', async (_, raw) => {
    const { skillKey, enabled } = SetSkillEnabledSchema.parse(raw)
    await writeSkillEnabled(skillKey, enabled)
    return { ok: true }
  })

  ipcMain.handle('skills:delete', async (_, raw) => {
    const { skillKey } = DeleteSkillSchema.parse(raw)
    const snapshot = await readSkillsList()
    const skill = snapshot.skills.find((entry) => entry.skillKey === skillKey)
    if (!skill) {
      throw new Error(`Skill not found: ${skillKey}`)
    }
    if (!skill.canDelete) {
      throw new Error('This skill cannot be deleted from ClawPilot.')
    }

    await fs.rm(skill.path, { recursive: true, force: true })
    await removeSkillEntryConfig(skill.skillKey)

    return { ok: true }
  })

  ipcMain.handle('skills:install', async (_, raw) => {
    const { sourcePath, overwrite } = InstallSkillSchema.parse(raw)
    const target = await installSkill(sourcePath, Boolean(overwrite))
    return { ok: true, target }
  })
}

async function readSkillsList(): Promise<SkillsListPayload> {
  const [workspaceRoot, config] = await Promise.all([
    readWorkspaceRoot(),
    readSkillsConfig(),
  ])

  const roots = resolveSkillRoots(workspaceRoot, config.extraDirs)
  const merged = new Map<string, SkillSnapshot>()

  for (const root of roots) {
    const discovered = await scanSkillRoot(root, config.entries)
    for (const skill of discovered) {
      merged.set(skill.skillKey, skill)
    }
  }

  const skills = Array.from(merged.values()).sort((left, right) => left.name.localeCompare(right.name))
  const summary = {
    total: skills.length,
    enabled: skills.filter((skill) => skill.enabled).length,
    builtIn: skills.filter((skill) => skill.source === 'openclaw-bundled').length,
    local: skills.filter((skill) => skill.canDelete).length,
  }

  return { summary, skills }
}

async function readSkillsConfig(): Promise<OpenClawSkillsConfig> {
  try {
    const raw = await fs.readFile(getConfigPath(), 'utf-8')
    const parsed = (JSON5.parse(raw) as Record<string, unknown>) ?? {}
    const skills = (parsed.skills as Record<string, unknown>) ?? {}
    const entries = (skills.entries as Record<string, { enabled?: boolean }>) ?? {}
    const load = (skills.load as Record<string, unknown>) ?? {}
    const extraDirs = Array.isArray(load.extraDirs) ? load.extraDirs.map(String) : []
    return { entries, extraDirs }
  } catch {
    return { entries: {}, extraDirs: [] }
  }
}

function resolveSkillRoots(workspaceRoot: string, extraDirs: string[]): SkillDiscoveryRoot[] {
  const stateDir = getOpenClawStateDir()
  return [
    ...extraDirs.map((dir) => ({ dir: resolveUserPath(dir), source: 'openclaw-extra' as const })),
    { dir: getBundledOpenClawSkillsDir(), source: 'openclaw-bundled' },
    { dir: path.join(stateDir, 'skills'), source: 'openclaw-managed' },
    { dir: path.join(os.homedir(), '.agents', 'skills'), source: 'agents-skills-personal' },
    { dir: path.join(workspaceRoot, '.agents', 'skills'), source: 'agents-skills-project' },
    { dir: path.join(workspaceRoot, 'skills'), source: 'openclaw-workspace' },
  ]
}

async function scanSkillRoot(
  root: SkillDiscoveryRoot,
  configEntries: OpenClawSkillsConfig['entries'],
): Promise<SkillSnapshot[]> {
  const rootDir = path.resolve(root.dir)
  try {
    const stat = await fs.stat(rootDir)
    if (!stat.isDirectory()) return []
  } catch {
    return []
  }

  const skillDirs = await discoverSkillDirs(rootDir)
  const results = await Promise.all(skillDirs.map(async (dir) => {
    const frontmatter = await readFrontmatter(path.join(dir, 'SKILL.md'), path.basename(dir))
    return {
      skillKey: frontmatter.skillKey,
      name: frontmatter.name,
      description: frontmatter.description,
      emoji: frontmatter.emoji,
      homepage: frontmatter.homepage,
      source: root.source,
      enabled: configEntries[frontmatter.skillKey]?.enabled !== false,
      canDelete: root.source === 'openclaw-managed'
        || root.source === 'openclaw-workspace'
        || root.source === 'agents-skills-personal'
        || root.source === 'agents-skills-project',
      path: dir,
    } satisfies SkillSnapshot
  }))

  return results
}

async function installSkill(sourcePath: string, overwrite: boolean): Promise<string> {
  const resolved = path.resolve(sourcePath)
  const stat = await fs.stat(resolved)
  if (!stat.isDirectory()) {
    throw new Error('Selected skill must be a directory')
  }

  const frontmatter = await readFrontmatter(path.join(resolved, 'SKILL.md'), path.basename(resolved))
  const dirName = sanitizeFolderName(frontmatter.skillKey || path.basename(resolved))
  const targetRoot = path.join(getOpenClawStateDir(), 'skills')
  const targetPath = path.join(targetRoot, dirName)

  try {
    await fs.access(targetPath)
    if (!overwrite) {
      throw new Error('Skill already exists')
    }
    await fs.rm(targetPath, { recursive: true, force: true })
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    if (code !== 'ENOENT' && !overwrite) {
      throw err
    }
  }

  await fs.mkdir(targetRoot, { recursive: true })
  await copyDir(resolved, targetPath)
  return targetPath
}

async function discoverSkillDirs(rootDir: string): Promise<string[]> {
  const rootSkillFile = path.join(rootDir, 'SKILL.md')
  if (await pathExists(rootSkillFile)) {
    return [rootDir]
  }

  let entries: Awaited<ReturnType<typeof fs.readdir>>
  try {
    entries = await fs.readdir(rootDir, { withFileTypes: true })
  } catch {
    return []
  }

  const dirs = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(rootDir, entry.name))

  const checks = await Promise.all(dirs.map(async (dir) => (await pathExists(path.join(dir, 'SKILL.md'))) ? dir : null))
  return checks.filter((value): value is string => Boolean(value))
}

async function readFrontmatter(filePath: string, fallbackName: string): Promise<FrontmatterSnapshot> {
  let raw = ''
  try {
    raw = await fs.readFile(filePath, 'utf-8')
  } catch {
    return {
      skillKey: fallbackName,
      name: fallbackName,
    }
  }

  const frontmatter = extractFrontmatter(raw)
  const skillKey = readFrontmatterValue(frontmatter, 'name') ?? fallbackName
  const description = readFrontmatterValue(frontmatter, 'description')
  const homepage = readFrontmatterValue(frontmatter, 'homepage') ?? readFrontmatterValue(frontmatter, 'website')
  const emoji = readMetadataEmoji(frontmatter) ?? readFrontmatterValue(frontmatter, 'emoji')

  return {
    skillKey,
    name: skillKey,
    description: description ? unquote(description) : undefined,
    homepage: homepage ? unquote(homepage) : undefined,
    emoji: emoji ? unquote(emoji) : undefined,
  }
}

function extractFrontmatter(raw: string): string {
  if (!raw.startsWith('---\n') && !raw.startsWith('---\r\n')) return ''
  const marker = raw.indexOf('\n---', 4)
  if (marker < 0) return ''
  return raw.slice(raw.indexOf('\n') + 1, marker).trim()
}

function readFrontmatterValue(frontmatter: string, key: string): string | null {
  const pattern = new RegExp(`^${escapeRegExp(key)}:\\s*(.+)$`, 'm')
  const match = frontmatter.match(pattern)
  return match?.[1]?.trim() ?? null
}

function readMetadataEmoji(frontmatter: string): string | null {
  const match = frontmatter.match(/"emoji"\s*:\s*"([^"]+)"/)
  return match?.[1] ?? null
}

function unquote(value: string): string {
  const trimmed = value.trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
    || (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function resolveUserPath(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) return trimmed
  if (trimmed === '~') return os.homedir()
  if (trimmed.startsWith('~/')) return path.join(os.homedir(), trimmed.slice(2))
  return path.resolve(trimmed)
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await fs.access(target)
    return true
  } catch {
    return false
  }
}

async function copyDir(src: string, dest: string): Promise<void> {
  const stat = await fs.stat(src)
  if (stat.isDirectory()) {
    await fs.mkdir(dest, { recursive: true })
    const entries = await fs.readdir(src)
    for (const entry of entries) {
      await copyDir(path.join(src, entry), path.join(dest, entry))
    }
    return
  }
  await fs.copyFile(src, dest)
}

function sanitizeFolderName(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) return 'skill'
  return trimmed.replace(/[^\w.-]+/g, '-')
}
