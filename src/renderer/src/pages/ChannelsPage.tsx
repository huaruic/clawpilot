import React, { useEffect, useState, useCallback } from 'react'
import {
  CheckCircle2, Loader2, ExternalLink, ArrowLeft,
  Eye, EyeOff, Trash2, MessageCircle,
} from 'lucide-react'
import type { ChannelConfigInfo, ChannelValidationResult } from '../api/ipc'
import type { ChannelType, ChannelConfigField } from '../../../shared/types/channel'
import { CHANNEL_META, getPrimaryChannels } from '../../../shared/types/channel'
import { useRuntimeStore } from '../stores/runtimeStore'
import { useRoutingStore } from '../stores/routingStore'
import { useI18n } from '../i18n/I18nProvider'
import { toast } from 'sonner'

// Channel SVG icons
import telegramIcon from '../assets/channels/telegram.svg'
import discordIcon from '../assets/channels/discord.svg'
import whatsappIcon from '../assets/channels/whatsapp.svg'
import wechatIcon from '../assets/channels/wechat.svg'
import dingtalkIcon from '../assets/channels/dingtalk.svg'
import feishuIcon from '../assets/channels/feishu.svg'
import wecomIcon from '../assets/channels/wecom.svg'
import qqIcon from '../assets/channels/qq.svg'
import slackIcon from '../assets/channels/slack.svg'

// --- Helpers ---

function getChannelsApi(): Window['clawpilot']['channels'] {
  const api = window.clawpilot?.channels
  if (!api) throw new Error('Channels API is not available.')
  return api
}

const CHANNEL_ICON_MAP: Record<string, string> = {
  telegram: telegramIcon,
  discord: discordIcon,
  whatsapp: whatsappIcon,
  wechat: wechatIcon,
  dingtalk: dingtalkIcon,
  feishu: feishuIcon,
  wecom: wecomIcon,
  qqbot: qqIcon,
  slack: slackIcon,
}

function ChannelIcon({ type, size = 'lg' }: { type: string; size?: 'sm' | 'lg' }): React.ReactElement {
  const src = CHANNEL_ICON_MAP[type]
  const cls = size === 'lg' ? 'w-8 h-8' : 'w-[22px] h-[22px]'
  if (src) {
    return <img src={src} alt={type} className={`${cls} dark:invert`} />
  }
  return <MessageCircle className={`${cls} text-muted-foreground`} />
}

function useIsZh(): boolean {
  const { resolvedLanguage } = useI18n()
  return resolvedLanguage?.startsWith('zh') ?? false
}

// --- Main Page ---

