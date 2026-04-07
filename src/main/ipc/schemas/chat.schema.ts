import { z } from 'zod'

export const ChatSendSchema = z.object({
  sessionKey: z.string().min(1),
  message: z.string().min(1),
  attachments: z
    .array(
      z.object({
        content: z.string().min(1),
        mimeType: z.string().min(1),
        fileName: z.string().min(1),
      }),
    )
    .optional(),
})

export const ChatHistorySchema = z.object({
  sessionKey: z.string().min(1),
  limit: z.number().int().positive().optional(),
})

export const ChatAbortSchema = z.object({
  sessionKey: z.string().min(1),
  runId: z.string().optional(),
})

export const SessionDeleteSchema = z.object({
  sessionKey: z.string().min(1),
})

export const SessionResetSchema = z.object({
  sessionKey: z.string().min(1),
})
