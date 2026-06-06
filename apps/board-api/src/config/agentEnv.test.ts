import { describe, expect, it } from 'vitest'
import { loadAgentRuntimeConfig } from './agentEnv.js'

describe('loadAgentRuntimeConfig', () => {
  it('defaults to disabled with no api key and 30s timeout', () => {
    const config = loadAgentRuntimeConfig({})

    expect(config).toMatchObject({
      enabled: false,
      provider: 'openai',
      timeoutMs: 30_000,
      hasApiKey: false,
    })
    expect(config).not.toHaveProperty('apiKey')
    expect(config.disabledReason).toBeUndefined()
  })

  it('reports hasApiKey without exposing the secret', () => {
    const config = loadAgentRuntimeConfig({
      AGENT_API_KEY: 'test-agent-key-redacted',
      AGENT_PROVIDER: 'custom',
      AGENT_MODEL: 'gpt-test',
      AGENT_BASE_URL: 'https://agent.example.test',
      AGENT_TIMEOUT_MS: '45000',
    })

    expect(config).toMatchObject({
      enabled: false,
      provider: 'custom',
      model: 'gpt-test',
      baseUrl: 'https://agent.example.test',
      timeoutMs: 45_000,
      hasApiKey: true,
    })
    expect(JSON.stringify(config)).not.toContain('test-agent-key-redacted')
    expect(config).not.toHaveProperty('apiKey')
  })

  it('returns a disabled reason when enabled without a key', () => {
    const config = loadAgentRuntimeConfig({
      AGENT_ENABLED: 'true',
      AGENT_PROVIDER: 'openai',
    })

    expect(config.enabled).toBe(true)
    expect(config.hasApiKey).toBe(false)
    expect(config.disabledReason).toBe(
      'AGENT_API_KEY is required when AGENT_ENABLED=true'
    )
  })

  it('falls back to the default timeout when parsing fails', () => {
    const config = loadAgentRuntimeConfig({
      AGENT_TIMEOUT_MS: 'not-a-number',
      AGENT_ENABLED: 'true',
      AGENT_API_KEY: 'test-agent-key-redacted',
    })

    expect(config.timeoutMs).toBe(30_000)
    expect(config.disabledReason).toBeUndefined()
  })
})
