import { z } from 'zod'

// ── New account-based schemas ──

export const CreateAccountSchema = z.object({
  account: z.object({
    id: z.string().min(1),
    vendorId: z.string().min(1),
    label: z.string().min(1),
    authMode: z.enum(['api_key', 'oauth_device', 'oauth_browser']),
    baseUrl: z.string().optional(),
    apiProtocol: z.enum(['openai-completions', 'openai-responses', 'anthropic-messages']).optional(),
    headers: z.record(z.string()).optional(),
    model: z.string().optional(),
    fallbackModels: z.array(z.string()).optional(),
    fallbackAccountIds: z.array(z.string()).optional(),
    enabled: z.boolean().default(true),
    isDefault: z.boolean().default(false),
    metadata: z.object({
      region: z.string().optional(),
      email: z.string().optional(),
      resourceUrl: z.string().optional(),
      customModels: z.array(z.string()).optional(),
    }).optional(),
  }),
  apiKey: z.string().optional(),
})

export const UpdateAccountSchema = z.object({
  accountId: z.string().min(1),
  updates: z.object({
    label: z.string().optional(),
    baseUrl: z.string().optional(),
    apiProtocol: z.enum(['openai-completions', 'openai-responses', 'anthropic-messages']).optional(),
    headers: z.record(z.string()).optional(),
    model: z.string().optional(),
    fallbackModels: z.array(z.string()).optional(),
    fallbackAccountIds: z.array(z.string()).optional(),
    enabled: z.boolean().optional(),
  }),
  apiKey: z.string().optional(),
})

export const DeleteAccountSchema = z.object({
  accountId: z.string().min(1),
})

export const SetDefaultAccountSchema = z.object({
  accountId: z.string().min(1),
})

export const ValidateKeySchema = z.object({
  providerType: z.string().min(1),
  apiKey: z.string().min(1),
  baseUrl: z.string().optional(),
  apiProtocol: z.string().optional(),
})

export const OAuthStartSchema = z.object({
  provider: z.string().min(1),
  region: z.enum(['global', 'cn']).optional(),
  accountId: z.string().optional(),
  label: z.string().optional(),
})

// ── Legacy schemas (deprecated, kept for backward compatibility) ──

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
