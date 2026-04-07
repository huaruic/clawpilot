import fs from 'node:fs/promises'
import path from 'node:path'
import JSON5 from 'json5'
import { getOpenClawStateDir } from './RuntimeLocator'
import { clearAllRoutesForChannel } from './RoutingService'
import type { ChannelType } from '../../shared/types/channel'
import { CHANNEL_META } from '../../shared/types/channel'

function getConfigPath(): string {
  return path.join(getOpenClawStateDir(), 'openclaw.json')
}

async function readExistingConfig(): Promise<Record<string, unknown>> {
  try {
    const raw = await fs.readFile(getConfigPath(), 'utf-8')
    const config = (JSON5.parse(raw) as Record<string, unknown>) ?? {}
    // Strip `routing` — it's Paris-internal and the Gateway rejects unknown keys.
    delete config.routing
    return config
  } catch {
    return {}
  }
}

async function writeConfig(config: Record<string, unknown>): Promise<void> {
  const configPath = getConfigPath()
  await fs.mkdir(path.dirname(configPath), { recursive: true })
  await fs.writeFile(configPath, JSON5.stringify(config, null, 2), 'utf-8')
}

// --- Channel-specific config transforms (ported from ClawX) ---

function transformChannelConfig(
  channelType: string,
  values: Record<string, string>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  switch (channelType) {
    case 'discord': {
      result.token = values.token ?? ''
      if (values.guildId) {
        const guild: Record<string, unknown> = {
          id: values.guildId,
          requireMention: true,
        }
        if (values.channelId) {
          guild.channels = [{ id: values.channelId }]
        }
        result.guilds = [guild]
      }
      break
    }

    case 'telegram': {
      result.botToken = values.botToken ?? ''
      if (values.allowedUsers) {
        const ids = values.allowedUsers
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
        result.allowFrom = ids
      }
      break
    }

    case 'feishu':
    case 'wecom': {
      for (const [k, v] of Object.entries(values)) {
        result[k] = v
      }
      break
    }

    default: {
      for (const [k, v] of Object.entries(values)) {
        result[k] = v
      }
      break
    }
  }

  return result
}

function extractFormValues(
  channelType: string,
  accountConfig: Record<string, unknown>,
): Record<string, string> {
  const values: Record<string, string> = {}

  switch (channelType) {
    case 'discord': {
      if (typeof accountConfig.token === 'string') values.token = accountConfig.token
      const guilds = accountConfig.guilds as Array<Record<string, unknown>> | undefined
      if (Array.isArray(guilds) && guilds.length > 0) {
        const guild = guilds[0]
        if (typeof guild.id === 'string') values.guildId = guild.id
        const channels = guild.channels as Array<Record<string, unknown>> | undefined
        if (Array.isArray(channels) && channels.length > 0 && typeof channels[0].id === 'string') {
          values.channelId = channels[0].id
        }
      }
      break
    }

    case 'telegram': {
      if (typeof accountConfig.botToken === 'string') values.botToken = accountConfig.botToken
      const allowFrom = accountConfig.allowFrom
      if (Array.isArray(allowFrom)) {
        values.allowedUsers = allowFrom.join(', ')
      }
      break
    }

    default: {
      const meta = CHANNEL_META[channelType as ChannelType]
      if (meta) {
        for (const field of meta.configFields) {
          const val = accountConfig[field.key]
          if (typeof val === 'string') {
            values[field.key] = val
          }
        }
      }
      break
    }
  }

  return values
}

// --- Plugin channels that need registration in plugins.allow ---

const PLUGIN_CHANNEL_IDS: Record<string, string> = {
  telegram: 'telegram',
  discord: 'discord',
  slack: 'slack',
  feishu: 'feishu',
  dingtalk: 'dingtalk',
  wecom: 'wecom',
  qqbot: 'qqbot',
  wechat: 'openclaw-weixin',
}

function ensurePluginAllowlist(
  config: Record<string, unknown>,
  channelType: string,
): void {
  const pluginId = PLUGIN_CHANNEL_IDS[channelType]
  if (!pluginId) return

  const plugins = (config.plugins as Record<string, unknown>) ?? {}
  const allow = Array.isArray(plugins.allow) ? [...plugins.allow] : []

  if (!allow.includes(pluginId)) {
    allow.push(pluginId)
  }

  config.plugins = { ...plugins, allow }
}

function removePluginAllowlist(
  config: Record<string, unknown>,
  channelType: string,
): void {
  const pluginId = PLUGIN_CHANNEL_IDS[channelType]
  if (!pluginId) return

  const plugins = (config.plugins as Record<string, unknown>) ?? {}
  const allow = Array.isArray(plugins.allow) ? [...plugins.allow] : []
  const idx = allow.indexOf(pluginId)
  if (idx >= 0) {
    allow.splice(idx, 1)
    config.plugins = { ...plugins, allow }
  }
}

// The actual stored channel type may differ from UI type (e.g. wechat -> openclaw-weixin)
function toStoredChannelType(channelType: string): string {
  if (channelType === 'wechat') return 'openclaw-weixin'
  return channelType
}

