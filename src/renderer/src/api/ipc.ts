export type RuntimeStatus = 'STOPPED' | 'STARTING' | 'RUNNING' | 'ERROR' | 'UPDATING'
export type RuntimeHealth = 'ok' | 'degraded' | 'error'
export type SetupPhase = 'gateway_setup' | 'model_setup' | 'bootstrap' | 'ready'
export type AppLanguage = 'system' | 'zh-CN' | 'en'
export type AppTheme = 'system' | 'light' | 'dark'

export interface AppSettings {
  language: AppLanguage
  theme: AppTheme
}

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

export interface RuntimeSnapshot {
  status: RuntimeStatus
  pid?: number
  error?: string
  port: number
  startedAt?: number
  setup: OpenClawSetup
  lastFailureReason?: string
  lastFailureAt?: number
  lastHealthAt?: number
  healthStatus?: RuntimeHealth
  wsConnected?: boolean
}

// ChatEvent is the canonical type — re-exported from types/chat.ts
export type { ChatEvent } from '../types/chat'

// Re-export shared provider types for renderer use
export type {
  ProviderType,
  ProviderProtocol,
  ProviderAuthMode,
  ProviderDefinition,
  ProviderAccount,
  ProviderSecret,
} from '../../../shared/providers/types'

// Re-export shared routing types for renderer use
export type {
  RoutingProfile,
  ChannelRoute,
  RoutingSnapshot,
} from '../../../shared/types/routing'

/** @deprecated Use ProviderAccount instead */
export interface ProviderInfo {
  name: string
  baseUrl: string
  api?: string
  models: Array<{ id: string; name?: string }>
}

export interface ValidationResult {
  valid: boolean
  error?: string
  status?: number
}

export interface DiagnosticIssue {
  category: 'runtime' | 'config' | 'provider' | 'channel' | 'skill' | 'workspace'
  severity: 'error' | 'warning' | 'info'
  title: string
  description: string
  details?: string
  fixable: boolean
  fixCommand?: string
}

export interface DiagnosticReport {
  timestamp: number
  overallStatus: 'healthy' | 'warning' | 'error'
  issues: DiagnosticIssue[]
  systemInfo: {
    platform: string
    nodeVersion: string
    openclawVersion?: string
    stateDir: string
  }
}

export interface DiagnosticFixResult {
  success: boolean
  message: string
  output?: string
}

// --- Generic channel types ---

export interface ChannelConfigInfo {
  channelType: string
  enabled: boolean
  values: Record<string, string>
  runtimeRunning: boolean
}

export interface ChannelValidationResult {
  ok: boolean
  error?: string
  meta?: Record<string, unknown>
}

export interface ConfiguredChannel {
  type: string
  enabled: boolean
}

export interface SkillInfo {
  skillKey: string
  name: string
  description?: string
  emoji?: string
  homepage?: string
  source: string
  enabled: boolean
  canDelete: boolean
  path: string
}

export interface SkillsListResult {
  summary: {
    total: number
    enabled: number
    builtIn: number
    local: number
  }
  skills: SkillInfo[]
}

