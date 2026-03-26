import fs from 'node:fs/promises'
import path from 'node:path'
import JSON5 from 'json5'
import { getDefaultOpenClawWorkspaceRoot, getOpenClawStateDir } from './RuntimeLocator'

export type SetupPhase = 'gateway_setup' | 'model_setup' | 'bootstrap' | 'ready'

export interface OpenClawSetup {
  hasConfig: boolean
  hasProvider: boolean
  hasDefaultModel: boolean
  bootstrapPending: boolean
  workspaceRoot: string
  configPath: string
  phase: SetupPhase
  blockingReason?: string
}

export function getConfigPath(): string {
  return path.join(getOpenClawStateDir(), 'openclaw.json')
}

export interface ProviderMeta {
  name: string
  baseUrl: string
  api?: string // e.g. "openai-completions", "anthropic-messages"
  models?: Array<{ id: string; name: string }>
}

export interface ProviderEntry extends ProviderMeta {
  apiKey: string
}

export interface FeishuConfig {
  enabled: boolean
  connectionMode: 'websocket' | 'webhook'
  dmPolicy: string
  defaultAccount: string
  appId: string
  appSecret: string
}

export async function readWorkspaceRoot(): Promise<string> {
  const existing = await readExistingConfig()
  const configured = (((existing.agents as Record<string, unknown> | undefined)
    ?.defaults as Record<string, unknown> | undefined)
    ?.workspace as string | undefined)?.trim()

  return configured || getDefaultOpenClawWorkspaceRoot()
}

export async function writeWorkspaceRoot(workspaceRoot: string): Promise<void> {
  const trimmed = workspaceRoot.trim()
  if (!trimmed) {
    throw new Error('Workspace path is required')
  }

  const configPath = getConfigPath()
  await fs.mkdir(path.dirname(configPath), { recursive: true })
  await fs.mkdir(trimmed, { recursive: true })

  const existing = await readExistingConfig()
  const agents = (existing.agents as Record<string, unknown>) ?? {}
  const defaults = (agents.defaults as Record<string, unknown>) ?? {}
  const updated = {
    ...existing,
    agents: {
      ...agents,
      defaults: {
        ...defaults,
        workspace: trimmed,
      },
    },
  }

  await fs.writeFile(configPath, JSON5.stringify(updated, null, 2), 'utf-8')
}

export async function resetWorkspaceRoot(): Promise<void> {
  await writeWorkspaceRoot(getDefaultOpenClawWorkspaceRoot())
}

async function readExistingConfig(): Promise<Record<string, unknown>> {
  try {
    const raw = await fs.readFile(getConfigPath(), 'utf-8')
    return (JSON5.parse(raw) as Record<string, unknown>) ?? {}
  } catch {
    return {}
  }
}

export async function ensureOpenClawBaseConfig(): Promise<void> {
  const configPath = getConfigPath()
  await fs.mkdir(path.dirname(configPath), { recursive: true })

  const existing = await readExistingConfig()
  const stateDir = getOpenClawStateDir()
  const agents = (existing.agents as Record<string, unknown>) ?? {}
  const defaults = (agents.defaults as Record<string, unknown>) ?? {}
  const workspaceRoot = (typeof defaults.workspace === 'string' && defaults.workspace.trim())
    ? defaults.workspace.trim()
    : getDefaultOpenClawWorkspaceRoot()

  await fs.mkdir(workspaceRoot, { recursive: true })

  const updated = {
    ...existing,
    gateway: {
      ...((existing.gateway as Record<string, unknown>) ?? {}),
      mode: 'local',
    },
    logging: {
      ...((existing.logging as Record<string, unknown>) ?? {}),
      file: path.join(stateDir, 'logs', 'openclaw.log'),
    },
    agents: {
      ...agents,
      defaults: {
        ...defaults,
        workspace: workspaceRoot,
      },
    },
  }

  await fs.writeFile(configPath, JSON5.stringify(updated, null, 2), 'utf-8')
}

export async function writeOpenClawConfig(providers: ProviderEntry[]): Promise<void> {
  const configPath = getConfigPath()
  await fs.mkdir(path.dirname(configPath), { recursive: true })
  const existing = await readExistingConfig()

  const modelsProviders: Record<string, unknown> = {}
  for (const p of providers) {
    modelsProviders[p.name] = {
      baseUrl: p.baseUrl,
      apiKey: p.apiKey,
      ...(p.api ? { api: p.api } : {}),
      ...(p.models?.length ? { models: p.models.map((m) => ({ ...m, name: m.name || m.id })) } : {}),
    }
  }

  // Derive a valid default model from the first provider that has models
  const existingDefault = (existing.agents as Record<string, unknown> | undefined)
    ?.defaults as Record<string, unknown> | undefined
  const existingPrimary = (existingDefault?.model as Record<string, unknown> | undefined)?.primary as string | undefined
  const defaultModel = resolveDefaultModel(providers, existingPrimary)

  const stateDir = getOpenClawStateDir()
  const updated = {
    ...existing,
    gateway: {
      ...((existing.gateway as Record<string, unknown>) ?? {}),
      mode: 'local',
    },
    models: {
      ...((existing.models as Record<string, unknown>) ?? {}),
      providers: modelsProviders,
    },
    agents: {
      ...((existing.agents as Record<string, unknown>) ?? {}),
      defaults: {
        ...(existingDefault ?? {}),
        model: {
          ...((existingDefault?.model as Record<string, unknown>) ?? {}),
          primary: defaultModel,
        },
      },
    },
    logging: {
      ...((existing.logging as Record<string, unknown>) ?? {}),
      file: path.join(stateDir, 'logs', 'openclaw.log'),
    },
  }

  await fs.writeFile(configPath, JSON5.stringify(updated, null, 2), 'utf-8')
}

