export type RuntimeStatus = 'STOPPED' | 'STARTING' | 'RUNNING' | 'ERROR' | 'UPDATING'
export type SetupPhase = 'gateway_setup' | 'model_setup' | 'bootstrap' | 'ready'
export type AppLanguage = 'system' | 'zh-CN' | 'en'

export interface AppSettings {
  language: AppLanguage
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
}

export interface ChatEvent {
  runId: string
  sessionKey: string
  seq: number
  state: 'delta' | 'final' | 'aborted' | 'error'
  message?: unknown
  errorMessage?: string
}

export interface ProviderInfo {
  name: string
  baseUrl: string
  api?: string
  models: Array<{ id: string; name?: string }>
}

export interface OllamaStatus {
  installed: boolean
  running: boolean
  recommendedModel: string
  recommendedInstalled: boolean
  availableModels: string[]
  downloading: boolean
  downloadProgress: number
  downloadLog: string[]
  error?: string
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

export interface LogEntry {
  timestamp: number
  level: 'debug' | 'info' | 'warn' | 'error'
  message: string
  source?: string
  details?: Record<string, unknown>
}

export interface LogFile {
  name: string
  path: string
  size: number
  mtime: number
}

export interface SessionUsageSummary {
  agentId: string
  sessionId: string
  sessionKey?: string
  model?: string
  startedAt?: number
  updatedAt: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
  costCny: number
  entries: number
}

export interface ModelUsageSummary {
  model: string
  sessionCount: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
  costCny: number
  lastUpdatedAt: number
}

export interface MessageUsageEntry {
  agentId: string
  sessionId: string
  sessionKey?: string
  messageId?: string
  role?: string
  model?: string
  timestamp: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
  cacheReadTokens: number
  costCny: number
  textPreview?: string
}

export interface MessageUsagePage {
  total: number
  items: MessageUsageEntry[]
}

export interface UsageBreakdownRow {
  key: string
  label: string
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  totalTokens: number
}

export interface FeishuConfigInfo {
  enabled: boolean
  connectionMode: 'websocket' | 'webhook'
  dmPolicy: string
  defaultAccount: string
  appId: string
  appSecret: string
  runtimeRunning: boolean
}

export interface FeishuPairingRequest {
  id: string
  code: string
  createdAt: string
  lastSeenAt?: string
  meta?: Record<string, unknown>
}

export interface FeishuValidationInfo {
  ok: boolean
  error?: string
  botOpenId?: string
  botName?: string
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

export interface ClawPilotAPI {
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
    onStatusChange: (cb: (snap: RuntimeSnapshot) => void) => () => void
  }
  chat: {
    send: (params: { sessionKey: string; message: string }) => Promise<unknown>
    history: (params: { sessionKey: string; limit?: number }) => Promise<unknown>
    sessions: () => Promise<unknown>
    onChunk: (cb: (chunk: ChatEvent) => void) => () => void
  }
  provider: {
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
    test: (params: { baseUrl: string; apiKey: string }) => Promise<{
      ok: boolean
      status?: number
      models?: string[]
      error?: string
    }>
  }
  channels: {
    validateFeishuCredentials: (params: { appId: string; appSecret: string }) => Promise<FeishuValidationInfo>
    getFeishuConfig: () => Promise<FeishuConfigInfo>
    saveFeishuConfig: (params: { appId: string; appSecret: string }) => Promise<{
      ok: boolean
      runtimeRestarted: boolean
    }>
    resetFeishu: () => Promise<{
      ok: boolean
      runtimeRestarted: boolean
    }>
    getLatestPairing: () => Promise<{
      ok: boolean
      request?: FeishuPairingRequest | null
      error?: string
    }>
    approvePairing: (params: { code: string }) => Promise<{
      ok: boolean
      message?: string
      error?: string
    }>
  }
  skills: {
    list: () => Promise<SkillsListResult>
    setEnabled: (params: { skillKey: string; enabled: boolean }) => Promise<{ ok: boolean }>
    delete: (params: { skillKey: string }) => Promise<{ ok: boolean }>
  }
  ollama: {
    status: () => Promise<OllamaStatus>
    pullRecommended: () => Promise<{ ok: boolean }>
    openInstallPage: () => Promise<{ ok: boolean }>
  }
  diagnostics: {
    run: () => Promise<DiagnosticReport>
    quickCheck: () => Promise<{ healthy: boolean; criticalIssues: DiagnosticIssue[] }>
    fix: (issue: DiagnosticIssue) => Promise<DiagnosticFixResult>
    exportBundle: (params: { outputPath: string }) => Promise<void>
  }
  logs: {
    list: () => Promise<LogFile[]>
    readFile: (params: { filename: string; limit?: number; offset?: number }) => Promise<string>
    parse: (params: { filename: string; limit?: number; level?: LogEntry['level'] }) => Promise<LogEntry[]>
    search: (params: {
      query: string
      files?: string[]
      level?: LogEntry['level']
      limit?: number
    }) => Promise<Array<LogEntry & { file: string }>>
    recent: (params: { limit?: number; level?: LogEntry['level'] }) => Promise<LogEntry[]>
    clean: (params: { keepDays?: number; keepCount?: number }) => Promise<number>
    export: (params: {
      outputPath: string
      files?: string[]
      level?: LogEntry['level']
    }) => Promise<void>
  }
  usage: {
    listSessions: (params?: { agentId?: string; limit?: number; since?: number; until?: number }) => Promise<SessionUsageSummary[]>
    aggregateByModel: (params?: { agentId?: string; since?: number; until?: number }) => Promise<ModelUsageSummary[]>
    listMessages: (params?: { agentId?: string; limit?: number; offset?: number; since?: number; until?: number }) => Promise<MessageUsagePage>
    breakdownByModel: (params?: { agentId?: string; since?: number; until?: number }) => Promise<UsageBreakdownRow[]>
    breakdownByDay: (params?: { agentId?: string; since?: number; until?: number }) => Promise<UsageBreakdownRow[]>
  }
}

declare global {
  interface Window {
    clawpilot: ClawPilotAPI
  }
}