export function ChannelsPage(): React.ReactElement {
  const { t } = useI18n()
  const isZh = useIsZh()
  const [selectedChannel, setSelectedChannel] = useState<ChannelType | null>(null)
  const [configuredSet, setConfiguredSet] = useState<Set<string>>(new Set())

  const loadConfigured = useCallback(async () => {
    try {
      const list = await getChannelsApi().listConfigured()
      setConfiguredSet(new Set(list.filter((c) => c.enabled).map((c) => c.type)))
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    void loadConfigured()
  }, [loadConfigured])

  const primaryChannels = getPrimaryChannels()

  if (selectedChannel) {
    return (
      <ChannelDetailView
        channelType={selectedChannel}
        onBack={() => {
          setSelectedChannel(null)
          void loadConfigured()
        }}
        isZh={isZh}
      />
    )
  }

  return (
    <div className="cp-page max-w-4xl">
      <div className="mb-1">
        <h1 className="text-lg font-semibold text-foreground">{t('app.channels.title')}</h1>
        <p className="text-xs text-muted-foreground">{t('app.channels.subtitle')}</p>
      </div>

      <p className="mb-4 text-sm font-medium text-foreground">{t('app.channels.selectChannel')}</p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {primaryChannels.map((type) => {
          const meta = CHANNEL_META[type]
          const configured = configuredSet.has(type)
          const soon = meta.comingSoon === true
          return (
            <button
              key={type}
              onClick={() => !soon && setSelectedChannel(type)}
              disabled={soon}
              className={`group relative flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-card p-6 transition-colors ${soon ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary/40 hover:bg-card/80'}`}
            >
              {configured && !soon && (
                <div className="absolute right-2 top-2">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                </div>
              )}
              {soon && (
                <div className="absolute right-2 top-2">
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] text-muted-foreground">
                    {isZh ? '即将推出' : 'Soon'}
                  </span>
                </div>
              )}
              <ChannelIcon type={type} />
              <span className="text-sm font-medium text-foreground">{meta.name}</span>
              <span className="text-[10px] text-muted-foreground">
                {soon
                  ? (isZh ? '即将支持' : 'Coming soon')
                  : configured
                    ? t('app.channels.configured')
                    : t('app.channels.clickToConfigure')}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// --- Channel Detail View ---

function ChannelDetailView({
  channelType,
  onBack,
  isZh,
}: {
  channelType: ChannelType
  onBack: () => void
  isZh: boolean
}): React.ReactElement {
  const { t } = useI18n()
  const { snapshot } = useRuntimeStore()
  const meta = CHANNEL_META[channelType]

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [validating, setValidating] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [config, setConfig] = useState<ChannelConfigInfo | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})
  const [validationMeta, setValidationMeta] = useState<Record<string, unknown> | null>(null)

  const isQrChannel = meta.connectionType === 'qr'
  const hasTokenFields = meta.configFields.length > 0

  // Load config
  useEffect(() => {
    void loadConfig()
  }, [channelType])

  async function loadConfig(): Promise<void> {
    setLoading(true)
    try {
      const data = await getChannelsApi().getConfig({ channelType })
      setConfig(data)
      setValues(data.values ?? {})
      setValidationMeta(null)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  function updateValue(key: string, val: string): void {
    setValues((prev) => ({ ...prev, [key]: val }))
  }

  function isFormValid(): boolean {
    return meta.configFields
      .filter((f) => f.required)
      .every((f) => values[f.key]?.trim())
  }

  async function handleValidate(): Promise<void> {
    setValidating(true)
    try {
      const result = await getChannelsApi().validateCredentials({
        channelType,
        values,
      }) as ChannelValidationResult
      if (result.ok) {
        toast.success(isZh ? '验证成功' : 'Validation successful')
        if (result.meta) setValidationMeta(result.meta)
      } else {
        toast.error(result.error ?? (isZh ? '验证失败' : 'Validation failed'))
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setValidating(false)
    }
  }

  async function handleSave(): Promise<void> {
    setSaving(true)
    setValidationMeta(null)
    try {
      // Validate first
      const validation = await getChannelsApi().validateCredentials({
        channelType,
        values,
      }) as ChannelValidationResult
      if (!validation.ok) {
        toast.error(validation.error ?? (isZh ? '验证失败' : 'Validation failed'))
        return
      }
      if (validation.meta) setValidationMeta(validation.meta)

      // Save
      const result = await getChannelsApi().saveConfig({ channelType, values })
      await loadConfig()
      toast.success(
        result.runtimeRestarted
          ? (isZh ? `${meta.name} 已保存，网关已重启。` : `${meta.name} saved. Gateway restarted.`)
          : (isZh ? `${meta.name} 配置已保存。` : `${meta.name} configuration saved.`),
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(): Promise<void> {
    const msg = isZh
      ? `确定要删除 ${meta.name} 的配置？这将移除所有凭证。`
      : `Delete ${meta.name}? This removes all credentials.`
    if (!window.confirm(msg)) return
    setDeleting(true)
    try {
      const result = await getChannelsApi().deleteConfig({ channelType })
      setConfig(null)
      setValues({})
      setValidationMeta(null)
      await loadConfig()
      toast.success(
        result.runtimeRestarted
          ? (isZh ? `${meta.name} 已删除，网关已重启。` : `${meta.name} deleted. Gateway restarted.`)
          : (isZh ? `${meta.name} 配置已删除。` : `${meta.name} configuration deleted.`),
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="cp-page flex max-w-3xl items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const instructions = isZh ? meta.instructionsZh : meta.instructions

  return (
    <div className="cp-page max-w-3xl">
      <button
        onClick={onBack}
        className="mb-4 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> {t('app.channels.back')}
      </button>

      <div className="rounded-xl border border-border bg-card">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <ChannelIcon type={channelType} size="sm" />
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">{meta.name}</p>
            <p className="text-[10px] text-muted-foreground">
              {isZh ? meta.descriptionZh : meta.description}
            </p>
          </div>
          {meta.docsUrl && (
            <button
              onClick={() => window.open(meta.docsUrl, '_blank', 'noopener,noreferrer')}
              className="flex items-center gap-1 text-[10px] text-primary hover:underline"
            >
              {isZh ? '查看文档' : 'Docs'} <ExternalLink className="h-3 w-3" />
            </button>
          )}
          <span className="text-[10px] text-muted-foreground">Runtime: {snapshot.status}</span>
        </div>

        <div className="space-y-5 p-4">
          {/* Instructions */}
          {instructions.length > 0 && (
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="mb-2 text-xs font-medium text-foreground">
                {isZh ? '如何连接' : 'How to connect'}
              </p>
              <ol className="space-y-1 text-xs text-muted-foreground">
                {instructions.map((step, i) => (
                  <li key={i}>
                    {i + 1}. {step}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* QR channel placeholder */}
          {isQrChannel && (
            <div className="rounded-lg border border-border bg-muted/50 px-4 py-8 text-center text-xs text-muted-foreground">
              {isZh ? '扫码连接功能即将推出' : 'QR code connection coming soon'}
            </div>
          )}

          {/* Config form (for token-based channels) */}
          {hasTokenFields && (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                {meta.configFields.map((field) => (
                  <ConfigFieldInput
                    key={field.key}
                    field={field}
                    value={values[field.key] ?? ''}
                    onChange={(val) => updateValue(field.key, val)}
                    isZh={isZh}
                  />
                ))}
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => void handleSave()}
                  disabled={saving || deleting || !isFormValid()}
                  className="rounded-lg bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {saving
                    ? (isZh ? '保存中...' : 'Saving...')
                    : config?.enabled
                      ? (isZh ? '重新连接' : 'Reconnect')
                      : (isZh ? `连接 ${meta.name}` : `Connect ${meta.name}`)}
                </button>

                <button
                  onClick={() => void handleValidate()}
                  disabled={validating || !isFormValid()}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs text-foreground hover:bg-muted disabled:opacity-50"
                >
                  {validating ? (isZh ? '验证中...' : 'Validating...') : (isZh ? '验证配置' : 'Validate')}
                </button>

                {config?.enabled && (
                  <button
                    onClick={() => void handleDelete()}
                    disabled={deleting || saving}
                    className="flex items-center gap-1 rounded-lg border border-destructive/30 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10 disabled:opacity-50"
                  >
                    <Trash2 className="h-3 w-3" />
                    {deleting ? (isZh ? '删除中...' : 'Deleting...') : (isZh ? '删除' : 'Delete')}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* AI Model routing — bind this channel to a profile */}
          {config?.enabled && (
            <ChannelRoutingSelector channelType={channelType} isZh={isZh} />
          )}

        </div>
      </div>
    </div>
  )
}

// --- Config Field Input ---

function ConfigFieldInput({
  field,
  value,
  onChange,
  isZh,
}: {
  field: ChannelConfigField
  value: string
  onChange: (val: string) => void
  isZh: boolean
}): React.ReactElement {
  const [showSecret, setShowSecret] = useState(false)
  const isPassword = field.type === 'password'
  const label = isZh ? field.labelZh : field.label
  const description = isZh ? field.descriptionZh : field.description

  return (
    <div>
      <label className="mb-1 block text-[10px] text-muted-foreground">
        {label}
        {field.required && <span className="text-destructive"> *</span>}
      </label>
      <div className="relative">
        <input
          type={isPassword && !showSecret ? 'password' : 'text'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 pr-8"
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowSecret(!showSecret)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {showSecret ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>
      {field.envVar && (
        <p className="mt-0.5 text-[10px] text-primary/70">
          {isZh ? '环境变量' : 'Env'}：{field.envVar}
        </p>
      )}
      {description && (
        <p className="mt-0.5 text-[10px] text-muted-foreground">{description}</p>
      )}
    </div>
  )
}

// --- Channel Routing Selector (AI model profile binding) ---

function ChannelRoutingSelector({
  channelType,
  isZh,
}: {
  channelType: string
  isZh: boolean
}): React.ReactElement {
  const { profiles, routes, globalModelRef, refresh } = useRoutingStore()
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    void refresh()
  }, [refresh])

  const currentRoute = routes.find(
    (r) => r.channelType === channelType && (r.accountId === 'main' || r.accountId === 'default'),
  )
  const currentProfileId = currentRoute?.profileId ?? 'default'
  const currentProfile = profiles.find((p) => p.id === currentProfileId)
  const effectiveModelRef = currentProfile?.modelRef ?? globalModelRef

  const handleChange = async (profileId: string): Promise<void> => {
    setLoading(true)
    try {
      if (profileId === 'default') {
        await useRoutingStore.getState().clearRoute(channelType, 'main')
      } else {
        await useRoutingStore.getState().setRoute(channelType, 'main', profileId)
      }
      toast.success(isZh ? 'AI 配置已更新' : 'AI profile updated.')
    } catch (err) {
      toast.error(String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
      <p className="text-xs font-medium text-foreground">
        {isZh ? 'AI 模型配置' : 'AI Model Profile'}
      </p>
      <p className="text-[10px] text-muted-foreground">
        {isZh
          ? '选择处理此频道消息的 AI 模型配置。'
          : 'Choose which AI profile handles messages from this channel.'}
      </p>
      <select
        value={currentProfileId}
        onChange={(e) => void handleChange(e.target.value)}
        disabled={loading}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground outline-none focus:border-primary/50 disabled:opacity-50"
      >
        {profiles.map((p) => {
          const modelDisplay = p.modelRef
            ? p.modelRef
            : globalModelRef
              ? `${globalModelRef} (default)`
              : 'Not configured'
          return (
            <option key={p.id} value={p.id}>
              {p.name} ({modelDisplay})
            </option>
          )
        })}
      </select>
      {effectiveModelRef && (
        <p className="text-[10px] text-muted-foreground">
          {isZh ? '消息链路' : 'Chain'}: {channelType} → {currentProfile?.name ?? 'Default'} → {effectiveModelRef}
        </p>
      )}
    </div>
  )
}
