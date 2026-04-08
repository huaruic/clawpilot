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

interface OAuthCredential {
  type: 'oauth'
  provider: string
  access: string
  refresh?: string
  expires?: number
  email?: string
  displayName?: string
}

type AuthProfileCredential = ApiKeyCredential | OAuthCredential | Record<string, unknown>

interface ProviderCredential {
  name: string
  apiKey?: string
  oauth?: { access: string; refresh: string; expires: number; email?: string }
}

const MANAGED_PROFILE_PREFIX = 'catclaw-'
const MANAGED_AGENT_IDS = ['main', 'default']

/**
 * List all routing profile agent IDs by scanning the agents/ directory.
 * Returns IDs beyond the built-in 'main' and 'default'.
 */
async function listRoutingProfileAgentIds(): Promise<string[]> {
  const agentsDir = path.join(getOpenClawStateDir(), 'agents')
  try {
    const entries = await fs.readdir(agentsDir, { withFileTypes: true })
    return entries
      .filter((e) => e.isDirectory() && !MANAGED_AGENT_IDS.includes(e.name))
      .map((e) => e.name)
  } catch {
    return []
  }
}

export async function syncManagedAuthProfiles(providers: ProviderCredential[]): Promise<void> {
  const activeNames = new Set(
    providers.filter((p) => p.apiKey?.trim() || p.oauth).map((p) => p.name),
  )

  // Sync to built-in agents + all routing profile agents
  const routingIds = await listRoutingProfileAgentIds()
  const allAgentIds = [...MANAGED_AGENT_IDS, ...routingIds]

  await Promise.all(allAgentIds.map(async (agentId) => {
    const authPath = getAuthProfilesPath(agentId)
    const store = await readAuthProfileStore(authPath)

    // Remove managed profiles that are no longer active
    for (const profileId of Object.keys(store.profiles)) {
      if (!profileId.startsWith(MANAGED_PROFILE_PREFIX)) continue
      const provider = profileId.slice(MANAGED_PROFILE_PREFIX.length)
      if (!activeNames.has(provider)) {
        delete store.profiles[profileId]
      }
    }

    // Upsert active profiles
    for (const cred of providers) {
      if (!cred.apiKey?.trim() && !cred.oauth) continue
      const profileId = buildManagedProfileId(cred.name)

      if (cred.oauth) {
        store.profiles[profileId] = {
          type: 'oauth',
          provider: cred.name,
          access: cred.oauth.access,
          refresh: cred.oauth.refresh,
          expires: cred.oauth.expires,
          ...(cred.oauth.email ? { email: cred.oauth.email } : {}),
        }
      } else {
        store.profiles[profileId] = {
          type: 'api_key',
          provider: cred.name,
          key: cred.apiKey!.trim(),
        }
      }

      const existingOrder = store.order?.[cred.name] ?? []
      const nextOrder = [profileId, ...existingOrder.filter((e) => e !== profileId)]
      store.order = { ...(store.order ?? {}), [cred.name]: nextOrder }
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
