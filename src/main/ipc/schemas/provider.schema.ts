import { z } from 'zod'

export const SaveProviderSchema = z.object({
  name: z.string().min(1),
  baseUrl: z.string().url(),
  apiKey: z.string().min(1),
  api: z.string().optional(),
  models: z.array(z.object({ id: z.string(), name: z.string() })).optional(),
})

export const TestProviderSchema = z.object({
  baseUrl: z.string().url(),
  apiKey: z.string().min(1),
})

export const DeleteProviderSchema = z.object({
  name: z.string().min(1),
})

export const SetDefaultModelSchema = z.object({
  model: z.string().min(1),
})
