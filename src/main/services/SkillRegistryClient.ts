export interface RegistrySkill {
  skillKey: string
  name: string
  icon: string
  category: string
  description: string
  tags: string[]
  risk: string
  files: string[]
  downloadUrl: string
}

export interface RegistryResult {
  skills: RegistrySkill[]
  error?: string
}

interface RegistryCache {
  skills: RegistrySkill[]
  fetchedAt: number
}

const CACHE_TTL_MS = 5 * 60 * 1000

export class SkillRegistryClient {
  private registryUrl: string
  private cache: RegistryCache | null = null

  constructor(registryUrl: string) {
    this.registryUrl = registryUrl
  }

  async fetchRegistry(): Promise<RegistryResult> {
    if (this.cache && Date.now() - this.cache.fetchedAt < CACHE_TTL_MS) {
      return { skills: this.cache.skills }
    }

    try {
      const response = await fetch(this.registryUrl)
      const json = await response.json()
      const skills = this.parseSkills(json)
      this.cache = { skills, fetchedAt: Date.now() }
      return { skills }
    } catch (err) {
      return {
        skills: [],
        error: err instanceof Error ? err.message : String(err),
      }
    }
  }

  async findSkill(skillKey: string): Promise<RegistrySkill | undefined> {
    const { skills } = await this.fetchRegistry()
    return skills.find((s) => s.skillKey === skillKey)
  }

  invalidateCache(): void {
    this.cache = null
  }

  private parseSkills(json: unknown): RegistrySkill[] {
    if (!json || typeof json !== 'object') return []
    const registry = json as Record<string, unknown>
    const rawSkills = registry.skills
    if (!Array.isArray(rawSkills)) return []

    return rawSkills.filter((entry): entry is RegistrySkill => {
      if (!entry || typeof entry !== 'object') return false
      const s = entry as Record<string, unknown>
      return (
        typeof s.skillKey === 'string'
        && typeof s.name === 'string'
        && typeof s.description === 'string'
        && typeof s.downloadUrl === 'string'
        && Array.isArray(s.files)
      )
    })
  }
}
