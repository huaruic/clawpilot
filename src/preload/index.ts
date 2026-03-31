import { contextBridge, ipcRenderer } from 'electron'
import type { RuntimeSnapshot } from '../main/state/RuntimeState'
import type { AppSettings } from '../main/services/AppSettingsStore'

contextBridge.exposeInMainWorld('clawpilot', {
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
    onStatusChange: (cb: (snap: RuntimeSnapshot) => void): (() => void) => {
      const handler = (_: Electron.IpcRendererEvent, snap: RuntimeSnapshot): void => cb(snap)
      ipcRenderer.on('app:status-changed', handler)
      return () => ipcRenderer.removeListener('app:status-changed', handler)
    },
  },

  // ── Chat ─────────────────────────────────────────────────────────
  chat: {
    send: (params: { sessionKey: string; message: string }): Promise<unknown> =>
      ipcRenderer.invoke('chat:send', params),
    history: (params: { sessionKey: string; limit?: number }): Promise<unknown> =>
      ipcRenderer.invoke('chat:history', params),
    sessions: (): Promise<unknown> =>
      ipcRenderer.invoke('chat:sessions'),
    onChunk: (cb: (chunk: unknown) => void): (() => void) => {
      const handler = (_: Electron.IpcRendererEvent, chunk: unknown): void => cb(chunk)
      ipcRenderer.on('chat:chunk', handler)
      return () => ipcRenderer.removeListener('chat:chunk', handler)
    },
  },

  // ── Providers ────────────────────────────────────────────────────
  provider: {
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
    test: (params: { baseUrl: string; apiKey: string }): Promise<{
      ok: boolean
      status?: number
      models?: string[]
      error?: string
    }> => ipcRenderer.invoke('provider:test', params),
  },

  channels: {
    validateFeishuCredentials: (params: { appId: string; appSecret: string }): Promise<unknown> =>
      ipcRenderer.invoke('channels:feishu:validateCredentials', params),
    getFeishuConfig: (): Promise<unknown> => ipcRenderer.invoke('channels:feishu:getConfig'),
    saveFeishuConfig: (params: { appId: string; appSecret: string }): Promise<unknown> =>
      ipcRenderer.invoke('channels:feishu:saveConfig', params),
    resetFeishu: (): Promise<unknown> => ipcRenderer.invoke('channels:feishu:reset'),
    getLatestPairing: (): Promise<unknown> => ipcRenderer.invoke('channels:feishu:getLatestPairing'),
    approvePairing: (params: { code: string }): Promise<unknown> =>
      ipcRenderer.invoke('channels:feishu:approvePairing', params),
  },

  skills: {
    list: (): Promise<unknown> => ipcRenderer.invoke('skills:list'),
    setEnabled: (params: { skillKey: string; enabled: boolean }): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke('skills:setEnabled', params),
    delete: (params: { skillKey: string }): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke('skills:delete', params),
  },

  ollama: {
    status: (): Promise<unknown> => ipcRenderer.invoke('ollama:status'),
    pullRecommended: (): Promise<{ ok: boolean }> => ipcRenderer.invoke('ollama:pullRecommended'),
    openInstallPage: (): Promise<{ ok: boolean }> => ipcRenderer.invoke('ollama:openInstallPage'),
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