export interface CatClawAPI {
  app: {
    start: () => Promise<RuntimeSnapshot>
    stop: () => Promise<RuntimeSnapshot>
    restart: () => Promise<RuntimeSnapshot>
    status: () => Promise<RuntimeSnapshot>
    getGatewayToken: () => Promise<string>
    getSettings: () => Promise<AppSettings>
    updateSettings: (patch: Partial<AppSettings>) => Promise<AppSettings>
    getSystemLocale: () => Promise<string>
    showSaveDialog: (params?: {
      title?: string
      defaultPath?: string
      filters?: Array<{ name: string; extensions: string[] }>
    }) => Promise<string | null>
    chooseWorkspaceRoot: () => Promise<string | null>
    setWorkspaceRoot: (workspaceRoot: string) => Promise<RuntimeSnapshot>
    resetWorkspaceRoot: () => Promise<RuntimeSnapshot>
    openDirectory: (path: string) => Promise<{ ok: boolean; error?: string }>
    onStatusChange: (cb: (snap: RuntimeSnapshot) => void) => () => void
  }
  chat: {
    send: (params: {
      sessionKey: string
      message: string
      attachments?: Array<{ content: string; mimeType: string; fileName: string }>
    }) => Promise<unknown>
    history: (params: { sessionKey: string; limit?: number }) => Promise<unknown>
    sessions: () => Promise<unknown>
    abort: (params: { sessionKey: string; runId?: string }) => Promise<unknown>
    deleteSession: (params: { sessionKey: string }) => Promise<unknown>
    resetSession: (params: { sessionKey: string }) => Promise<unknown>
    agents: () => Promise<unknown>
    onChunk: (cb: (chunk: ChatEvent) => void) => () => void
  }
  file: {
    readAsBase64: (filePath: string) => Promise<{
      content: string
      mimeType: string
      fileName: string
      fileSize: number
    }>
  }
  provider: {
    // New account-based API
    listVendors: () => Promise<import('../../../shared/providers/types').ProviderDefinition[]>
    listAccounts: () => Promise<import('../../../shared/providers/types').ProviderAccount[]>
    createAccount: (params: {
      account: Omit<import('../../../shared/providers/types').ProviderAccount, 'createdAt' | 'updatedAt'>
      apiKey?: string
    }) => Promise<{ ok: boolean; account: import('../../../shared/providers/types').ProviderAccount }>
    updateAccount: (params: {
      accountId: string
      updates: Partial<import('../../../shared/providers/types').ProviderAccount>
      apiKey?: string
    }) => Promise<{ ok: boolean; account: import('../../../shared/providers/types').ProviderAccount }>
    deleteAccount: (params: { accountId: string }) => Promise<{ ok: boolean }>
    setDefaultAccount: (params: { accountId: string }) => Promise<{ ok: boolean }>
    getDefaultAccount: () => Promise<string | null>
    validate: (params: {
      providerType: string
      apiKey: string
      baseUrl?: string
      apiProtocol?: string
    }) => Promise<ValidationResult>
    getAccountKey: (params: { accountId: string }) => Promise<string>
    hasAccountKey: (params: { accountId: string }) => Promise<boolean>
    oauthStart: (params: {
      provider: string
      region?: 'global' | 'cn'
      accountId?: string
      label?: string
    }) => Promise<{ ok: boolean; error?: string }>
    oauthCancel: () => Promise<{ ok: boolean }>
    onOAuthEvent: (cb: (event: string, data: unknown) => void) => () => void

    // Legacy API (deprecated)
    list: () => Promise<ProviderInfo[]>
    save: (params: {
      name: string
      baseUrl: string
      apiKey: string
      api?: string
      models?: Array<{ id: string; name?: string }>
    }) => Promise<{ ok: boolean }>
    delete: (name: string) => Promise<{ ok: boolean }>
    getDefault: () => Promise<string>
    setDefault: (model: string) => Promise<{ ok: boolean }>
    getKey: (name: string) => Promise<string>
    test: (params: { baseUrl: string; apiKey: string }) => Promise<{
      ok: boolean
      status?: number
      models?: string[]
      error?: string
    }>
  }
  channels: {
    // Generic channel API
    getConfig: (params: { channelType: string }) => Promise<ChannelConfigInfo>
    saveConfig: (params: { channelType: string; values: Record<string, string> }) => Promise<{
      ok: boolean
      runtimeRestarted: boolean
    }>
    deleteConfig: (params: { channelType: string }) => Promise<{
      ok: boolean
      runtimeRestarted: boolean
    }>
    validateCredentials: (params: { channelType: string; values: Record<string, string> }) => Promise<ChannelValidationResult>
    listConfigured: () => Promise<ConfiguredChannel[]>
  }
  routing: {
    listProfiles: () => Promise<RoutingSnapshot>
    createProfile: (params: {
      name: string
      modelRef?: string
      inheritWorkspace?: boolean
      channelBindings?: Array<{ channelType: string; accountId: string }>
    }) => Promise<RoutingProfile>
    updateProfile: (params: {
      id: string
      name?: string
      modelRef?: string | null
    }) => Promise<RoutingProfile>
    deleteProfile: (params: { id: string }) => Promise<{ ok: boolean }>
    getRoute: (params: { channelType: string; accountId: string }) => Promise<ChannelRoute | null>
    setRoute: (params: {
      channelType: string
      accountId: string
      profileId: string
    }) => Promise<{ ok: boolean }>
    clearRoute: (params: {
      channelType: string
      accountId: string
    }) => Promise<{ ok: boolean }>
  }
  skills: {
    list: () => Promise<SkillsListResult>
    setEnabled: (params: { skillKey: string; enabled: boolean }) => Promise<{ ok: boolean }>
    delete: (params: { skillKey: string }) => Promise<{ ok: boolean }>
  }
  dashboard: {
    getUsage: (params?: { since?: number }) => Promise<import('../types/dashboard').UsageStoreData>
    refresh: () => Promise<{ ok: boolean; error?: string }>
    onUpdated: (cb: () => void) => () => void
  }
  diagnostics: {
    run: () => Promise<DiagnosticReport>
    quickCheck: () => Promise<{ healthy: boolean; criticalIssues: DiagnosticIssue[] }>
    fix: (issue: DiagnosticIssue) => Promise<DiagnosticFixResult>
    exportBundle: (params: { outputPath: string }) => Promise<void>
  }
}

declare global {
  interface Window {
    catclaw: CatClawAPI
  }
}
