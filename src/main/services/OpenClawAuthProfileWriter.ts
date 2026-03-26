import fs from 'node:fs/promises'
import path from 'node:path'
import { getOpenClawStateDir } from './RuntimeLocator'

interface AuthProfileStore {
  version: number
  profiles: Record<string, AuthProfileCredential>
  order?: Record<string, string[]>
  lastGood?: Record<string, string>
  usageStats?: Record<string, unknown>
}

interface ApiKeyCredential {
  type: 'api_key'
  provider: string
  key: string
}

type AuthProfileCredential = ApiKeyCredential | Record<string, unknown>

interface ProviderCredential {
  name: string
  apiKey: string
}

const MANAGED_PROFILE_PREFIX = 'clawpilot-'
const MANAGED_AGENT_IDS = ['main', 'default']

export async function syncManagedAuthProfiles(providers: ProviderCredential[]): Promise<void> {
  const activeProviders = new Map(
    providers
      .filter((provider) => provider.apiKey.trim().length > 0)
      .map((provider) => [provider.name, provider.apiKey.trim()])
  )

  await Promise.all(MANAGED_AGENT_IDS.map(async (agentId) => {
    const authPath = getAuthProfilesPath(agentId)
    const store = await readAuthProfileStore(authPath)

    for (const [profileId, credential] of Object.entries(store.profiles)) {
      if (!profileId.startsWith(MANAGED_PROFILE_PREFIX)) continue
      const provider = profileId.slice(MANAGED_PROFILE_PREFIX.length)
      if (!activeProviders.has(provider)) {
        delete store.profiles[profileId]
      }
    }

    for (const [provider, apiKey] of activeProviders) {
      const profileId = buildManagedProfileId(provider)
      store.profiles[profileId] = {
        type: 'api_key',
        provider,
        key: apiKey,
      }
      const existingOrder = store.order?.[provider] ?? []
      const nextOrder = [profileId, ...existingOrder.filter((entry) => entry !== profileId)]
      store.order = {
        ...(store.order ?? {}),
        [provider]: nextOrder,
      }
    }

    cleanupEmptyOrder(store)
    await fs.mkdir(path.dirname(authPath), { recursive: true })
    await fs.writeFile(authPath, JSON.stringify(store, null, 2), 'utf-8')
  }))
}

export async function loadManagedProviderApiKey(provider: string): Promise<string | null> {
  const profileId = buildManagedProfileId(provider)

  for (const agentId of MANAGED_AGENT_IDS) {
    const store = await readAuthProfileStore(getAuthProfilesPath(agentId))
    const credential = store.profiles[profileId]
    if (isApiKeyCredential(credential) && credential.key.trim()) {
      return credential.key.trim()
    }
  }

  return null
}

export async function listManagedProviderNames(): Promise<string[]> {
  const names = new Set<string>()

  for (const agentId of MANAGED_AGENT_IDS) {
    const store = await readAuthProfileStore(getAuthProfilesPath(agentId))
    for (const [profileId, credential] of Object.entries(store.profiles)) {
      if (!profileId.startsWith(MANAGED_PROFILE_PREFIX)) continue
      if (!isApiKeyCredential(credential) || !credential.provider.trim()) continue
      names.add(credential.provider.trim())
    }
  }

  return [...names]
}

function getAuthProfilesPath(agentId: string): string {
  return path.join(getOpenClawStateDir(), 'agents', agentId, 'agent', 'auth-profiles.json')
}

function buildManagedProfileId(provider: string): string {
  return `${MANAGED_PROFILE_PREFIX}${provider}`
}

async function readAuthProfileStore(authPath: string): Promise<AuthProfileStore> {
  try {
    const raw = await fs.readFile(authPath, 'utf-8')
    const parsed = JSON.parse(raw) as Partial<AuthProfileStore>
    return {
      version: typeof parsed.version === 'number' ? parsed.version : 1,
      profiles: parsed.profiles && typeof parsed.profiles === 'object' ? parsed.profiles as Record<string, AuthProfileCredential> : {},
      ...(parsed.order && typeof parsed.order === 'object' ? { order: parsed.order as Record<string, string[]> } : {}),
      ...(parsed.lastGood && typeof parsed.lastGood === 'object' ? { lastGood: parsed.lastGood as Record<string, string> } : {}),
      ...(parsed.usageStats && typeof parsed.usageStats === 'object' ? { usageStats: parsed.usageStats as Record<string, unknown> } : {}),
    }
  } catch {
    return { version: 1, profiles: {} }
  }
}

function cleanupEmptyOrder(store: AuthProfileStore): void {
  if (!store.order) return

  for (const [provider, order] of Object.entries(store.order)) {
    const filtered = order.filter((profileId) => profileId in store.profiles)
    if (filtered.length === 0) {
      delete store.order[provider]
      continue
    }
    store.order[provider] = filtered
  }

  if (Object.keys(store.order).length === 0) {
    delete store.order
  }
}

function isApiKeyCredential(credential: AuthProfileCredential | undefined): credential is ApiKeyCredential {
  return credential?.type === 'api_key'
    && typeof credential.provider === 'string'
    && typeof credential.key === 'string'
}
