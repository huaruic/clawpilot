import type { ProviderAccount, ProviderType } from '../../shared/providers/types'
import { getProviderDefinition } from '../../shared/providers/registry'
import { BUILTIN_PROVIDER_TYPES } from '../../shared/providers/types'
import {
  saveProviderAccount,
  setDefaultProviderAccount,
  getSchemaVersion,
  setSchemaVersion,
} from './ProviderStore'
import { setProviderSecret } from './SecretStore'
import { loadProviderMeta, readDefaultModel } from './OpenClawConfigWriter'
import {
  loadApiKey,
  listProviderNames,
} from './ProviderSecretStore'
import { mainLogger } from '../utils/logger'

const TARGET_SCHEMA_VERSION = 1

/**
 * Name-to-vendorId mapping for Paris's legacy provider names.
 * Maps the `name` field used in old PRESETS to the new `ProviderType`.
 */
const LEGACY_NAME_TO_VENDOR: Record<string, ProviderType> = {
  anthropic: 'anthropic',
  openai: 'openai',
  google: 'google',
  openrouter: 'openrouter',
  moonshot: 'moonshot',
  'minimax-cn': 'minimax-portal-cn',
  siliconflow: 'siliconflow',
  minimax: 'minimax-portal',
  qwen: 'qwen-portal',
  bytedance: 'ark',
}

let migrationPromise: Promise<void> | null = null

/**
 * Ensure migration has run exactly once per process lifetime.
 * Safe to call from any code path — will deduplicate concurrent calls.
 */
export async function ensureProviderStoreMigrated(): Promise<void> {
  if (!migrationPromise) {
    migrationPromise = runMigration()
  }
  return migrationPromise
}

async function runMigration(): Promise<void> {
  const version = await getSchemaVersion()
  if (version >= TARGET_SCHEMA_VERSION) {
    return
  }

  mainLogger.info('[provider-migration] Starting migration from legacy provider data...')

  try {
    await migrateFromLegacyData()
    await setSchemaVersion(TARGET_SCHEMA_VERSION)
    mainLogger.info('[provider-migration] Migration completed successfully')
  } catch (err) {
    mainLogger.error('[provider-migration] Migration failed:', err)
    // Don't rethrow — allow the app to continue even if migration fails.
    // Users can re-add providers manually.
  }
}

async function migrateFromLegacyData(): Promise<void> {
  // Gather all known provider names from both secrets.json and openclaw.json metadata
  const [providerNames, providerMeta, defaultModel] = await Promise.all([
    listProviderNames(),
    loadProviderMeta(),
    readDefaultModel(),
  ])

  const metaMap = new Map(providerMeta.map((m) => [m.name, m]))
  const allNames = [...new Set([...providerNames, ...providerMeta.map((m) => m.name)])]

  if (allNames.length === 0) {
    mainLogger.info('[provider-migration] No legacy providers found, skipping migration')
    return
  }

  const defaultProviderName = defaultModel?.split('/')[0]
  let firstAccountId: string | undefined
  let defaultAccountId: string | undefined

  for (const name of allNames) {
    try {
      const vendorId = resolveVendorId(name)
      const definition = getProviderDefinition(vendorId)
      const meta = metaMap.get(name)

      // Build account ID: use vendorId for builtins, custom-{hash} for custom
      const accountId = vendorId === 'custom'
        ? `custom-${name.replace(/[^a-z0-9]/gi, '').slice(0, 8).padEnd(8, '0')}`
        : vendorId

      const account: ProviderAccount = {
        id: accountId,
        vendorId,
        label: definition?.name ?? name,
        authMode: definition?.defaultAuthMode ?? 'api_key',
        baseUrl: meta?.baseUrl,
        apiProtocol: (meta?.api as ProviderAccount['apiProtocol']) ?? definition?.providerConfig?.api,
        model: definition?.defaultModelId,
        enabled: true,
        isDefault: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      await saveProviderAccount(account)

      // Migrate API key
      const apiKey = await loadApiKey(name)
      if (apiKey) {
        await setProviderSecret({
          type: 'api_key',
          accountId,
          apiKey,
        })
      }

      if (!firstAccountId) {
        firstAccountId = accountId
      }

      if (name === defaultProviderName) {
        defaultAccountId = accountId
      }

      mainLogger.info(`[provider-migration] Migrated "${name}" → account "${accountId}" (vendor: ${vendorId})`)
    } catch (err) {
      mainLogger.warn(`[provider-migration] Failed to migrate provider "${name}":`, err)
      // Continue with remaining providers
    }
  }

  // Set default account
  const finalDefault = defaultAccountId ?? firstAccountId
  if (finalDefault) {
    await setDefaultProviderAccount(finalDefault)
    mainLogger.info(`[provider-migration] Set default account: "${finalDefault}"`)
  }
}

function resolveVendorId(legacyName: string): ProviderType {
  // Direct mapping from legacy preset names
  const mapped = LEGACY_NAME_TO_VENDOR[legacyName]
  if (mapped) return mapped

  // Check if it matches a builtin ProviderType directly
  if ((BUILTIN_PROVIDER_TYPES as readonly string[]).includes(legacyName)) {
    return legacyName as ProviderType
  }

  // Fall back to custom
  return 'custom'
}
