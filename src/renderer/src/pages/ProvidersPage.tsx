import React, { useEffect, useState } from 'react'
import { Trash2, Star, Pencil, Settings, LogIn, Eye, EyeOff, Key, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import { useI18n } from '../i18n/I18nProvider'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog'
import { toast } from 'sonner'
import {
  useProviderStore,
  getUnconfiguredVendors,
  getVendorForAccount,
} from '../stores/providerStore'
import type {
  ProviderAccount,
  ProviderDefinition,
  ProviderProtocol,
  ProviderType,
} from '../../../shared/providers/types'

/* ── Form state ── */

interface FormState {
  accountId: string
  vendorId: ProviderType
  label: string
  baseUrl: string
  apiKey: string
  apiProtocol: ProviderProtocol
  model: string
  headers: string // JSON string for custom headers
  isEditing: boolean
  vendor: ProviderDefinition | null
  authMode: 'api_key' | 'oauth'
  showAdvanced: boolean
}

const EMPTY_FORM: FormState = {
  accountId: '',
  vendorId: 'custom',
  label: '',
  baseUrl: '',
  apiKey: '',
  apiProtocol: 'openai-completions',
  model: '',
  headers: '',
  isEditing: false,
  vendor: null,
  authMode: 'api_key',
  showAdvanced: false,
}

/* ── Helpers ── */

function friendlyProviderError(error?: string): string {
  if (!error) return '连接失败，请检查 API Key 和 Base URL 是否正确'
  const msg = error.toLowerCase()
  if (msg.includes('401') || msg.includes('403') || msg.includes('unauthorized') || msg.includes('invalid'))
    return 'API Key 无效，请检查后重试'
  if (msg.includes('404')) return 'API 地址不正确，请检查 Base URL'
  if (msg.includes('429')) return '请求频率超限，请稍后重试'
  if (msg.includes('500') || msg.includes('502') || msg.includes('503'))
    return '服务暂时不可用，请稍后重试'
  if (msg.includes('econnrefused') || msg.includes('connect'))
    return '无法连接到服务器，请检查 Base URL 是否正确'
  if (msg.includes('timeout') || msg.includes('timed out'))
    return '连接超时，请检查网络或 Base URL'
  if (msg.includes('certificate') || msg.includes('ssl') || msg.includes('tls'))
    return 'SSL 证书验证失败，请检查 Base URL'
  return '连接失败，请检查 API Key 和 Base URL 是否正确'
}

function authModeBadge(mode: string): string {
  switch (mode) {
    case 'api_key': return 'API Key'
    case 'oauth_device': return 'OAuth'
    case 'oauth_browser': return 'OAuth'
    default: return mode
  }
}

/* ── Provider SVG Logos ── */

function AnthropicLogo(): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <path d="M13.827 3.52h3.603L24 20.48h-3.603l-6.57-16.96zm-7.258 0h3.767L16.906 20.48h-3.674l-1.476-3.93H5.036l-1.466 3.93H0L6.569 3.52zm.901 10.08h4.063l-2.03-5.42-2.033 5.42z" />
    </svg>
  )
}

function OpenAILogo(): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.998 5.998 0 0 0-3.998 2.9 6.042 6.042 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" />
    </svg>
  )
}

function GoogleLogo(): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5">
      <path d="M12 11h8.533c.044.385.067.78.067 1.184 0 2.734-.98 5.036-2.678 6.6-1.485 1.371-3.518 2.175-5.922 2.175A8.976 8.976 0 0 1 3 12 8.976 8.976 0 0 1 12 3.04c2.425 0 4.47.893 6.02 2.36l-2.445 2.445C14.59 6.89 13.38 6.44 12 6.44a5.56 5.56 0 0 0 0 11.12c2.58 0 4.35-1.53 4.73-3.56H12V11z" fill="currentColor" />
    </svg>
  )
}

