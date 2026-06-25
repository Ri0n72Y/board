import { describe, expect, it } from 'vitest'
import {
  AgentProviderConfigError,
  loadAgentProviderRuntimeConfig,
  loadInternalAgentProviderRuntimeConfig,
} from './agentProviderConfig.js'

describe('agentProviderConfig', () => {
  it('default provider is mock', () => {
    const config = loadAgentProviderRuntimeConfig({})
    expect(config.kind).toBe('mock')
    expect(config.model).toBe('mock-suggestion-v1')
    expect(config.enabled).toBe(true)
  })

  it('disabled provider loads', () => {
    const config = loadAgentProviderRuntimeConfig({
      AGENT_SUGGESTION_PROVIDER: 'disabled',
    })
    expect(config.kind).toBe('disabled')
    expect(config.enabled).toBe(false)
  })

  it('openai-compatible loads as configured but not executable', () => {
    const config = loadAgentProviderRuntimeConfig({
      AGENT_SUGGESTION_PROVIDER: 'openai-compatible',
      AGENT_SUGGESTION_MODEL: 'provider-model',
      AGENT_SUGGESTION_BASE_URL: 'https://provider.invalid/v1',
    })
    expect(config.kind).toBe('openai-compatible')
    expect(config.model).toBe('provider-model')
    expect(config.baseUrl).toBe('https://provider.invalid/v1')
    expect(config.enabled).toBe(true)
  })

  it('apiKeyPresent reflects key presence without exposing the value', () => {
    const publicConfig = loadAgentProviderRuntimeConfig({
      AGENT_SUGGESTION_API_KEY: 'secret-value',
    })
    const internalConfig = loadInternalAgentProviderRuntimeConfig({
      AGENT_SUGGESTION_API_KEY: 'secret-value',
    })

    expect(publicConfig.apiKeyPresent).toBe(true)
    expect(JSON.stringify(publicConfig)).not.toContain('secret-value')
    expect((publicConfig as Record<string, unknown>).apiKey).toBeUndefined()
    expect(internalConfig.apiKey).toBe('secret-value')
  })

  it('apiKeyPresent is false when key is blank', () => {
    const config = loadAgentProviderRuntimeConfig({
      AGENT_SUGGESTION_API_KEY: '   ',
    })
    expect(config.apiKeyPresent).toBe(false)
  })

  it('invalid provider kind fails', () => {
    expect(() =>
      loadAgentProviderRuntimeConfig({
        AGENT_SUGGESTION_PROVIDER: 'anthropic',
      }),
    ).toThrow(AgentProviderConfigError)
  })

  it('numeric env values parse with defaults', () => {
    const config = loadAgentProviderRuntimeConfig({
      AGENT_SUGGESTION_MAX_INPUT_CHARS: '123',
      AGENT_SUGGESTION_MAX_OUTPUT_CHARS: '456',
      AGENT_SUGGESTION_MAX_ESTIMATED_INPUT_TOKENS: '789',
      AGENT_SUGGESTION_MAX_ESTIMATED_OUTPUT_TOKENS: '321',
      AGENT_SUGGESTION_TIMEOUT_MS: '1000',
      AGENT_SUGGESTION_RETRY_MAX_ATTEMPTS: '2',
      AGENT_SUGGESTION_COST_BUDGET_CENTS: '99',
    })

    expect(config.maxInputChars).toBe(123)
    expect(config.maxOutputChars).toBe(456)
    expect(config.maxEstimatedInputTokens).toBe(789)
    expect(config.maxEstimatedOutputTokens).toBe(321)
    expect(config.requestTimeoutMs).toBe(1000)
    expect(config.retryMaxAttempts).toBe(2)
    expect(config.costBudgetCents).toBe(99)
  })

  it('invalid numeric env values fail', () => {
    expect(() =>
      loadAgentProviderRuntimeConfig({
        AGENT_SUGGESTION_MAX_INPUT_CHARS: '-1',
      }),
    ).toThrow(AgentProviderConfigError)
  })
})
