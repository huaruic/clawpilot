import React, { useEffect, useState } from 'react'
import { Plus, Bot, Trash2, Settings2, ArrowRight, Check } from 'lucide-react'
import { useI18n } from '../i18n/I18nProvider'
import { useRoutingStore } from '../stores/routingStore'
import { useProviderStore } from '../stores/providerStore'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog'
import { Switch } from '../components/ui/switch'
import type { RoutingProfile } from '../../../shared/types/routing'
import type { ConfiguredChannel } from '../api/ipc'

// ── Helpers ───────────────────────────────────────────────────────

function formatModelDisplay(profile: RoutingProfile, globalModelRef: string | null): string {
  if (profile.modelRef) {
    const parts = profile.modelRef.split('/')
    return parts[parts.length - 1] || profile.modelRef
  }
  if (globalModelRef) {
    const parts = globalModelRef.split('/')
    return `${parts[parts.length - 1] || globalModelRef} (default)`
  }
  return 'Not configured'
}

function formatProviderName(modelRef: string | null): string {
  if (!modelRef) return ''
  return modelRef.split('/')[0] || ''
}

// ── Main Page ─────────────────────────────────────────────────────

export function AgentsPage(): React.ReactElement {
  const { t } = useI18n()
  const { profiles, routes, globalModelRef, loading, refresh } = useRoutingStore()
  const [channels, setChannels] = useState<ConfiguredChannel[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [editProfile, setEditProfile] = useState<RoutingProfile | null>(null)

  useEffect(() => {
    void refresh()
    void window.catclaw.channels.listConfigured().then(setChannels)
  }, [refresh])

  return (
    <div className="cp-page max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">{t('nav.agents')}</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Manage AI configurations — decide which model processes messages from which channel.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="btn-active-scale flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-3 w-3" /> New Profile
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12 text-xs text-muted-foreground">
          Loading...
        </div>
      )}

      {/* Profile list */}
      <div className="mt-4 space-y-3">
        {profiles.map((profile) => (
          <ProfileCard
            key={profile.id}
            profile={profile}
            className="card-hover"
            globalModelRef={globalModelRef}
            routes={routes}
            onOpenSettings={() => setEditProfile(profile)}
            onDelete={async () => {
              try {
                await useRoutingStore.getState().deleteProfile(profile.id)
                toast.success(`Profile "${profile.name}" deleted.`)
              } catch (err) {
                toast.error(String(err))
              }
            }}
          />
        ))}
      </div>

      {/* Unrouted channels hint */}
      <UnroutedChannelsHint channels={channels} routes={routes} profiles={profiles} />

      {showCreate && (
        <CreateProfileDialog
          channels={channels}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false)
            toast.success('Profile created.')
          }}
        />
      )}

      {editProfile && (
        <ProfileSettingsDialog
          profile={editProfile}
          channels={channels}
          onClose={() => setEditProfile(null)}
        />
      )}
    </div>
  )
}

// ── Profile Card ──────────────────────────────────────────────────