function OpenRouterLogo(): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 2a8 8 0 1 1 0 16 8 8 0 0 1 0-16zm-2.5 4v8h2v-3h1.5l2 3h2.5l-2.5-3.5c1.17-.48 2-1.63 2-2.97 0-1.93-1.57-3.5-3.5-3.5h-4zm2 1.5h2a2 2 0 0 1 0 4h-2v-4z" />
    </svg>
  )
}

function MoonshotLogo(): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 1.5a8.5 8.5 0 0 1 0 17c-3.07 0-5.75-1.63-7.24-4.07A11.5 11.5 0 0 0 15.5 12 11.5 11.5 0 0 0 4.76 7.57 8.48 8.48 0 0 1 12 3.5z" />
    </svg>
  )
}

function MiniMaxLogo(): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <path d="M3 7h4l3 5 3-5h4l3 5 3-5h1v2l-4 6h-3l-3-5-3 5H8l-4-6V7z" />
      <path d="M3 14h4l3 5h2l3-5h4l4 3v1h-1l-3-2.5-3 4.5h-4l-3-5-3 5H4l-1-1v-2z" opacity="0.6" />
    </svg>
  )
}

function SiliconFlowLogo(): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <path d="M4 6a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6zm9 0a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-3a2 2 0 0 1-2-2V6zM4 15a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3zm9 0a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-3a2 2 0 0 1-2-2v-3z" />
    </svg>
  )
}

function QwenLogo(): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c1.82 0 3.53-.49 5-1.35l-1.5-1.7A7.96 7.96 0 0 1 12 20a8 8 0 1 1 8-8c0 1.48-.4 2.87-1.1 4.06l1.57 1.78A9.96 9.96 0 0 0 22 12c0-5.52-4.48-10-10-10zm0 5a5 5 0 1 0 3.5 8.57l2.12 2.4 1.5-1.33-2.13-2.4A4.98 4.98 0 0 0 17 12a5 5 0 0 0-5-5zm0 2a3 3 0 1 1 0 6 3 3 0 0 1 0-6z" />
    </svg>
  )
}

function ByteDanceLogo(): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <path d="M12 2L6 8v8l6 6 6-6V8l-6-6zm0 2.83L16.17 9v6L12 19.17 7.83 15V9L12 4.83z" />
      <path d="M12 8l-3 3v2l3 3 3-3v-2l-3-3zm0 1.83L13.17 11v2L12 14.17 10.83 13v-2L12 9.83z" />
    </svg>
  )
}

const PROVIDER_LOGOS: Record<string, () => React.ReactElement> = {
  anthropic: AnthropicLogo,
  openai: OpenAILogo,
  google: GoogleLogo,
  openrouter: OpenRouterLogo,
  moonshot: MoonshotLogo,
  'minimax-portal': MiniMaxLogo,
  'minimax-portal-cn': MiniMaxLogo,
  siliconflow: SiliconFlowLogo,
  'qwen-portal': QwenLogo,
  ark: ByteDanceLogo,
}

/* ── Provider Icon ── */

function ProviderIcon({ vendorId }: { vendorId: string }): React.ReactElement {
  const Logo = PROVIDER_LOGOS[vendorId]
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-muted text-muted-foreground">
      {Logo ? <Logo /> : <span className="font-mono text-sm">{vendorId.charAt(0).toUpperCase()}</span>}
    </div>
  )
}

/* ── Protocol selector ── */

const PROTOCOL_OPTIONS: Array<{ value: ProviderProtocol; label: string }> = [
  { value: 'openai-completions', label: 'OpenAI Completions' },
  { value: 'openai-responses', label: 'OpenAI Responses' },
  { value: 'anthropic-messages', label: 'Anthropic Messages' },
]

/* ── Main Page ── */

