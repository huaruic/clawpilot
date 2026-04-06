import type { ProviderAccount } from '../../shared/providers/types'
import { getProviderDefinition, getProviderBackendConfig } from '../../shared/providers/registry'
import { listProviderAccounts } from './ProviderStore'
import { getProviderSecret } from './SecretStore'
import {
  writeOpenClawConfig,
  writeDefaultModel,
  type ProviderEntry,
} from './OpenClawConfigWriter'
import { syncManagedAuthProfiles } from './OpenClawAuthProfileWriter'
import type { OpenClawProcessManager } from './OpenClawProcessManager'
import type { RuntimeState } from '../state/RuntimeState'
import { readRoutingConfig, syncRoutingToGatewayFormat } from './OpenClawConfigWriter'
import { mainLogger } from '../utils/logger'

/**
 * Map account vendorId to the runtime key used in openclaw.json.
 * Most builtins use their vendorId directly. Special cases:
 * - minimax-portal-cn → minimax-portal (runtime alias)
 * - custom/ollama → type-{first8chars} to support multiple accounts
 */
export function getOpenClawProviderKey(account: { vendorId: string; id: string; authMode?: string }): string {
  const { vendorId, id: accountId } = account
  if (vendorId === 'custom') {
    const prefix = 'custom-'
    if (accountId.startsWith(prefix)) {
      const tail = accountId.slice(prefix.length)
      if (tail.length === 8 && !tail.includes('-')) {
        return accountId
      }
    }
    const suffix = accountId.replace(/-/g, '').slice(0, 8)
    return `custom-${suffix}`
  }
  if (vendorId === 'minimax-portal-cn') {
    return 'minimax-portal'
  }
  // OpenAI/Google OAuth accounts map to their dedicated runtime providers
  if (account.authMode === 'oauth_browser') {
    if (vendorId === 'openai') return 'openai-codex'
    if (vendorId === 'google') return 'google-gemini-cli'
  }
  return vendorId
}

/**
 * Rebuild openclaw.json and auth-profiles from all stored accounts + secrets.
 * This is the main sync entry point — called after any provider CRUD operation.
 */
export async function syncAllProvidersToRuntime(): Promise<void> {
  const accounts = await listProviderAccounts()

  const entries: ProviderEntry[] = []
  const credentials: Array<{ name: string; apiKey?: string; oauth?: { access: string; refresh: string; expires: number; email?: string } }> = []

  for (const account of accounts) {
    if (!account.enabled) continue

    const runtimeKey = getOpenClawProviderKey(account)
    const config = getProviderBackendConfig(account.vendorId)
    const baseUrl = account.baseUrl || config?.baseUrl || ''
    const api = account.apiProtocol || config?.api
    const secret = await getProviderSecret(account.id)

    entries.push({
      name: runtimeKey,
      baseUrl,
      api,
      models: resolveModelsForAccount(account),
      apiKey: secret?.type === 'api_key' ? secret.apiKey : '',
    })

    if (secret?.type === 'oauth') {
      credentials.push({
        name: runtimeKey,
        oauth: {
          access: secret.accessToken,
          refresh: secret.refreshToken,
          expires: secret.expiresAt,
          email: secret.email,
        },
      })
    } else if (secret?.type === 'api_key' && secret.apiKey) {
      credentials.push({ name: runtimeKey, apiKey: secret.apiKey })
    }
  }

  await writeOpenClawConfig(entries)
  await syncManagedAuthProfiles(credentials)
}

/**
 * Sync a single newly-created account to runtime.
 * The gateway watches openclaw.json via chokidar and hot-reloads automatically.
 * If the gateway is not running yet, auto-start it.
 */
export async function syncSavedProviderToRuntime(
  account: ProviderAccount,
  _apiKey: string | undefined,
  deps: { processManager: OpenClawProcessManager; state: RuntimeState; refreshSetup: () => Promise<void> },
): Promise<void> {
  await syncAllProvidersToRuntime()
  await syncRoutingProfilesAfterProviderChange()
  await deps.refreshSetup()
  await autoStartIfStopped(deps, `provider save "${account.vendorId}"`)
}

/**
 * Sync an updated account to runtime.
 * The gateway hot-reloads on config file change — no restart needed.
 */
