import { z } from 'zod'

export const ChatSendSchema = z.object({
  sessionKey: z.string().min(1),
  message: z.string().min(1),
})

export const ChatHistorySchema = z.object({
  sessionKey: z.string().min(1),
  limit: z.number().int().positive().optional(),
})
