import { z } from 'zod'

const FeishuCredentialsSchema = z.object({
  appId: z.string().min(4),
  appSecret: z.string().min(6),
})

interface FeishuTokenResponse {
  code?: number
  msg?: string
  tenant_access_token?: string
}

interface FeishuBotInfoResponse extends FeishuTokenResponse {
  bot?: {
    open_id?: string
    bot_name?: string
  }
}

export interface FeishuValidationResult {
  ok: boolean
  error?: string
  botOpenId?: string
  botName?: string
}

export async function validateFeishuCredentials(raw: unknown): Promise<FeishuValidationResult> {
  const parsed = FeishuCredentialsSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: 'Invalid Feishu credentials' }
  }

  const tokenResp = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      app_id: parsed.data.appId,
      app_secret: parsed.data.appSecret,
    }),
  })

  const tokenData = await tokenResp.json() as FeishuTokenResponse
  const token = tokenResp.ok && tokenData.code === 0 ? tokenData.tenant_access_token : null
  if (!token) {
    return { ok: false, error: tokenData.msg ?? 'Failed to exchange tenant access token' }
  }

  const botResp = await fetch('https://open.feishu.cn/open-apis/bot/v3/info', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  })

  const botData = await botResp.json() as FeishuBotInfoResponse
  if (!botResp.ok || botData.code !== 0) {
    return { ok: false, error: botData.msg ?? 'Failed to verify Feishu bot API' }
  }

  return {
    ok: true,
    botOpenId: botData.bot?.open_id,
    botName: botData.bot?.bot_name,
  }
}