export async function syncUpdatedProviderToRuntime(
  account: ProviderAccount,
  _apiKey: string | undefined,
  deps: { processManager: OpenClawProcessManager; state: RuntimeState; refreshSetup: () => Promise<void> },
): Promise<void> {
  await syncAllProvidersToRuntime()
  await syncRoutingProfilesAfterProviderChange()
  await deps.refreshSetup()
  await autoStartIfStopped(deps, `provider update "${account.vendorId}"`)
}

/**
 * Remove a deleted provider from runtime.
 * The gateway hot-reloads on config file change — no restart needed.
 */
export async function syncDeletedProviderToRuntime(
  _accountId: string,
  deps: { processManager: OpenClawProcessManager; state: RuntimeState; refreshSetup: () => Promise<void> },
): Promise<void> {
  await syncAllProvidersToRuntime()
  await syncRoutingProfilesAfterProviderChange()
  await deps.refreshSetup()
  mainLogger.info('[provider-sync] Config written; gateway will hot-reload')
}

/**
 * Sync default provider/model change.
 * The gateway hot-reloads `models.*` and `agents.defaults.model` paths — no restart needed.
 */
export async function syncDefaultProviderToRuntime(
  account: ProviderAccount,
  deps: { processManager: OpenClawProcessManager; state: RuntimeState; refreshSetup: () => Promise<void> },
): Promise<void> {
  const runtimeKey = getOpenClawProviderKey(account)
  const modelRef = account.model
    ? (account.model.includes('/') ? account.model : `${runtimeKey}/${account.model}`)
    : runtimeKey

  await writeDefaultModel(modelRef)
  await deps.refreshSetup()
  await autoStartIfStopped(deps, `default provider "${account.vendorId}"`)
}

// ── Internal helpers ──

function resolveModelsForAccount(
  account: ProviderAccount,
): Array<{ id: string; name: string }> | undefined {
  const definition = getProviderDefinition(account.vendorId)
  const builtinModels = definition?.providerConfig?.models

  if (account.model) {
    return [{ id: account.model, name: account.model }]
  }
  if (builtinModels && builtinModels.length > 0) {
    return builtinModels.map((m) => ({ id: m.id, name: m.name }))
  }
  return undefined
}

/**
 * Auto-start the gateway if it is stopped and setup is complete.
 * When the gateway is already RUNNING, config changes are picked up
 * automatically via chokidar file watcher → hot reload.
 */
async function autoStartIfStopped(
  deps: { processManager: OpenClawProcessManager; state: RuntimeState },
  reason: string,
): Promise<void> {
  const { status } = deps.state.snapshot
  if (
    (status === 'STOPPED' || status === 'ERROR') &&
    deps.state.snapshot.setup.hasProvider &&
    deps.state.snapshot.setup.hasDefaultModel
  ) {
    mainLogger.info(`[provider-sync] Auto-starting gateway: ${reason}`)
    deps.processManager.start().catch((e) => mainLogger.error('auto-start failed:', e))
  } else if (status === 'RUNNING') {
    mainLogger.info(`[provider-sync] Config written; gateway will hot-reload (${reason})`)
  }
}

/**
 * Re-sync routing profiles to the Gateway format after provider changes.
 * This ensures agents.list + bindings stay consistent with any model changes.
 *
 * Reads routing config directly from openclaw.json to avoid circular imports
 * with RoutingService (which imports syncAllProvidersToRuntime).
 */
export async function syncRoutingProfilesAfterProviderChange(): Promise<void> {
  try {
    const raw = await readRoutingConfig()
    const profiles = raw.profiles && typeof raw.profiles === 'object'
      ? Object.entries(raw.profiles).map(([id, v]) => {
        const p = v as Record<string, unknown>
        return {
          id,
          name: typeof p.name === 'string' ? p.name : id,
          modelRef: typeof p.modelRef === 'string' ? p.modelRef : null,
          workspacePath: typeof p.workspacePath === 'string' ? p.workspacePath : undefined,
        }
      })
      : []

    const routes = Array.isArray(raw.routes)
      ? (raw.routes as Array<Record<string, unknown>>)
        .filter((r) => typeof r.channelType === 'string' && typeof r.accountId === 'string' && typeof r.profileId === 'string')
        .map((r) => ({
          channelType: r.channelType as string,
          accountId: r.accountId as string,
          profileId: r.profileId as string,
        }))
      : []

    await syncRoutingToGatewayFormat(profiles, routes)
    mainLogger.info('[provider-sync] Re-synced routing profiles to gateway format')
  } catch (err) {
    mainLogger.warn('[provider-sync] Failed to re-sync routing profiles:', err)
  }
}
