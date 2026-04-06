import { getProviderBackendConfig } from '../../shared/providers/registry'

type ValidationProfile =
  | 'openai-completions'
  | 'openai-responses'
  | 'google-query-key'
  | 'anthropic-header'
  | 'openrouter'
  | 'none'

type ValidationResult = { valid: boolean; error?: string; status?: number }

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, '')
}

function buildOpenAiModelsUrl(baseUrl: string): string {
  return `${normalizeBaseUrl(baseUrl)}/models?limit=1`
}

function resolveOpenAiProbeUrls(
  baseUrl: string,
  apiProtocol: 'openai-completions' | 'openai-responses',
): { modelsUrl: string; probeUrl: string } {
  const normalizedBase = normalizeBaseUrl(baseUrl)
  const endpointSuffixPattern = /(\/responses?|\/chat\/completions)$/
  const rootBase = normalizedBase.replace(endpointSuffixPattern, '')
  const modelsUrl = buildOpenAiModelsUrl(rootBase)

  if (apiProtocol === 'openai-responses') {
    const probeUrl = /(\/responses?)$/.test(normalizedBase)
      ? normalizedBase
      : `${rootBase}/responses`
    return { modelsUrl, probeUrl }
  }

  const probeUrl = /\/chat\/completions$/.test(normalizedBase)
    ? normalizedBase
    : `${rootBase}/chat/completions`
  return { modelsUrl, probeUrl }
}

function getValidationProfile(
  providerType: string,
  options?: { apiProtocol?: string },
): ValidationProfile {
  const config = getProviderBackendConfig(providerType)
  const providerApi = options?.apiProtocol || config?.api

  if (providerApi === 'anthropic-messages') return 'anthropic-header'
  if (providerApi === 'openai-responses') return 'openai-responses'
  if (providerApi === 'openai-completions') return 'openai-completions'

  switch (providerType) {
    case 'anthropic':
      return 'anthropic-header'
    case 'google':
      return 'google-query-key'
    case 'openrouter':
      return 'openrouter'
    case 'ollama':
      return 'none'
    default:
      return 'openai-completions'
  }
}

function classifyAuthResponse(
  status: number,
  data: unknown,
): { valid: boolean; error?: string } {
  if (status >= 200 && status < 300) return { valid: true }
  if (status === 429) return { valid: true }
  if (status === 401 || status === 403) return { valid: false, error: 'Invalid API key' }

  const obj = data as { error?: { message?: string }; message?: string } | null
  const msg = obj?.error?.message || obj?.message || `API error: ${status}`
  return { valid: false, error: msg }
}

