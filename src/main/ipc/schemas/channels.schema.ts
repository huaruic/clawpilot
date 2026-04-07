import { z } from 'zod'

// --- Generic channel schemas ---

export const SaveChannelConfigSchema = z.object({
  channelType: z.string().min(1),
  values: z.record(z.string()),
})

export const ChannelTypeSchema = z.object({
  channelType: z.string().min(1),
})

export const ValidateChannelCredentialsSchema = z.object({
  channelType: z.string().min(1),
  values: z.record(z.string()),
})
