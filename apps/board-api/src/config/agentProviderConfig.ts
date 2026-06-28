export type AgentProviderKind = 'mock' | 'disabled' | 'openai-compatible'

export interface AgentProviderRuntimeConfig {
  kind: AgentProviderKind
  model: string
  baseUrl?: string
  apiKeyPresent: boolean
  maxInputChars: number
  maxOutputChars: number
  maxEstimatedInputTokens: number
  maxEstimatedOutputTokens: number
  requestTimeoutMs: number
  retryMaxAttempts: number
  costBudgetCents?: number
  enabled: boolean
}

export interface InternalAgentProviderRuntimeConfig extends AgentProviderRuntimeConfig {
  apiKey?: string
}

const DEFAULT_PROVIDER_KIND: AgentProviderKind = 'mock'
const DEFAULT_MODEL = 'mock-suggestion-v1'
const DEFAULT_MAX_INPUT_CHARS = 200_000
const DEFAULT_MAX_OUTPUT_CHARS = 50_000
const DEFAULT_MAX_ESTIMATED_INPUT_TOKENS = 50_000
const DEFAULT_MAX_ESTIMATED_OUTPUT_TOKENS = 12_000
const DEFAULT_TIMEOUT_MS = 30_000
const DEFAULT_RETRY_MAX_ATTEMPTS = 0

export function loadAgentProviderRuntimeConfig(
  env: NodeJS.ProcessEnv = process.env
): AgentProviderRuntimeConfig {
  return stripPrivateAgentProviderConfig(
    loadInternalAgentProviderRuntimeConfig(env)
  )
}

export function loadInternalAgentProviderRuntimeConfig(
  env: NodeJS.ProcessEnv = process.env
): InternalAgentProviderRuntimeConfig {
  const kind = parseProviderKind(env.AGENT_SUGGESTION_PROVIDER)
  const apiKey = trimOrUndefined(env.AGENT_SUGGESTION_API_KEY)

  return {
    kind,
    model: trimOrUndefined(env.AGENT_SUGGESTION_MODEL) ?? DEFAULT_MODEL,
    baseUrl: trimOrUndefined(env.AGENT_SUGGESTION_BASE_URL),
    apiKey,
    apiKeyPresent: Boolean(apiKey),
    maxInputChars: parsePositiveInteger(
      env.AGENT_SUGGESTION_MAX_INPUT_CHARS,
      DEFAULT_MAX_INPUT_CHARS,
      'AGENT_SUGGESTION_MAX_INPUT_CHARS'
    ),
    maxOutputChars: parsePositiveInteger(
      env.AGENT_SUGGESTION_MAX_OUTPUT_CHARS,
      DEFAULT_MAX_OUTPUT_CHARS,
      'AGENT_SUGGESTION_MAX_OUTPUT_CHARS'
    ),
    maxEstimatedInputTokens: parsePositiveInteger(
      env.AGENT_SUGGESTION_MAX_ESTIMATED_INPUT_TOKENS,
      DEFAULT_MAX_ESTIMATED_INPUT_TOKENS,
      'AGENT_SUGGESTION_MAX_ESTIMATED_INPUT_TOKENS'
    ),
    maxEstimatedOutputTokens: parsePositiveInteger(
      env.AGENT_SUGGESTION_MAX_ESTIMATED_OUTPUT_TOKENS,
      DEFAULT_MAX_ESTIMATED_OUTPUT_TOKENS,
      'AGENT_SUGGESTION_MAX_ESTIMATED_OUTPUT_TOKENS'
    ),
    requestTimeoutMs: parsePositiveInteger(
      env.AGENT_SUGGESTION_TIMEOUT_MS,
      DEFAULT_TIMEOUT_MS,
      'AGENT_SUGGESTION_TIMEOUT_MS'
    ),
    retryMaxAttempts: parseNonNegativeInteger(
      env.AGENT_SUGGESTION_RETRY_MAX_ATTEMPTS,
      DEFAULT_RETRY_MAX_ATTEMPTS,
      'AGENT_SUGGESTION_RETRY_MAX_ATTEMPTS'
    ),
    costBudgetCents: parseOptionalPositiveInteger(
      env.AGENT_SUGGESTION_COST_BUDGET_CENTS,
      'AGENT_SUGGESTION_COST_BUDGET_CENTS'
    ),
    enabled: kind === 'mock' || kind === 'openai-compatible',
  }
}

export function stripPrivateAgentProviderConfig(
  config: InternalAgentProviderRuntimeConfig
): AgentProviderRuntimeConfig {
  const { apiKey: _apiKey, ...publicConfig } = config
  return publicConfig
}

function parseProviderKind(value: string | undefined): AgentProviderKind {
  const normalized = value?.trim()
  if (!normalized) return DEFAULT_PROVIDER_KIND
  if (
    normalized === 'mock' ||
    normalized === 'disabled' ||
    normalized === 'openai-compatible'
  ) {
    return normalized
  }
  throw new AgentProviderConfigError(
    `Invalid AGENT_SUGGESTION_PROVIDER "${normalized}". Expected mock, disabled, or openai-compatible.`
  )
}

function parsePositiveInteger(
  value: string | undefined,
  fallback: number,
  name: string
): number {
  if (value === undefined || value.trim() === '') return fallback
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new AgentProviderConfigError(`${name} must be a positive integer.`)
  }
  return parsed
}

function parseNonNegativeInteger(
  value: string | undefined,
  fallback: number,
  name: string
): number {
  if (value === undefined || value.trim() === '') return fallback
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new AgentProviderConfigError(
      `${name} must be a non-negative integer.`
    )
  }
  return parsed
}

function parseOptionalPositiveInteger(
  value: string | undefined,
  name: string
): number | undefined {
  if (value === undefined || value.trim() === '') return undefined
  return parsePositiveInteger(value, 1, name)
}

function trimOrUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

export class AgentProviderConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AgentProviderConfigError'
  }
}
