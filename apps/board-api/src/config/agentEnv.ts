export type AgentProvider = 'openai' | 'custom'

export interface AgentRuntimeConfig {
  enabled: boolean
  provider: AgentProvider
  model?: string
  baseUrl?: string
  timeoutMs: number
  hasApiKey: boolean
  disabledReason?: string
}

const DEFAULT_TIMEOUT_MS = 30_000

export function loadAgentRuntimeConfig(
  env: NodeJS.ProcessEnv = process.env
): AgentRuntimeConfig {
  const enabled = env.AGENT_ENABLED === 'true'
  const hasApiKey = typeof env.AGENT_API_KEY === 'string' && env.AGENT_API_KEY.trim().length > 0
  const timeoutMs = parseTimeout(env.AGENT_TIMEOUT_MS)

  return {
    enabled,
    provider: parseProvider(env.AGENT_PROVIDER),
    model: trimOrUndefined(env.AGENT_MODEL),
    baseUrl: trimOrUndefined(env.AGENT_BASE_URL),
    timeoutMs,
    hasApiKey,
    ...(enabled && !hasApiKey
      ? {
          disabledReason:
            'AGENT_API_KEY is required when AGENT_ENABLED=true',
        }
      : {}),
  }
}

function parseProvider(value: string | undefined): AgentProvider {
  return value?.trim() === 'custom' ? 'custom' : 'openai'
}

function parseTimeout(value: string | undefined): number {
  if (value === undefined || value.trim() === '') return DEFAULT_TIMEOUT_MS
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_TIMEOUT_MS
  return Math.trunc(parsed)
}

function trimOrUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}