async function performValidationRequest(
  _providerLabel: string,
  url: string,
  init: RequestInit,
): Promise<ValidationResult> {
  try {
    const response = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(8000),
    })
    const data = await response.json().catch(() => ({}))
    const result = classifyAuthResponse(response.status, data)
    return { ...result, status: response.status }
  } catch (error) {
    return {
      valid: false,
      error: `Connection error: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}

async function performPostProbe(
  _providerLabel: string,
  url: string,
  headers: Record<string, string>,
  body: unknown,
): Promise<ValidationResult> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    })
    const data = await response.json().catch(() => ({}))

    if (response.status === 401 || response.status === 403) {
      return { valid: false, error: 'Invalid API key', status: response.status }
    }
    if (
      (response.status >= 200 && response.status < 300) ||
      response.status === 400 ||
      response.status === 429
    ) {
      return { valid: true, status: response.status }
    }
    return { ...classifyAuthResponse(response.status, data), status: response.status }
  } catch (error) {
    return {
      valid: false,
      error: `Connection error: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}

async function validateOpenAiCompatibleKey(
  providerType: string,
  apiKey: string,
  apiProtocol: 'openai-completions' | 'openai-responses',
  baseUrl?: string,
): Promise<ValidationResult> {
  const trimmedBaseUrl = baseUrl?.trim()
  if (!trimmedBaseUrl) {
    return { valid: false, error: `Base URL is required for provider "${providerType}" validation` }
  }

  const headers = { Authorization: `Bearer ${apiKey}` }
  const { modelsUrl, probeUrl } = resolveOpenAiProbeUrls(trimmedBaseUrl, apiProtocol)
  const modelsResult = await performValidationRequest(providerType, modelsUrl, { headers })

  if (modelsResult.status === 404) {
    if (apiProtocol === 'openai-responses') {
      return await performPostProbe(providerType, probeUrl, headers, {
        model: 'validation-probe',
        input: 'hi',
      })
    }
    return await performPostProbe(providerType, probeUrl, headers, {
      model: 'validation-probe',
      messages: [{ role: 'user', content: 'hi' }],
      max_tokens: 1,
    })
  }

  return modelsResult
}

async function validateGoogleQueryKey(
  providerType: string,
  apiKey: string,
  baseUrl?: string,
): Promise<ValidationResult> {
  const base = normalizeBaseUrl(baseUrl || 'https://generativelanguage.googleapis.com/v1beta')
  const url = `${base}/models?pageSize=1&key=${encodeURIComponent(apiKey)}`
  return await performValidationRequest(providerType, url, {})
}

async function validateAnthropicHeaderKey(
  providerType: string,
  apiKey: string,
  baseUrl?: string,
): Promise<ValidationResult> {
  const rawBase = normalizeBaseUrl(baseUrl || 'https://api.anthropic.com/v1')
  const base = rawBase.endsWith('/v1') ? rawBase : `${rawBase}/v1`
  const url = `${base}/models?limit=1`
  const headers: Record<string, string> = {
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
  }

  const modelsResult = await performValidationRequest(providerType, url, { headers })

  // Fallback to /messages probe if /models not supported (e.g., MiniMax Anthropic compat)
  if (
    modelsResult.status === 404 ||
    modelsResult.status === 400 ||
    modelsResult.error?.includes('API error: 404') ||
    modelsResult.error?.includes('API error: 400')
  ) {
    const messagesUrl = `${base}/messages`
    return await performPostProbe(providerType, messagesUrl, headers, {
      model: 'validation-probe',
      messages: [{ role: 'user', content: 'hi' }],
      max_tokens: 1,
    })
  }

  return modelsResult
}

async function validateOpenRouterKey(
  providerType: string,
  apiKey: string,
): Promise<ValidationResult> {
  const url = 'https://openrouter.ai/api/v1/auth/key'
  const headers = { Authorization: `Bearer ${apiKey}` }
  return await performValidationRequest(providerType, url, { headers })
}

export async function validateApiKeyWithProvider(
  providerType: string,
  apiKey: string,
  options?: { baseUrl?: string; apiProtocol?: string },
): Promise<ValidationResult> {
  const profile = getValidationProfile(providerType, options)
  const config = getProviderBackendConfig(providerType)
  const resolvedBaseUrl = options?.baseUrl || config?.baseUrl

  if (profile === 'none') {
    return { valid: true }
  }

  const trimmedKey = apiKey.trim()
  if (!trimmedKey) {
    return { valid: false, error: 'API key is required' }
  }

  try {
    switch (profile) {
      case 'openai-completions':
        return await validateOpenAiCompatibleKey(providerType, trimmedKey, 'openai-completions', resolvedBaseUrl)
      case 'openai-responses':
        return await validateOpenAiCompatibleKey(providerType, trimmedKey, 'openai-responses', resolvedBaseUrl)
      case 'google-query-key':
        return await validateGoogleQueryKey(providerType, trimmedKey, resolvedBaseUrl)
      case 'anthropic-header':
        return await validateAnthropicHeaderKey(providerType, trimmedKey, resolvedBaseUrl)
      case 'openrouter':
        return await validateOpenRouterKey(providerType, trimmedKey)
      default:
        return { valid: false, error: `Unsupported validation profile for provider: ${providerType}` }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return { valid: false, error: errorMessage }
  }
}