export function ProvidersPage(): React.ReactElement {
  const { t } = useI18n()
  const {
    accounts,
    vendors,
    defaultAccountId,
    loading,
    oauthFlow,
    init,
    createAccount,
    updateAccount,
    removeAccount,
    setDefault,
    validateKey,
    getAccountKey,
    startOAuth,
    cancelOAuth,
  } = useProviderStore()

  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [showForm, setShowForm] = useState(false)
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testError, setTestError] = useState<string | null>(null)
  const [showKey, setShowKey] = useState(false)

  useEffect(() => { void init() }, [init])

  // Close dialog on OAuth success
  const prevOAuthActive = React.useRef(oauthFlow.active)
  useEffect(() => {
    // Was active, now not active, and no error → success
    if (prevOAuthActive.current && !oauthFlow.active && !oauthFlow.error && showForm) {
      setShowForm(false)
      setForm(EMPTY_FORM)
      toast.success('OAuth 授权成功')
    }
    prevOAuthActive.current = oauthFlow.active
  }, [oauthFlow.active, oauthFlow.error, showForm])

  // Derive unconfigured vendors
  const unconfiguredVendors = getUnconfiguredVendors(vendors, accounts)

  /* ── Open forms ── */

  function openVendor(vendor: ProviderDefinition): void {
    const isOAuthDefault = vendor.isOAuth && vendor.defaultAuthMode !== 'api_key'
    setForm({
      accountId: vendor.id,
      vendorId: vendor.id as ProviderType,
      label: vendor.name,
      baseUrl: vendor.providerConfig?.baseUrl ?? vendor.defaultBaseUrl ?? '',
      apiKey: '',
      apiProtocol: vendor.providerConfig?.api ?? 'openai-completions',
      model: vendor.defaultModelId ?? '',
      headers: vendor.providerConfig?.headers ? JSON.stringify(vendor.providerConfig.headers) : '',
      isEditing: false,
      vendor,
      authMode: isOAuthDefault ? 'oauth' : 'api_key',
      showAdvanced: false,
    })
    setTestError(null)
    setShowKey(false)
    setShowForm(true)
  }

  function openCustom(): void {
    const customVendor = vendors.find((v) => v.id === 'custom')
    setForm({
      ...EMPTY_FORM,
      vendor: customVendor ?? null,
    })
    setTestError(null)
    setShowKey(false)
    setShowForm(true)
  }

  async function openEdit(account: ProviderAccount): Promise<void> {
    const vendor = getVendorForAccount(vendors, account) ?? null
    const key = await getAccountKey(account.id)
    setForm({
      accountId: account.id,
      vendorId: account.vendorId,
      label: account.label,
      baseUrl: account.baseUrl ?? vendor?.providerConfig?.baseUrl ?? '',
      apiKey: key,
      apiProtocol: account.apiProtocol ?? vendor?.providerConfig?.api ?? 'openai-completions',
      model: account.model ?? '',
      headers: account.headers ? JSON.stringify(account.headers) : '',
      isEditing: true,
      vendor,
      authMode: account.authMode === 'api_key' ? 'api_key' : 'oauth',
      showAdvanced: false,
    })
    setTestError(null)
    setShowKey(false)
    setShowForm(true)
  }

  /* ── Actions ── */

  async function handleSetDefault(account: ProviderAccount): Promise<void> {
    await setDefault(account.id)
    toast.success(t('app.providers.modelSet'))
  }

  async function handleDelete(accountId: string): Promise<void> {
    await removeAccount(accountId)
    toast.success(t('app.providers.deleted'))
  }

  async function handleOAuthLogin(vendor: ProviderDefinition): Promise<void> {
    const region = vendor.id === 'minimax-portal-cn' ? 'cn' as const : 'global' as const
    await startOAuth(vendor.id, {
      region,
      accountId: vendor.id,
      label: vendor.name,
    })
  }

  async function handleSave(): Promise<void> {
    if (form.authMode === 'api_key' && (!form.apiKey && !form.isEditing)) return

    setTestError(null)

    // For API key auth, validate first
    if (form.authMode === 'api_key' && form.apiKey) {
      setTesting(true)
      const result = await validateKey(form.vendorId, form.apiKey, {
        baseUrl: form.baseUrl || undefined,
        apiProtocol: form.apiProtocol,
      })
      setTesting(false)

      if (!result.valid) {
        setTestError(friendlyProviderError(result.error))
        return
      }
    }

    setSaving(true)
    try {
      let parsedHeaders: Record<string, string> | undefined
      if (form.headers.trim()) {
        try {
          parsedHeaders = JSON.parse(form.headers)
        } catch {
          setTestError('Headers 格式错误，请输入合法的 JSON')
          setSaving(false)
          return
        }
      }

      if (form.isEditing) {
        await updateAccount(form.accountId, {
          label: form.label,
          baseUrl: form.baseUrl || undefined,
          apiProtocol: form.apiProtocol,
          model: form.model || undefined,
          headers: parsedHeaders,
        }, form.apiKey || undefined)
      } else {
        await createAccount({
          id: form.accountId || form.vendorId,
          vendorId: form.vendorId,
          label: form.label || form.vendor?.name || form.vendorId,
          authMode: 'api_key',
          baseUrl: form.baseUrl || undefined,
          apiProtocol: form.apiProtocol,
          model: form.model || undefined,
          headers: parsedHeaders,
          enabled: true,
          isDefault: accounts.length === 0,
        } as Omit<ProviderAccount, 'createdAt' | 'updatedAt'>, form.apiKey)
      }

      setShowForm(false)
      setForm(EMPTY_FORM)
      toast.success(t('app.providers.saved'))
    } catch (err) {
      setTestError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  function closeForm(): void {
    if (oauthFlow.active) {
      void cancelOAuth()
    }
    setShowForm(false)
    setForm(EMPTY_FORM)
    setTestError(null)
  }

  const isOAuthVendor = form.vendor?.isOAuth
  const showApiKeySection = form.authMode === 'api_key' || !isOAuthVendor

  return (
    <div className="cp-page max-w-4xl">
      <h1 className="text-lg font-semibold text-foreground">{t('nav.providers')}</h1>

      {oauthFlow.error && !showForm && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          OAuth 授权失败: {oauthFlow.error}
        </div>
      )}

      {/* Configured accounts */}
      {accounts.length > 0 && (
        <div className="space-y-2">
          {[...accounts].sort((a, b) => {
            if (a.id === defaultAccountId) return -1
            if (b.id === defaultAccountId) return 1
            return 0
          }).map((account) => {
            const isDefault = account.id === defaultAccountId
            return (
              <div
                key={account.id}
                className={`flex items-center gap-3 rounded-xl border bg-card p-4 transition-colors ${
                  isDefault ? 'border-primary/40' : 'border-border'
                }`}
              >
                <ProviderIcon vendorId={account.vendorId} />

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {account.label}
                    </span>
                    {isDefault && (
                      <span className="flex items-center gap-0.5 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                        <Star className="h-2.5 w-2.5 fill-primary" /> 默认
                      </span>
                    )}
                    <span className="rounded-full border border-border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      {authModeBadge(account.authMode)}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {account.model && <span>{account.model} · </span>}
                    {account.apiProtocol ?? 'openai-completions'}
                    {account.baseUrl && <span> · {account.baseUrl}</span>}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  {!isDefault && (
                    <button
                      onClick={() => void handleSetDefault(account)}
                      className="btn-active-scale p-2 text-muted-foreground transition-colors hover:text-primary"
                      title="设为默认"
                    >
                      <Star className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={() => void openEdit(account)}
                    className="btn-active-scale p-2 text-muted-foreground transition-colors hover:text-foreground"
                    title="编辑"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => void handleDelete(account.id)}
                    className="btn-active-scale p-2 text-muted-foreground transition-colors hover:text-destructive"
                    title="删除"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add more providers */}
      {loading ? (
        <p className="text-sm text-muted-foreground">加载中...</p>
      ) : (
        <div>
          <p className="mb-3 text-sm font-medium text-foreground">添加更多提供商</p>
          <div className="grid grid-cols-4 gap-2">
            {unconfiguredVendors.map((vendor, index) => (
              <button
                key={vendor.id}
                onClick={() => openVendor(vendor)}
                className="btn-active-scale flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-card/50 px-3 py-5 transition-colors hover:border-primary/40 hover:bg-card card-hover"
              >
                <ProviderIcon vendorId={vendor.id} />
                <div className="text-center">
                  <p className="text-xs font-medium text-foreground">{vendor.name}</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {vendor.isOAuth && !vendor.supportsApiKey ? 'OAuth 登录' : '点击配置'}
                  </p>
                </div>
              </button>
            ))}

            {/* Custom provider */}
            <button
              onClick={openCustom}
              className="btn-active-scale flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-card/50 px-3 py-5 transition-colors hover:border-primary/40 hover:bg-card"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-muted text-muted-foreground">
                <Settings className="h-5 w-5" />
              </div>
              <div className="text-center">
                <p className="text-xs font-medium text-foreground">自定义</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">点击配置</p>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Add / Edit dialog */}
      <Dialog open={showForm} onOpenChange={(open) => { if (!open) closeForm() }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {form.isEditing
                ? `编辑 ${form.label || form.vendorId}`
                : form.vendor && form.vendor.id !== 'custom'
                  ? `配置 ${form.vendor.name}`
                  : t('app.providers.addTitle')}
            </DialogTitle>
            <DialogDescription>
              {form.vendor && !form.isEditing && form.vendor.id !== 'custom'
                ? `输入你的 ${form.vendor.name} API Key 即可开始使用。`
                : t('app.providers.addDesc')}
            </DialogDescription>
          </DialogHeader>

          {/* Auth mode toggle for OAuth vendors that also support API key */}
          {isOAuthVendor && form.vendor?.supportsApiKey && !form.isEditing && (
            <div className="flex gap-2">
              <button
                onClick={() => setForm((f) => ({ ...f, authMode: 'oauth' }))}
                className={`btn-active-scale ${`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-colors ${
                  form.authMode === 'oauth'
                    ? 'bg-primary text-primary-foreground'
                    : 'border border-border text-muted-foreground hover:text-foreground'
                }`}`}
              >
                <LogIn className="h-3.5 w-3.5" />
                OAuth 登录
              </button>
              <button
                onClick={() => setForm((f) => ({ ...f, authMode: 'api_key' }))}
                className={`btn-active-scale ${`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-colors ${
                  form.authMode === 'api_key'
                    ? 'bg-primary text-primary-foreground'
                    : 'border border-border text-muted-foreground hover:text-foreground'
                }`}`}
              >
                <Key className="h-3.5 w-3.5" />
                API Key
              </button>
            </div>
          )}

          {/* OAuth flow section */}
          {isOAuthVendor && (form.authMode === 'oauth' || !form.vendor?.supportsApiKey) && !form.isEditing && (
            <div className="flex flex-col items-center gap-3 py-4">
              {oauthFlow.active ? (
                <>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    正在等待浏览器授权...
                  </div>
                  {oauthFlow.userCode && (
                    <p className="text-xs text-muted-foreground">
                      授权码: <span className="font-mono font-bold text-foreground">{oauthFlow.userCode}</span>
                    </p>
                  )}
                </>
              ) : (
                <button
                  onClick={() => form.vendor && void handleOAuthLogin(form.vendor)}
                  className="btn-active-scale flex items-center gap-2 rounded-lg bg-primary px-6 py-2 text-sm text-primary-foreground hover:bg-primary/90"
                >
                  <LogIn className="h-4 w-4" />
                  使用 {form.vendor?.name} 登录
                </button>
              )}
              {oauthFlow.error && (
                <div className="w-full rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {oauthFlow.error}
                </div>
              )}
            </div>
          )}

          {/* API Key form */}
          {showApiKeySection && (
            <div className="space-y-3">
              {/* Display name: show for custom or editing */}
              {(form.vendorId === 'custom' || form.isEditing) && (
                <FormField
                  label="显示名称"
                  value={form.label}
                  onChange={(v) => setForm((f) => ({ ...f, label: v }))}
                  placeholder="e.g. My Provider"
                />
              )}

              {/* Account ID: only for custom new providers */}
              {form.vendorId === 'custom' && !form.isEditing && (
                <FormField
                  label="标识符"
                  value={form.accountId}
                  onChange={(v) => setForm((f) => ({ ...f, accountId: v }))}
                  placeholder="e.g. my-provider"
                />
              )}

              {/* API Key */}
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">
                  {t('app.providers.fieldKey')}
                </label>
                <div className="relative">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={form.apiKey}
                    onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
                    placeholder={form.isEditing ? '重新输入以更新' : (form.vendor?.placeholder ?? 'sk-...')}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 pr-9 text-xs text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-primary/50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="btn-active-scale absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              {/* Base URL: show for custom, or vendors that opt in */}
              {(form.vendorId === 'custom' || form.vendor?.showBaseUrl) && (
                <FormField
                  label={t('app.providers.fieldUrl')}
                  value={form.baseUrl}
                  onChange={(v) => setForm((f) => ({ ...f, baseUrl: v }))}
                  placeholder={form.vendor?.defaultBaseUrl ?? 'https://api.example.com/v1'}
                />
              )}

              {/* Model ID: show for custom, or vendors that opt in */}
              {(form.vendorId === 'custom' || form.vendor?.showModelId) && (
                <FormField
                  label="模型 ID"
                  value={form.model}
                  onChange={(v) => setForm((f) => ({ ...f, model: v }))}
                  placeholder={form.vendor?.modelIdPlaceholder ?? 'model-id'}
                />
              )}

              {/* Protocol selector: show for custom provider */}
              {form.vendorId === 'custom' && (
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">
                    {t('app.providers.fieldApi')}
                  </label>
                  <div className="flex gap-1">
                    {PROTOCOL_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setForm((f) => ({ ...f, apiProtocol: opt.value }))}
                        className={`btn-active-scale ${`rounded-md px-2.5 py-1.5 text-[11px] transition-colors ${
                          form.apiProtocol === opt.value
                            ? 'bg-primary text-primary-foreground'
                            : 'border border-border text-muted-foreground hover:text-foreground'
                        }`}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Advanced toggle for custom provider */}
              {form.vendorId === 'custom' && (
                <div>
                  <button
                    onClick={() => setForm((f) => ({ ...f, showAdvanced: !f.showAdvanced }))}
                    className="btn-active-scale flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    {form.showAdvanced ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    高级配置
                  </button>
                  {form.showAdvanced && (
                    <div className="mt-2 space-y-3">
                      <FormField
                        label="自定义 Headers (JSON)"
                        value={form.headers}
                        onChange={(v) => setForm((f) => ({ ...f, headers: v }))}
                        placeholder='{"X-Custom-Header": "value"}'
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {testError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {testError}
            </div>
          )}

          {/* Save button (only for API key mode) */}
          {showApiKeySection && (
            <div className="flex justify-end pt-1">
              <button
                onClick={() => void handleSave()}
                disabled={
                  (form.vendorId === 'custom' && !form.accountId) ||
                  (!form.apiKey && !form.isEditing) ||
                  testing ||
                  saving
                }
                className="btn-active-scale rounded-lg bg-primary px-4 py-1.5 text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {testing ? t('app.providers.testing') : saving ? t('app.providers.saving') : t('app.providers.save')}
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function FormField({
  label, value, onChange, placeholder, type = 'text', disabled = false,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  disabled?: boolean
}): React.ReactElement {
  return (
    <div>
      <label className="mb-1 block text-xs text-muted-foreground">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-primary/50 disabled:opacity-50"
      />
    </div>
  )
}
