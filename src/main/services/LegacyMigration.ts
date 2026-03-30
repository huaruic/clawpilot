import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import os from 'node:os'
import { getOpenClawStateDir } from './RuntimeLocator'

export interface MigrationResult {
  ok: boolean
  message: string
  copiedConfig: boolean
  copiedSkills: number
}

export async function migrateLegacyOpenClaw(): Promise<MigrationResult> {
  const legacyDir = path.join(os.homedir(), '.openclaw')
  const targetDir = getOpenClawStateDir()

  try {
    await fs.stat(legacyDir)
  } catch {
    return {
      ok: false,
      message: 'Legacy ~/.openclaw not found',
      copiedConfig: false,
      copiedSkills: 0,
    }
  }

  await fs.mkdir(targetDir, { recursive: true })

  let copiedConfig = false
  let copiedSkills = 0

  const legacyConfig = path.join(legacyDir, 'openclaw.json')
  const targetConfig = path.join(targetDir, 'openclaw.json')

  try {
    await fs.access(targetConfig)
  } catch {
    try {
      await fs.copyFile(legacyConfig, targetConfig)
      copiedConfig = true
    } catch {
      copiedConfig = false
    }
  }

  const legacySkillsDir = path.join(legacyDir, 'skills')
  const targetSkillsDir = path.join(targetDir, 'skills')

  try {
    const skillEntries = await fs.readdir(legacySkillsDir)
    await fs.mkdir(targetSkillsDir, { recursive: true })

    for (const entry of skillEntries) {
      const src = path.join(legacySkillsDir, entry)
      const dest = path.join(targetSkillsDir, entry)
      try {
        await copyDir(src, dest)
        copiedSkills += 1
      } catch {
        continue
      }
    }
  } catch {
    // ignore missing skills dir
  }

  return {
    ok: copiedConfig || copiedSkills > 0,
    message: 'Migration completed',
    copiedConfig,
    copiedSkills,
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
