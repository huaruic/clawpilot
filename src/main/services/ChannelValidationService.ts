import type { ChannelType } from '../../shared/types/channel'
import { CHANNEL_META } from '../../shared/types/channel'
import { validateFeishuCredentials } from './FeishuService'

export interface ChannelValidationResult {
  ok: boolean
  error?: string
  meta?: Record<string, unknown>
}

export async function validateChannelCredentials(
  channelType: string,
  values: Record<string, string>,
): Promise<ChannelValidationResult> {
  const meta = CHANNEL_META[channelType as ChannelType]
  if (!meta) {
    return { ok: false, error: `Unknown channel type: ${channelType}` }
  }

  // Check required fields
  for (const field of meta.configFields) {
    if (field.required && !values[field.key]?.trim()) {
      return { ok: false, error: `Missing required field: ${field.label}` }
    }
  }

  // Channel-specific online validation
  switch (channelType) {
    case 'feishu': {
      const result = await validateFeishuCredentials({
        appId: values.appId,
        appSecret: values.appSecret,
      })
      return {
        ok: result.ok,
        error: result.error,
        meta: result.ok
          ? { botOpenId: result.botOpenId, botName: result.botName }
          : undefined,
      }
    }

    case 'telegram': {
      // Basic format check for Telegram bot token
      const token = values.botToken?.trim() ?? ''
      if (!/^\d+:.+$/.test(token)) {
        return { ok: false, error: 'Invalid bot token format. Expected format: 123456:ABC-DEF...' }
      }
      return { ok: true }
    }

    case 'discord': {
      const token = values.token?.trim() ?? ''
      if (token.length < 20) {
        return { ok: false, error: 'Discord bot token appears too short' }
      }
      return { ok: true }
    }

    default:
      // For other channels, just check required fields (already done above)
      return { ok: true }
  }
}