export async function loadFeishuConfig(): Promise<FeishuConfig> {
  const existing = await readExistingConfig()
  const channels = (existing.channels as Record<string, unknown>) ?? {}
  const feishu = (channels.feishu as Record<string, unknown>) ?? {}
  const accounts = (feishu.accounts as Record<string, unknown>) ?? {}
  const defaultAccount = typeof feishu.defaultAccount === 'string' && feishu.defaultAccount.trim()
    ? feishu.defaultAccount.trim()
    : 'main'
  const account = (accounts[defaultAccount] as Record<string, unknown>) ?? (accounts.main as Record<string, unknown>) ?? {}

  return {
    enabled: feishu.enabled !== false && (Object.keys(account).length > 0 || Boolean(feishu.enabled)),
    connectionMode: feishu.connectionMode === 'webhook' ? 'webhook' : 'websocket',
    dmPolicy: typeof feishu.dmPolicy === 'string' && feishu.dmPolicy.trim() ? String(feishu.dmPolicy) : 'pairing',
    defaultAccount,
    appId: typeof account.appId === 'string' ? account.appId : '',
    appSecret: typeof account.appSecret === 'string' ? account.appSecret : '',
  }
}

export async function writeFeishuConfig(params: { appId: string; appSecret: string }): Promise<void> {
  const configPath = getConfigPath()
  await fs.mkdir(path.dirname(configPath), { recursive: true })
  const existing = await readExistingConfig()
  const channels = (existing.channels as Record<string, unknown>) ?? {}
  const feishu = (channels.feishu as Record<string, unknown>) ?? {}
  const accounts = (feishu.accounts as Record<string, unknown>) ?? {}
  const defaultAccount = typeof feishu.defaultAccount === 'string' && feishu.defaultAccount.trim()
    ? feishu.defaultAccount.trim()
    : 'main'
  const currentAccount = (accounts[defaultAccount] as Record<string, unknown>) ?? {}

  const updated = {
    ...existing,
    channels: {
      ...channels,
      feishu: {
        ...feishu,
        enabled: true,
        connectionMode: 'websocket',
        dmPolicy: 'pairing',
        defaultAccount,
        accounts: {
          ...accounts,
          [defaultAccount]: {
            ...currentAccount,
            appId: params.appId.trim(),
            appSecret: params.appSecret.trim(),
          },
        },
      },
    },
  }

  await fs.writeFile(configPath, JSON5.stringify(updated, null, 2), 'utf-8')
}

export async function resetFeishuChannel(): Promise<void> {
  const configPath = getConfigPath()
  await fs.mkdir(path.dirname(configPath), { recursive: true })

  const existing = await readExistingConfig()
  const channels = (existing.channels as Record<string, unknown>) ?? {}
  const nextChannels = { ...channels }
  delete nextChannels.feishu

  const updated = {
    ...existing,
    channels: nextChannels,
  }

  await fs.writeFile(configPath, JSON5.stringify(updated, null, 2), 'utf-8')

  const stateDir = getOpenClawStateDir()
  const resetTargets = [
    path.join(stateDir, 'credentials', 'feishu-pairing.json'),
    path.join(stateDir, 'credentials', 'feishu-main-allowFrom.json'),
  ]

  await Promise.all(resetTargets.map(async (target) => {
    try {
      await fs.rm(target, { force: true })
    } catch {
      // Ignore missing/unremovable reset artifacts so reset remains idempotent.
    }
  }))
}

export async function writeSkillEnabled(skillKey: string, enabled: boolean): Promise<void> {
  const normalizedKey = skillKey.trim()
  if (!normalizedKey) {
    throw new Error('Skill key is required')
  }

  const configPath = getConfigPath()
  await fs.mkdir(path.dirname(configPath), { recursive: true })
  const existing = await readExistingConfig()
  const skills = (existing.skills as Record<string, unknown>) ?? {}
  const entries = (skills.entries as Record<string, unknown>) ?? {}
  const currentEntry = (entries[normalizedKey] as Record<string, unknown>) ?? {}

  const updated = {
    ...existing,
    skills: {
      ...skills,
      entries: {
        ...entries,
        [normalizedKey]: {
          ...currentEntry,
          enabled,
        },
      },
    },
  }

  await fs.writeFile(configPath, JSON5.stringify(updated, null, 2), 'utf-8')
}

