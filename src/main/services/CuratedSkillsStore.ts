import { app } from 'electron'
import fs from 'node:fs/promises'
import fsSync from 'node:fs'
import path from 'node:path'

/**
 * Curated Skills — the "Starter Pack" shipped with CatClaw.
 *
 * Source of truth: `resources/curated-skills/` in the repo, packaged into the
 * app via extraResources. Each entry is a pure-prompt SKILL.md (zero deps),
 * and `registry.json` is the UI metadata layer with Chinese categories and
 * descriptions.
 *
 * Phase 1: These skills are discovered and displayed in the UI only — they do
 * NOT get written into openclaw.json (neither entries nor load.extraDirs), and
 * the Skills page hides toggle/delete controls for them. Users interact with
 * curated skills exclusively through the "Try Now" button, which pre-fills a
 * prompt in the Chat composer.
 */

export interface CuratedSkillEntry {
  skillKey: string
  name: string
  icon: string
  category: string
  description: string
  tags: string[]
  risk: 'Low' | 'Medium' | 'High'
  files: string[]
  downloadUrl?: string
}

export interface CuratedRegistry {
  version: number
  updatedAt: string
  skills: CuratedSkillEntry[]
}

/**
 * Resolve the curated-skills directory in both dev and packaged mode.
 *
 * - Dev: `__dirname` is `out/main/`, so `../../resources/curated-skills`
 *   lands at the worktree root `resources/curated-skills/`.
 * - Packaged: extraResources copies `resources/curated-skills` under
 *   `process.resourcesPath/resources/curated-skills`.
 */
export function getCuratedSkillsDir(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'resources', 'curated-skills')
  }
  return path.join(__dirname, '../..', 'resources', 'curated-skills')
}

export function getCuratedSkillsScanDir(): string {
  return path.join(getCuratedSkillsDir(), 'skills')
}

export function getCuratedRegistryPath(): string {
  return path.join(getCuratedSkillsDir(), 'registry.json')
}

export function curatedSkillsAvailable(): boolean {
  try {
    return fsSync.statSync(getCuratedSkillsScanDir()).isDirectory()
  } catch {
    return false
  }
}

/**
 * Read registry.json. Returns null on any failure so the UI can degrade
 * gracefully (hide the Starter Pack section rather than error out).
 */
export async function readCuratedRegistry(): Promise<CuratedRegistry | null> {
  try {
    const raw = await fs.readFile(getCuratedRegistryPath(), 'utf-8')
    const parsed = JSON.parse(raw) as CuratedRegistry
    if (!parsed || !Array.isArray(parsed.skills)) return null
    return parsed
  } catch {
    return null
  }
}