function ProfileCard({
  profile,
  globalModelRef,
  routes,
  onOpenSettings,
  onDelete,
  className,
  style,
}: {
  profile: RoutingProfile
  globalModelRef: string | null
  routes: Array<{ channelType: string; accountId: string; profileId: string }>
  onOpenSettings: () => void
  onDelete: () => void
  className?: string
  style?: React.CSSProperties
}): React.ReactElement {
  const isDefault = profile.id === 'default'
  const boundRoutes = routes.filter((r) => r.profileId === profile.id)
  const effectiveModelRef = profile.modelRef ?? globalModelRef
  const modelDisplay = formatModelDisplay(profile, globalModelRef)
  const providerName = formatProviderName(effectiveModelRef)

  return (
    <div style={style} className={`group relative rounded-xl border bg-card p-4 transition-colors ${
      isDefault ? 'border-primary/20' : 'border-border hover:border-primary/30'
    } ${className ?? ''}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Bot className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-foreground">{profile.name}</p>
              {isDefault && (
                <span className="flex items-center gap-0.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                  <Check className="h-2.5 w-2.5" /> Default
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Model: {modelDisplay}
              {providerName && profile.modelRef ? ` (${providerName})` : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onOpenSettings}
            className="btn-active-scale rounded-md p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground group-hover:opacity-100"
          >
            <Settings2 className="h-3.5 w-3.5" />
          </button>
          {!isDefault && (
            <button
              onClick={onDelete}
              className="btn-active-scale rounded-md p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {boundRoutes.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {boundRoutes.map((r) => (
            <span
              key={`${r.channelType}:${r.accountId}`}
              className="rounded-md bg-accent px-2 py-0.5 text-[10px] text-muted-foreground"
            >
              {r.channelType} · {r.accountId === 'default' || r.accountId === 'main' ? 'main' : r.accountId}
            </span>
          ))}
        </div>
      )}

      {boundRoutes.length > 0 && effectiveModelRef && (
        <div className="mt-2 flex items-center gap-1.5 text-[10px] text-muted-foreground/70">
          <span>{boundRoutes[0].channelType}</span>
          <ArrowRight className="h-2.5 w-2.5" />
          <span>{profile.name}</span>
          <ArrowRight className="h-2.5 w-2.5" />
          <span className="font-mono">{effectiveModelRef}</span>
        </div>
      )}
    </div>
  )
}

// ── Unrouted Channels Hint ────────────────────────────────────────

function UnroutedChannelsHint({
  channels,
  routes,
  profiles,
}: {
  channels: ConfiguredChannel[]
  routes: Array<{ channelType: string; accountId: string; profileId: string }>
  profiles: RoutingProfile[]
}): React.ReactElement | null {
  const routedChannelTypes = new Set(routes.map((r) => r.channelType))
  const unrouted = channels.filter((c) => c.enabled && !routedChannelTypes.has(c.type))
  if (unrouted.length === 0) return null

  const defaultProfile = profiles.find((p) => p.id === 'default')
  const label = defaultProfile?.name ?? 'Default'

  return (
    <div className="mt-4 rounded-xl border border-dashed border-border bg-muted/30 p-3">
      <p className="text-[11px] font-medium text-muted-foreground">
        Unbound channels (using {label}):
      </p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {unrouted.map((c) => (
          <span key={c.type} className="rounded-md bg-accent px-2 py-0.5 text-[10px] text-muted-foreground">
            {c.type}
          </span>
        ))}
      </div>
    </div>
  )
}

// ── Create Profile Dialog ─────────────────────────────────────────

function CreateProfileDialog({
  channels,
  onClose,
  onCreated,
}: {
  channels: ConfiguredChannel[]
  onClose: () => void
  onCreated: () => void
}): React.ReactElement {
  const accounts = useProviderStore((s) => s.accounts)
  const globalModelRef = useRoutingStore.getState().globalModelRef

  const [name, setName] = useState('')
  const [selectedProvider, setSelectedProvider] = useState('')
  const [modelId, setModelId] = useState('')
  const [useDefault, setUseDefault] = useState(true)
  const [inheritWorkspace, setInheritWorkspace] = useState(true)
  const [selectedChannels, setSelectedChannels] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  const enabledAccounts = accounts.filter((a) => a.enabled)
  const enabledChannels = channels.filter((c) => c.enabled)

  useEffect(() => {
    void useProviderStore.getState().refresh()
  }, [])

  const toggleChannel = (type: string): void => {
    setSelectedChannels((prev) => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }

  const handleCreate = async (): Promise<void> => {
    if (!name.trim()) return
    setSaving(true)
    try {
      const modelRef = useDefault
        ? undefined
        : (selectedProvider && modelId ? `${selectedProvider}/${modelId}` : undefined)
      const channelBindings = [...selectedChannels].map((type) => ({
        channelType: type,
        accountId: 'main',
      }))
      await useRoutingStore.getState().createProfile({
        name: name.trim(),
        modelRef,
        inheritWorkspace,
        channelBindings: channelBindings.length > 0 ? channelBindings : undefined,
      })
      onCreated()
    } catch (err) {
      toast.error(String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New AI Profile</DialogTitle>
          <DialogDescription>
            Create a profile to route channel messages to a specific model.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {/* Name */}
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Name *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Customer Support"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50"
            />
          </div>

          {/* Model */}
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">AI Model</label>
            <label className="flex items-center gap-2 text-xs text-muted-foreground mb-2 cursor-pointer">
              <input
                type="checkbox"
                checked={useDefault}
                onChange={(e) => setUseDefault(e.target.checked)}
                className="rounded"
              />
              Use global default {globalModelRef ? `(${globalModelRef})` : ''}
            </label>
            {!useDefault && (
              <div className="space-y-2">
                <select
                  value={selectedProvider}
                  onChange={(e) => {
                    setSelectedProvider(e.target.value)
                    const acct = enabledAccounts.find((a) => a.vendorId === e.target.value)
                    if (acct?.model) setModelId(acct.model)
                  }}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground outline-none focus:border-primary/50"
                >
                  <option value="">Select provider...</option>
                  {enabledAccounts.map((a) => (
                    <option key={a.id} value={a.vendorId}>
                      {a.label} ({a.vendorId})
                    </option>
                  ))}
                </select>
                <input
                  value={modelId}
                  onChange={(e) => setModelId(e.target.value)}
                  placeholder="Model ID, e.g. gpt-5.2"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50"
                />
                {selectedProvider && modelId && (
                  <p className="font-mono text-[10px] text-muted-foreground">
                    Preview: {selectedProvider}/{modelId}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Channel bindings */}
          {enabledChannels.length > 0 && (
            <div>
              <label className="mb-1.5 block text-xs text-muted-foreground">
                Bind channels (optional)
              </label>
              <div className="space-y-1">
                {enabledChannels.map((ch) => (
                  <label
                    key={ch.type}
                    className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs text-foreground hover:bg-accent/50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedChannels.has(ch.type)}
                      onChange={() => toggleChannel(ch.type)}
                      className="rounded"
                    />
                    {ch.type} · main
                  </label>
                ))}
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground">
                Selected channels will use this profile. Unselected channels keep current routing.
              </p>
            </div>
          )}

          {/* Advanced */}
          <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
            <div>
              <p className="text-xs text-foreground">Inherit workspace files</p>
              <p className="text-[10px] text-muted-foreground">Copy SOUL.md etc. from main agent</p>
            </div>
            <Switch checked={inheritWorkspace} onCheckedChange={setInheritWorkspace} />
          </div>

          <button
            onClick={() => void handleCreate()}
            disabled={saving || !name.trim()}
            className="btn-active-scale w-full rounded-lg bg-primary py-2 text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? 'Creating...' : 'Create'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Profile Settings Dialog ───────────────────────────────────────

function ProfileSettingsDialog({
  profile,
  channels,
  onClose,
}: {
  profile: RoutingProfile
  channels: ConfiguredChannel[]
  onClose: () => void
}): React.ReactElement {
  const { routes, globalModelRef } = useRoutingStore()
  const accounts = useProviderStore((s) => s.accounts)
  const [name, setName] = useState(profile.name)
  const [saving, setSaving] = useState(false)
  const [editingModel, setEditingModel] = useState(false)
  const [modelProvider, setModelProvider] = useState(() => {
    if (!profile.modelRef) return ''
    return profile.modelRef.split('/')[0] || ''
  })
  const [modelId, setModelId] = useState(() => {
    if (!profile.modelRef) return ''
    const idx = profile.modelRef.indexOf('/')
    return idx > 0 ? profile.modelRef.slice(idx + 1) : ''
  })
  const [useDefaultModel, setUseDefaultModel] = useState(!profile.modelRef)
  const isDefault = profile.id === 'default'

  const boundRoutes = routes.filter((r) => r.profileId === profile.id)
  const effectiveModelRef = profile.modelRef ?? globalModelRef
  const enabledChannels = channels.filter((c) => c.enabled)
  const enabledAccounts = accounts.filter((a) => a.enabled)
  const unboundChannels = enabledChannels.filter(
    (c) => !boundRoutes.some((r) => r.channelType === c.type),
  )

  useEffect(() => {
    void useProviderStore.getState().refresh()
  }, [])

  const handleSaveName = async (): Promise<void> => {
    if (!name.trim() || name.trim() === profile.name) return
    setSaving(true)
    try {
      await useRoutingStore.getState().updateProfile(profile.id, { name: name.trim() })
      toast.success('Profile updated.')
    } catch (err) {
      toast.error(String(err))
    } finally {
      setSaving(false)
    }
  }

  const handleSaveModel = async (): Promise<void> => {
    setSaving(true)
    try {
      const newModelRef = useDefaultModel ? null : (modelProvider && modelId ? `${modelProvider}/${modelId}` : null)
      await useRoutingStore.getState().updateProfile(profile.id, { modelRef: newModelRef })
      setEditingModel(false)
      toast.success('Model updated.')
    } catch (err) {
      toast.error(String(err))
    } finally {
      setSaving(false)
    }
  }

  const handleUnbind = async (channelType: string, accountId: string): Promise<void> => {
    try {
      await useRoutingStore.getState().clearRoute(channelType, accountId)
      toast.success(`Unbound ${channelType}.`)
    } catch (err) {
      toast.error(String(err))
    }
  }

  const handleBind = async (channelType: string): Promise<void> => {
    try {
      await useRoutingStore.getState().setRoute(channelType, 'main', profile.id)
      toast.success(`Bound ${channelType} to ${profile.name}.`)
    } catch (err) {
      toast.error(String(err))
    }
  }

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{profile.name} Settings</DialogTitle>
          <DialogDescription>
            Update profile and manage channel bindings.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {/* Name */}
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Name</label>
            <div className="flex gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                readOnly={isDefault}
                className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground outline-none focus:border-primary/50"
              />
              {!isDefault && (
                <button
                  onClick={() => void handleSaveName()}
                  disabled={saving || !name.trim() || name.trim() === profile.name}
                  className="btn-active-scale rounded-lg bg-primary px-3 py-2 text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  Save
                </button>
              )}
            </div>
          </div>

          {/* Info cards */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-muted p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">ID</p>
              <p className="mt-0.5 font-mono text-xs text-foreground">{profile.id}</p>
            </div>
            <button
              type="button"
              onClick={() => setEditingModel(!editingModel)}
              className="btn-active-scale rounded-lg bg-muted p-3 text-left hover:bg-accent transition-colors"
            >
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Model <span className="text-primary">(edit)</span>
              </p>
              <p className="mt-0.5 text-xs text-foreground">
                {formatModelDisplay(profile, globalModelRef)}
              </p>
              <p className="font-mono text-[10px] text-muted-foreground">
                {effectiveModelRef || '-'}
              </p>
            </button>
          </div>

          {/* Model editing */}
          {editingModel && (
            <div className="rounded-lg border border-primary/20 bg-muted/50 p-3 space-y-2">
              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={useDefaultModel}
                  onChange={(e) => setUseDefaultModel(e.target.checked)}
                  className="rounded"
                />
                Use global default {globalModelRef ? `(${globalModelRef})` : ''}
              </label>
              {!useDefaultModel && (
                <div className="space-y-2">
                  <select
                    value={modelProvider}
                    onChange={(e) => {
                      setModelProvider(e.target.value)
                      const acct = enabledAccounts.find((a) => a.vendorId === e.target.value)
                      if (acct?.model && !modelId) setModelId(acct.model)
                    }}
                    className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground outline-none focus:border-primary/50"
                  >
                    <option value="">Select provider...</option>
                    {enabledAccounts.map((a) => (
                      <option key={a.id} value={a.vendorId}>
                        {a.label} ({a.vendorId})
                      </option>
                    ))}
                  </select>
                  <input
                    value={modelId}
                    onChange={(e) => setModelId(e.target.value)}
                    placeholder="Model ID"
                    className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50"
                  />
                </div>
              )}
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setEditingModel(false)}
                  className="btn-active-scale rounded-lg border border-border px-3 py-1 text-[11px] text-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  onClick={() => void handleSaveModel()}
                  disabled={saving || (!useDefaultModel && (!modelProvider || !modelId))}
                  className="btn-active-scale rounded-lg bg-primary px-3 py-1 text-[11px] text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Model'}
                </button>
              </div>
            </div>
          )}

          {/* Bound channels — editable */}
          <div>
            <p className="mb-1.5 text-xs font-medium text-foreground">Channel Bindings</p>
            {boundRoutes.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border p-3 text-center text-[11px] text-muted-foreground">
                No channels bound to this profile.
              </p>
            ) : (
              <div className="space-y-1">
                {boundRoutes.map((r) => (
                  <div
                    key={`${r.channelType}:${r.accountId}`}
                    className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
                  >
                    <span className="text-xs text-foreground">
                      {r.channelType} · {r.accountId === 'default' || r.accountId === 'main' ? 'main' : r.accountId}
                    </span>
                    <button
                      onClick={() => void handleUnbind(r.channelType, r.accountId)}
                      className="btn-active-scale text-[10px] text-destructive hover:underline"
                    >
                      Unbind
                    </button>
                  </div>
                ))}
              </div>
            )}

            {unboundChannels.length > 0 && (
              <select
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) {
                    void handleBind(e.target.value)
                    e.target.value = ''
                  }
                }}
                className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-muted-foreground outline-none focus:border-primary/50"
              >
                <option value="">+ Bind a channel...</option>
                {unboundChannels.map((c) => (
                  <option key={c.type} value={c.type}>{c.type}</option>
                ))}
              </select>
            )}
          </div>

          {/* Message chain preview */}
          {boundRoutes.length > 0 && effectiveModelRef && (
            <div className="rounded-lg bg-muted p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Message Chain</p>
              <div className="mt-1 flex items-center gap-1.5 text-xs text-foreground">
                <span>{boundRoutes[0].channelType}</span>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <span className="font-medium">{profile.name}</span>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <span className="font-mono text-muted-foreground">{effectiveModelRef}</span>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