export async function removeSkillEntryConfig(skillKey: string): Promise<void> {
  const normalizedKey = skillKey.trim()
  if (!normalizedKey) return

  const configPath = getConfigPath()
  await fs.mkdir(path.dirname(configPath), { recursive: true })
  const existing = await readExistingConfig()
  const skills = (existing.skills as Record<string, unknown>) ?? {}
  const entries = (skills.entries as Record<string, unknown>) ?? {}

  if (!(normalizedKey in entries)) {
    return
  }

  const nextEntries = { ...entries }
  delete nextEntries[normalizedKey]

  const nextSkills: Record<string, unknown> = { ...skills }
  if (Object.keys(nextEntries).length > 0) {
    nextSkills.entries = nextEntries
  } else {
    delete nextSkills.entries
  }

  const updated = {
    ...existing,
    ...(Object.keys(nextSkills).length > 0
      ? { skills: nextSkills }
      : { skills: undefined }),
  }

  if (Object.keys(nextSkills).length === 0) {
    delete (updated as Record<string, unknown>).skills
  }

  await fs.writeFile(configPath, JSON5.stringify(updated, null, 2), 'utf-8')
}

function resolveDefaultModel(providers: ProviderEntry[], existingPrimary?: string): string {
  // Check if existing primary is still valid (provider/model exists in current config)
  if (existingPrimary) {
    const [providerName, modelId] = existingPrimary.split('/')
    const provider = providers.find((p) => p.name === providerName)
    if (provider && (!provider.models?.length || provider.models.some((m) => m.id === modelId))) {
      return existingPrimary
    }
  }
  // Fall back to first available provider/model
  for (const p of providers) {
    if (p.models?.length) return `${p.name}/${p.models[0].id}`
    return p.name
  }
  return ''
}

export async function loadProviderMeta(): Promise<ProviderMeta[]> {
  const existing = await readExistingConfig()
  const providers = (existing.models as Record<string, unknown>)?.providers as Record<string, unknown> | undefined
  if (!providers) return []
  return Object.entries(providers).map(([name, v]) => {
    const p = v as Record<string, unknown>
    return {
      name,
      baseUrl: String(p.baseUrl ?? ''),
      api: p.api ? String(p.api) : undefined,
      models: Array.isArray(p.models)
        ? (p.models as Array<{ id: string; name: string }>)
        : undefined,
    }
  })
}

export async function readDefaultModel(): Promise<string> {
  const existing = await readExistingConfig()
  const agents = existing.agents as Record<string, unknown> | undefined
  const defaults = agents?.defaults as Record<string, unknown> | undefined
  const model = defaults?.model as Record<string, unknown> | undefined
  return (model?.primary as string) ?? ''
}

export async function writeDefaultModel(primary: string): Promise<void> {
  const configPath = getConfigPath()
  await fs.mkdir(path.dirname(configPath), { recursive: true })
  const existing = await readExistingConfig()
  const agents = (existing.agents as Record<string, unknown>) ?? {}
  const defaults = (agents.defaults as Record<string, unknown>) ?? {}
  const model = (defaults.model as Record<string, unknown>) ?? {}
  const updated = {
    ...existing,
    agents: {
      ...agents,
      defaults: {
        ...defaults,
        model: { ...model, primary },
      },
    },
  }
  await fs.writeFile(configPath, JSON5.stringify(updated, null, 2), 'utf-8')
}

export async function readGatewayToken(): Promise<string> {
  try {
    const existing = await readExistingConfig()
    const token = (existing.gateway as Record<string, unknown>)?.auth &&
      ((existing.gateway as Record<string, unknown>).auth as Record<string, unknown>)?.token
    if (token) return String(token)
  } catch {
    // ignore
  }
  return ''
}

export async function waitForGatewayToken(timeoutMs = 5000): Promise<string> {
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    const token = await readGatewayToken()
    if (token) return token
    await sleep(250)
  }

  return ''
}

export async function inspectOpenClawSetup(): Promise<OpenClawSetup> {
  const configPath = getConfigPath()
  const workspaceRoot = await readWorkspaceRoot()
  const [existing, hasConfig, defaultModel, bootstrapPending] = await Promise.all([
    readExistingConfig(),
    pathExists(configPath),
    readDefaultModel(),
    pathExists(path.join(workspaceRoot, 'BOOTSTRAP.md')),
  ])

  const providers = (existing.models as Record<string, unknown> | undefined)?.providers as Record<string, unknown> | undefined
  const hasProvider = !!providers && Object.keys(providers).length > 0
  const hasDefaultModel = defaultModel.trim().length > 0

  let phase: SetupPhase
  let blockingReason: string | undefined

  if (!hasConfig) {
    phase = 'gateway_setup'
    blockingReason = 'missing_gateway_config'
  } else if (!hasProvider || !hasDefaultModel) {
    phase = 'model_setup'
    blockingReason = !hasProvider ? 'missing_provider' : 'missing_default_model'
  } else if (bootstrapPending) {
    phase = 'bootstrap'
  } else {
    phase = 'ready'
  }

  return {
    hasConfig,
    hasProvider,
    hasDefaultModel,
    bootstrapPending,
    workspaceRoot,
    configPath,
    phase,
    blockingReason,
  }
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await access(target)
    return true
  } catch {
    return false
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
