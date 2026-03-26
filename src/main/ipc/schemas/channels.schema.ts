import { z } from 'zod'

export const SaveFeishuConfigSchema = z.object({
  appId: z.string().min(4),
  appSecret: z.string().min(6),
})

export const ApproveFeishuPairingSchema = z.object({
  code: z.string().min(4),
})