// --- Public API ---

export interface ChannelConfig {
  channelType: string
  enabled: boolean
  values: Record<string, string>
}

export async function loadChannelConfig(channelType: string): Promise<ChannelConfig> {
  const storedType = toStoredChannelType(channelType)
  const existing = await readExistingConfig()
  const channels = (existing.channels as Record<string, unknown>) ?? {}
  const channelSection = (channels[storedType] as Record<string, unknown>) ?? {}
  const accounts = (channelSection.accounts as Record<string, unknown>) ?? {}
  const defaultAccount =
    typeof channelSection.defaultAccount === 'string' && channelSection.defaultAccount.trim()
      ? channelSection.defaultAccount.trim()
      : 'main'
  const account =
    (accounts[defaultAccount] as Record<string, unknown>) ??
    (accounts.main as Record<string, unknown>) ??
    {}

  const enabled =
    channelSection.enabled !== false &&
    (Object.keys(account).length > 0 || Boolean(channelSection.enabled))

  return {
    channelType,
    enabled,
    values: extractFormValues(channelType, account),
  }
}

export async function saveChannelConfig(
  channelType: string,
  values: Record<string, string>,
): Promise<void> {
  const storedType = toStoredChannelType(channelType)
  const existing = await readExistingConfig()
  const channels = (existing.channels as Record<string, unknown>) ?? {}
  const channelSection = (channels[storedType] as Record<string, unknown>) ?? {}
  const accounts = (channelSection.accounts as Record<string, unknown>) ?? {}
  const defaultAccount =
    typeof channelSection.defaultAccount === 'string' && channelSection.defaultAccount.trim()
      ? channelSection.defaultAccount.trim()
      : 'main'
  const currentAccount = (accounts[defaultAccount] as Record<string, unknown>) ?? {}

  const transformed = transformChannelConfig(channelType, values)

  // Ensure plugin allowlist for plugin-based channels
  ensurePluginAllowlist(existing, channelType)

  const updated = {
    ...existing,
    channels: {
      ...channels,
      [storedType]: {
        ...channelSection,
        enabled: true,
        defaultAccount,
        ...(channelType === 'feishu'
          ? { connectionMode: 'websocket', dmPolicy: 'open', allowFrom: ['*'] }
          : {}),
        accounts: {
          ...accounts,
          [defaultAccount]: {
            ...currentAccount,
            ...transformed,
          },
        },
      },
    },
  }

  await writeConfig(updated)
}

export async function deleteChannelConfig(channelType: string): Promise<void> {
  const storedType = toStoredChannelType(channelType)
  const existing = await readExistingConfig()
  const channels = (existing.channels as Record<string, unknown>) ?? {}
  const nextChannels = { ...channels }
  delete nextChannels[storedType]

  removePluginAllowlist(existing, channelType)

  const updated = { ...existing, channels: nextChannels }
  await writeConfig(updated)

  // Clean up routing bindings for this channel
  await clearAllRoutesForChannel(channelType)

  // Clean up credential files for feishu
  if (channelType === 'feishu') {
    const stateDir = getOpenClawStateDir()
    const targets = [
      path.join(stateDir, 'credentials', 'feishu-pairing.json'),
      path.join(stateDir, 'credentials', 'feishu-main-allowFrom.json'),
    ]
    await Promise.all(
      targets.map(async (t) => {
        try {
          await fs.rm(t, { force: true })
        } catch {
          // ignore
        }
      }),
    )
  }
}

/**
 * Ensure all configured channels have their plugins registered in plugins.allow.
 * Needed on startup in case channels were saved before their plugin IDs were added.
 */
export async function ensureAllChannelPlugins(): Promise<void> {
  const existing = await readExistingConfig()
  const channels = (existing.channels as Record<string, unknown>) ?? {}
  let dirty = false

  for (const storedType of Object.keys(channels)) {
    const uiType = storedType === 'openclaw-weixin' ? 'wechat' : storedType
    const pluginId = PLUGIN_CHANNEL_IDS[uiType]
    if (!pluginId) continue

    const plugins = (existing.plugins as Record<string, unknown>) ?? {}
    const allow = Array.isArray(plugins.allow) ? [...plugins.allow] : []
    if (!allow.includes(pluginId)) {
      allow.push(pluginId)
      existing.plugins = { ...plugins, allow }
      dirty = true
    }
  }

  if (dirty) {
    await writeConfig(existing)
  }
}

export async function listConfiguredChannels(): Promise<
  Array<{ type: string; enabled: boolean }>
> {
  const existing = await readExistingConfig()
  const channels = (existing.channels as Record<string, unknown>) ?? {}
  const result: Array<{ type: string; enabled: boolean }> = []

  for (const [storedType, section] of Object.entries(channels)) {
    if (!section || typeof section !== 'object') continue
    const s = section as Record<string, unknown>
    // Map stored type back to UI type
    const uiType = storedType === 'openclaw-weixin' ? 'wechat' : storedType
    result.push({
      type: uiType,
      enabled: s.enabled !== false,
    })
  }

  return result
}
