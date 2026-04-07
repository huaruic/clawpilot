import { ipcMain } from 'electron'
import {
  CreateAccountSchema,
  UpdateAccountSchema,
  DeleteAccountSchema,
  SetDefaultAccountSchema,
  ValidateKeySchema,
  OAuthStartSchema,
  SaveProviderSchema,
  TestProviderSchema,
  DeleteProviderSchema,
  SetDefaultModelSchema,
} from './schemas/provider.schema'
import { getProviderService, ProviderService } from '../services/ProviderService'
import { validateApiKeyWithProvider } from '../services/ProviderValidation'
import {
  syncSavedProviderToRuntime,
  syncUpdatedProviderToRuntime,
  syncDeletedProviderToRuntime,
  syncDefaultProviderToRuntime,
} from '../services/ProviderRuntimeSync'
import { ensureProviderStoreMigrated } from '../services/ProviderMigration'
import { deviceOAuthManager, type OAuthProviderType } from '../services/DeviceOAuthManager'
import { browserOAuthManager, type BrowserOAuthProviderType } from '../services/BrowserOAuthManager'
import type { OpenClawProcessManager } from '../services/OpenClawProcessManager'
import type { RuntimeState } from '../state/RuntimeState'

interface Deps {
  processManager: OpenClawProcessManager
  state: RuntimeState
  refreshSetup: () => Promise<void>
}

