import { contextBridge, ipcRenderer } from 'electron'
import type { RuntimeSnapshot } from '../main/state/RuntimeState'
import type { AppSettings } from '../main/services/AppSettingsStore'

contextBridge.exposeInMainWorld('catclaw', {
  // ── Runtime ──────────────────────────────────────────────────────
  app: {
    start: (): Promise<RuntimeSnapshot> => ipcRenderer.invoke('app:start'),
    stop: (): Promise<RuntimeSnapshot> => ipcRenderer.invoke('app:stop'),
    restart: (): Promise<RuntimeSnapshot> => ipcRenderer.invoke('app:restart'),
    status: (): Promise<RuntimeSnapshot> => ipcRenderer.invoke('app:status'),
    getGatewayToken: (): Promise<string> => ipcRenderer.invoke('app:getGatewayToken'),
    getSettings: (): Promise<AppSettings> => ipcRenderer.invoke('app:getSettings'),
    updateSettings: (patch: Partial<AppSettings>): Promise<AppSettings> =>
      ipcRenderer.invoke('app:updateSettings', { patch }),
    getSystemLocale: (): Promise<string> => ipcRenderer.invoke('app:getSystemLocale'),
    showSaveDialog: (params?: {
      title?: string
      defaultPath?: string
      filters?: Array<{ name: string; extensions: string[] }>
    }): Promise<string | null> => ipcRenderer.invoke('app:showSaveDialog', params ?? {}),
    chooseWorkspaceRoot: (): Promise<string | null> => ipcRenderer.invoke('app:chooseWorkspaceRoot'),
    setWorkspaceRoot: (workspaceRoot: string): Promise<RuntimeSnapshot> =>
      ipcRenderer.invoke('app:setWorkspaceRoot', { workspaceRoot }),
    resetWorkspaceRoot: (): Promise<RuntimeSnapshot> =>
      ipcRenderer.invoke('app:resetWorkspaceRoot'),
    openDirectory: (path: string): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke('app:openDirectory', { path }),
    onStatusChange: (cb: (snap: RuntimeSnapshot) => void): (() => void) => {
      const handler = (_: Electron.IpcRendererEvent, snap: RuntimeSnapshot): void => cb(snap)
      ipcRenderer.on('app:status-changed', handler)
      return () => ipcRenderer.removeListener('app:status-changed', handler)
    },
  },

  // ── Chat ─────────────────────────────────────────────────────────
  chat: {
    send: (params: {
      sessionKey: string
      message: string
      attachments?: Array<{ content: string; mimeType: string; fileName: string }>
    }): Promise<unknown> => ipcRenderer.invoke('chat:send', params),
    history: (params: { sessionKey: string; limit?: number }): Promise<unknown> =>
      ipcRenderer.invoke('chat:history', params),
    sessions: (): Promise<unknown> =>
      ipcRenderer.invoke('chat:sessions'),
    abort: (params: { sessionKey: string; runId?: string }): Promise<unknown> =>
      ipcRenderer.invoke('chat:abort', params),
    deleteSession: (params: { sessionKey: string }): Promise<unknown> =>
      ipcRenderer.invoke('chat:deleteSession', params),
    resetSession: (params: { sessionKey: string }): Promise<unknown> =>
      ipcRenderer.invoke('chat:resetSession', params),
    agents: (): Promise<unknown> =>
      ipcRenderer.invoke('chat:agents'),
    onChunk: (cb: (chunk: unknown) => void): (() => void) => {
      const handler = (_: Electron.IpcRendererEvent, chunk: unknown): void => cb(chunk)
      ipcRenderer.on('chat:chunk', handler)
      return () => ipcRenderer.removeListener('chat:chunk', handler)
    },
  },

  // ── File Operations ─────────────────────────────────────────────
  file: {
    readAsBase64: (filePath: string): Promise<{
      content: string
      mimeType: string
      fileName: string
      fileSize: number
    }> => ipcRenderer.invoke('file:readAsBase64', filePath),
  },

  // ── Providers (new account-based API) ────────────────────────────
  provider: {
    // New account-based API
    listVendors: (): Promise<unknown[]> =>
      ipcRenderer.invoke('provider:listVendors'),
    listAccounts: (): Promise<unknown[]> =>
      ipcRenderer.invoke('provider:listAccounts'),
    createAccount: (params: { account: unknown; apiKey?: string }): Promise<unknown> =>
      ipcRenderer.invoke('provider:createAccount', params),
    updateAccount: (params: { accountId: string; updates: unknown; apiKey?: string }): Promise<unknown> =>
      ipcRenderer.invoke('provider:updateAccount', params),
    deleteAccount: (params: { accountId: string }): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke('provider:deleteAccount', params),
    setDefaultAccount: (params: { accountId: string }): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke('provider:setDefaultAccount', params),
    getDefaultAccount: (): Promise<string | null> =>
      ipcRenderer.invoke('provider:getDefaultAccount'),
    validate: (params: {
      providerType: string
      apiKey: string
      baseUrl?: string
      apiProtocol?: string
    }): Promise<unknown> =>
      ipcRenderer.invoke('provider:validate', params),
    getAccountKey: (params: { accountId: string }): Promise<string> =>
      ipcRenderer.invoke('provider:getAccountKey', params),
    hasAccountKey: (params: { accountId: string }): Promise<boolean> =>
      ipcRenderer.invoke('provider:hasAccountKey', params),
    oauthStart: (params: {
      provider: string
      region?: 'global' | 'cn'
      accountId?: string
      label?: string
    }): Promise<unknown> =>
      ipcRenderer.invoke('provider:oauthStart', params),
    oauthCancel: (): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke('provider:oauthCancel'),
    onOAuthEvent: (cb: (event: string, data: unknown) => void): (() => void) => {
      const events = ['oauth:start', 'oauth:code', 'oauth:success', 'oauth:error'] as const
      const handlers = events.map((evt) => {
        const handler = (_: Electron.IpcRendererEvent, data: unknown): void => cb(evt, data)
        ipcRenderer.on(evt, handler)
        return () => ipcRenderer.removeListener(evt, handler)
      })
      return () => handlers.forEach((unsub) => unsub())
    },

    // Legacy API (deprecated)
    list: (): Promise<unknown[]> =>
      ipcRenderer.invoke('provider:list'),
    save: (params: {
      name: string
      baseUrl: string
      apiKey: string
      api?: string
      models?: Array<{ id: string; name?: string }>
    }): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke('provider:save', params),
    delete: (name: string): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke('provider:delete', { name }),
    getDefault: (): Promise<string> =>
      ipcRenderer.invoke('provider:getDefault'),
    setDefault: (model: string): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke('provider:setDefault', { model }),
    getKey: (name: string): Promise<string> =>
      ipcRenderer.invoke('provider:getKey', { name }),
    test: (params: { baseUrl: string; apiKey: string }): Promise<{
      ok: boolean
      status?: number
      models?: string[]
      error?: string
    }> => ipcRenderer.invoke('provider:test', params),
  },

  channels: {
    // Generic channel API
    getConfig: (params: { channelType: string }): Promise<unknown> =>
      ipcRenderer.invoke('channels:getConfig', params),
    saveConfig: (params: { channelType: string; values: Record<string, string> }): Promise<unknown> =>
      ipcRenderer.invoke('channels:saveConfig', params),
    deleteConfig: (params: { channelType: string }): Promise<unknown> =>
      ipcRenderer.invoke('channels:deleteConfig', params),
    validateCredentials: (params: { channelType: string; values: Record<string, string> }): Promise<unknown> =>
      ipcRenderer.invoke('channels:validateCredentials', params),
    listConfigured: (): Promise<unknown> =>
      ipcRenderer.invoke('channels:listConfigured'),
  },

  // ── Routing (Agent Profiles) ─────────────────────────────────────
  routing: {
    listProfiles: (): Promise<unknown> =>
      ipcRenderer.invoke('routing:listProfiles'),
    createProfile: (params: {
      name: string
      modelRef?: string
      inheritWorkspace?: boolean
      channelBindings?: Array<{ channelType: string; accountId: string }>
    }): Promise<unknown> =>
      ipcRenderer.invoke('routing:createProfile', params),
    updateProfile: (params: {
      id: string
      name?: string
      modelRef?: string | null
    }): Promise<unknown> =>
      ipcRenderer.invoke('routing:updateProfile', params),
    deleteProfile: (params: { id: string }): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke('routing:deleteProfile', params),
    getRoute: (params: { channelType: string; accountId: string }): Promise<unknown> =>
      ipcRenderer.invoke('routing:getRoute', params),
    setRoute: (params: {
      channelType: string
      accountId: string
      profileId: string
    }): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke('routing:setRoute', params),
    clearRoute: (params: {
      channelType: string
      accountId: string
    }): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke('routing:clearRoute', params),
  },

  skills: {
    list: (): Promise<unknown> => ipcRenderer.invoke('skills:list'),
    setEnabled: (params: { skillKey: string; enabled: boolean }): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke('skills:setEnabled', params),
    delete: (params: { skillKey: string }): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke('skills:delete', params),
    curatedRegistry: (): Promise<unknown> => ipcRenderer.invoke('skills:curatedRegistry'),
  },

  // ── Dashboard (Usage Analytics) ─────────────────────────────────────
  dashboard: {
    getUsage: (params?: { since?: number }): Promise<unknown> =>
      ipcRenderer.invoke('dashboard:getUsage', params ?? {}),
    refresh: (): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke('dashboard:refresh'),
    onUpdated: (cb: () => void): (() => void) => {
      const handler = (): void => cb()
      ipcRenderer.on('dashboard:updated', handler)
      return () => ipcRenderer.removeListener('dashboard:updated', handler)
    },
  },

  // ── Diagnostics ──────────────────────────────────────────────────────
  diagnostics: {
    run: (): Promise<unknown> => ipcRenderer.invoke('diagnostics:run'),
    quickCheck: (): Promise<{ healthy: boolean; criticalIssues: unknown[] }> =>
      ipcRenderer.invoke('diagnostics:quickCheck'),
    fix: (issue: unknown): Promise<{ success: boolean; message: string; output?: string }> =>
      ipcRenderer.invoke('diagnostics:fix', issue),
    exportBundle: (params: { outputPath: string }): Promise<void> =>
      ipcRenderer.invoke('diagnostics:exportBundle', params),
  },
})
