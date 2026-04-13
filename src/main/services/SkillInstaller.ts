import fs from 'node:fs/promises'
import path from 'node:path'
import type { SkillRegistryClient } from './SkillRegistryClient'

interface SkillInstallerDeps {
  registryClient: SkillRegistryClient
  managedSkillsDir: string
  writeSkillEnabled: (skillKey: string, enabled: boolean) => Promise<void>
  restartRuntime: () => Promise<void>
}

export class SkillInstaller {
  private deps: SkillInstallerDeps

  constructor(deps: SkillInstallerDeps) {
    this.deps = deps
  }

  async install(skillKey: string): Promise<void> {
    const skill = await this.deps.registryClient.findSkill(skillKey)
    if (!skill) {
      throw new Error(`Skill "${skillKey}" not found in registry`)
    }

    const skillDir = path.join(this.deps.managedSkillsDir, skillKey)
    await fs.mkdir(skillDir, { recursive: true })

    try {
      for (const file of skill.files) {
        const url = skill.downloadUrl + file
        const response = await fetch(url)
        if (!response.ok) {
          throw new Error(`Failed to download ${file}: HTTP ${response.status}`)
        }
        const content = await response.text()
        await fs.writeFile(path.join(skillDir, file), content, 'utf-8')
      }
    } catch (err) {
      await fs.rm(skillDir, { recursive: true, force: true }).catch(() => {})
      throw err
    }

    await this.deps.writeSkillEnabled(skillKey, true)
    await this.deps.restartRuntime()
  }
}