export function registerProviderIpc({ processManager, state, refreshSetup }: Deps): void {
  const service = getProviderService()
  const runtimeDeps = { processManager, state, refreshSetup }

  // ── New account-based channels ──

  ipcMain.handle('provider:listVendors', async () => {
    return service.listVendors()
  })

  ipcMain.handle('provider:listAccounts', async () => {
    await ensureProviderStoreMigrated()
    return service.listAccounts()
  })

  ipcMain.handle('provider:createAccount', async (_, raw) => {
    await ensureProviderStoreMigrated()
    const params = CreateAccountSchema.parse(raw)
    const now = new Date().toISOString()
    const account = await service.createAccount(
      { ...params.account, createdAt: now, updatedAt: now } as any,
      params.apiKey,
    )
    await syncSavedProviderToRuntime(account, params.apiKey, runtimeDeps)
    // If auto-defaulted, also sync the default model to runtime
    const currentDefault = await service.getDefaultAccountId()
    if (currentDefault === account.id) {
      await syncDefaultProviderToRuntime(account, runtimeDeps)
    }
    return { ok: true, account }
  })

  ipcMain.handle('provider:updateAccount', async (_, raw) => {
    await ensureProviderStoreMigrated()
    const params = UpdateAccountSchema.parse(raw)
    const account = await service.updateAccount(params.accountId, params.updates, params.apiKey)
    await syncUpdatedProviderToRuntime(account, params.apiKey, runtimeDeps)
    return { ok: true, account }
  })

  ipcMain.handle('provider:deleteAccount', async (_, raw) => {
    await ensureProviderStoreMigrated()
    const { accountId } = DeleteAccountSchema.parse(raw)
    await service.deleteAccount(accountId)
    await syncDeletedProviderToRuntime(accountId, runtimeDeps)
    return { ok: true }
  })

  ipcMain.handle('provider:setDefaultAccount', async (_, raw) => {
    await ensureProviderStoreMigrated()
    const { accountId } = SetDefaultAccountSchema.parse(raw)
    await service.setDefaultAccount(accountId)
    const account = await service.getAccount(accountId)
    if (account) {
      await syncDefaultProviderToRuntime(account, runtimeDeps)
    }
    return { ok: true }
  })

  ipcMain.handle('provider:getDefaultAccount', async () => {
    await ensureProviderStoreMigrated()
    return service.getDefaultAccountId() ?? null
  })

  ipcMain.handle('provider:validate', async (_, raw) => {
    const params = ValidateKeySchema.parse(raw)
    return validateApiKeyWithProvider(params.providerType, params.apiKey, {
      baseUrl: params.baseUrl,
      apiProtocol: params.apiProtocol,
    })
  })

  ipcMain.handle('provider:getAccountKey', async (_, raw) => {
    await ensureProviderStoreMigrated()
    const { accountId } = raw as { accountId: string }
    return (await service.getAccountApiKey(accountId)) ?? ''
  })

  ipcMain.handle('provider:hasAccountKey', async (_, raw) => {
    await ensureProviderStoreMigrated()
    const { accountId } = raw as { accountId: string }
    return service.hasAccountKey(accountId)
  })

  ipcMain.handle('provider:oauthStart', async (_, raw) => {
    const params = OAuthStartSchema.parse(raw)
    const provider = params.provider

    const deviceOAuthTypes: OAuthProviderType[] = ['minimax-portal', 'minimax-portal-cn', 'qwen-portal']
    const browserOAuthTypes: BrowserOAuthProviderType[] = ['google', 'openai']

    if (deviceOAuthTypes.includes(provider as OAuthProviderType)) {
      const region = provider === 'minimax-portal-cn' ? 'cn' as const : (params.region ?? 'global' as const)
      const accountId = params.accountId ?? provider
      const ok = await deviceOAuthManager.startFlow(provider as OAuthProviderType, region, {
        accountId,
        label: params.label,
      })
      if (ok) {
        const account = await service.getAccount(accountId)
        if (account) {
          await syncSavedProviderToRuntime(account, undefined, runtimeDeps)
          const currentDefault = await service.getDefaultAccountId()
          if (currentDefault === accountId) {
            await syncDefaultProviderToRuntime(account, runtimeDeps)
          }
        }
      }
      return { ok }
    }

    if (browserOAuthTypes.includes(provider as BrowserOAuthProviderType)) {
      const accountId = params.accountId ?? provider
      const ok = await browserOAuthManager.startFlow(provider as BrowserOAuthProviderType, {
        accountId,
        label: params.label,
      })
      if (ok) {
        const account = await service.getAccount(accountId)
        if (account) {
          await syncSavedProviderToRuntime(account, undefined, runtimeDeps)
          const currentDefault = await service.getDefaultAccountId()
          if (currentDefault === accountId) {
            await syncDefaultProviderToRuntime(account, runtimeDeps)
          }
        }
      }
      return { ok }
    }

    return { ok: false, error: `Unknown OAuth provider: ${provider}` }
  })

  ipcMain.handle('provider:oauthCancel', async () => {
    await deviceOAuthManager.stopFlow()
    await browserOAuthManager.stopFlow()
    return { ok: true }
  })

  // ── Legacy channels (deprecated, delegates to new service) ──

  ipcMain.handle('provider:list', async () => {
    await ensureProviderStoreMigrated()
    const accounts = await service.listAccounts()
    // Return in old ProviderInfo format for backward compat
    return accounts.map((a) => ({
      name: a.vendorId === 'custom' ? a.id : a.vendorId,
      baseUrl: a.baseUrl ?? '',
      api: a.apiProtocol,
      models: a.model ? [{ id: a.model, name: a.model }] : [],
    }))
  })

  ipcMain.handle('provider:save', async (_, raw) => {
    await ensureProviderStoreMigrated()
    const params = SaveProviderSchema.parse(raw)

    // Map legacy save to account-based create/update
    const existing = await service.getAccount(params.name)

    if (existing) {
      const account = await service.updateAccount(params.name, {
        baseUrl: params.baseUrl,
        apiProtocol: params.api as any,
      }, params.apiKey)
      await syncUpdatedProviderToRuntime(account, params.apiKey, runtimeDeps)
    } else {
      const account = ProviderService.buildAccount({
        id: params.name,
        vendorId: params.name as any,
        label: params.name,
        baseUrl: params.baseUrl,
        api: params.api,
      })
      const created = await service.createAccount(account, params.apiKey)
      await syncSavedProviderToRuntime(created, params.apiKey, runtimeDeps)
    }

    return { ok: true }
  })

  ipcMain.handle('provider:delete', async (_, raw) => {
    await ensureProviderStoreMigrated()
    const { name } = DeleteProviderSchema.parse(raw)
    await service.deleteAccount(name)
    await syncDeletedProviderToRuntime(name, runtimeDeps)
    return { ok: true }
  })

  ipcMain.handle('provider:getDefault', async () => {
    await ensureProviderStoreMigrated()
    return (await service.getDefaultAccountId()) ?? ''
  })

  ipcMain.handle('provider:setDefault', async (_, raw) => {
    await ensureProviderStoreMigrated()
    const { model } = SetDefaultModelSchema.parse(raw)
    // Legacy format: "providerName" or "providerName/modelId"
    const providerName = model.split('/')[0]
    const account = await service.getAccount(providerName)
    if (account) {
      await service.setDefaultAccount(providerName)
      await syncDefaultProviderToRuntime(account, runtimeDeps)
    }
    return { ok: true }
  })

  ipcMain.handle('provider:getKey', async (_, raw) => {
    await ensureProviderStoreMigrated()
    const { name } = raw as { name: string }
    return (await service.getAccountApiKey(name)) ?? ''
  })

  ipcMain.handle('provider:test', async (_, raw) => {
    const params = TestProviderSchema.parse(raw)
    try {
      const url = `${params.baseUrl.replace(/\/$/, '')}/models`
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${params.apiKey}` },
        signal: AbortSignal.timeout(8000),
      })
      const text = await res.text()
      let models: string[] = []
      try {
        const data = JSON.parse(text) as { data?: Array<{ id: string }> }
        models = data.data?.map((m) => m.id) ?? []
      } catch { /* non-JSON response */ }
      return { ok: res.ok, status: res.status, models }
    } catch (err) {
      return { ok: false, error: String(err) }
    }
  })
}
