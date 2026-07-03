import { describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import {
  AgentProviderUnavailableError,
  DisabledAgentSuggestionProvider,
  MockAgentSuggestionProvider,
} from './agentSuggestionProvider.js'
import { createAgentSuggestionProvider } from './agentSuggestionProviderFactory.js'
import type { InternalAgentProviderRuntimeConfig } from './agentProviderConfig.js'

function makeConfig(
  overrides?: Partial<InternalAgentProviderRuntimeConfig>
): InternalAgentProviderRuntimeConfig {
  return {
    kind: 'mock',
    model: 'mock-suggestion-v1',
    apiKeyPresent: false,
    maxInputChars: 200_000,
    maxOutputChars: 50_000,
    maxEstimatedInputTokens: 50_000,
    maxEstimatedOutputTokens: 12_000,
    requestTimeoutMs: 30_000,
    retryMaxAttempts: 0,
    enabled: true,
    ...overrides,
  }
}

describe('agentSuggestionProviderFactory', () => {
  it('mock config returns MockAgentSuggestionProvider', () => {
    const provider = createAgentSuggestionProvider(makeConfig())
    expect(provider).toBeInstanceOf(MockAgentSuggestionProvider)
    expect(provider.kind).toBe('mock')
  })

  it('disabled config returns DisabledAgentSuggestionProvider', () => {
    const provider = createAgentSuggestionProvider(
      makeConfig({ kind: 'disabled', model: 'none', enabled: false })
    )
    expect(provider).toBeInstanceOf(DisabledAgentSuggestionProvider)
    expect(provider.kind).toBe('disabled')
  })

  it('openai-compatible returns disabled/stub provider', () => {
    const provider = createAgentSuggestionProvider(
      makeConfig({
        kind: 'openai-compatible',
        model: 'future-model',
        apiKey: 'secret-provider-key',
        apiKeyPresent: true,
        enabled: false,
      })
    )
    expect(provider).toBeInstanceOf(DisabledAgentSuggestionProvider)
    expect(provider.kind).toBe('openai-compatible')
    expect(provider.realProvider).toBe(false)
  })

  it('mock provider uses configured model', async () => {
    const provider = createAgentSuggestionProvider(
      makeConfig({ model: 'mock-custom-model' })
    )
    expect(provider).toBeInstanceOf(MockAgentSuggestionProvider)
    expect(provider.model).toBe('mock-custom-model')
  })

  it('disabled/stub generate throws AgentProviderUnavailableError', async () => {
    const provider = createAgentSuggestionProvider(
      makeConfig({ kind: 'disabled', model: 'none', enabled: false })
    )
    await expect(provider.generate({} as never)).rejects.toThrow(
      AgentProviderUnavailableError
    )
  })

  it('internal apiKey is not exposed by provider output or errors', async () => {
    const secret = 'secret-provider-key'
    const provider = createAgentSuggestionProvider(
      makeConfig({
        kind: 'openai-compatible',
        model: 'future-model',
        apiKey: secret,
        apiKeyPresent: true,
        enabled: false,
      })
    )

    await expect(provider.generate({} as never)).rejects.not.toThrow(secret)
    expect(JSON.stringify(provider)).not.toContain(secret)
  })

  it('factory does not import real provider SDKs or network clients', async () => {
    const source = await readFile(
      new URL('./agentSuggestionProviderFactory.ts', import.meta.url),
      'utf-8'
    )
    // Factory may reference its own OpenAI-compatible provider class
    // but must never import external SDK packages.
    expect(source).not.toContain('from ' + "'openai'")
    expect(source).not.toContain('from ' + '"openai"')
    expect(source).not.toContain('from ' + "'@anthropic")
    expect(source).not.toContain('from ' + '"@anthropic')
    expect(source).not.toContain('from ' + "'deepseek")
    expect(source).not.toContain('from ' + '"deepseek')
    expect(source).not.toContain('chat' + '/completions')
    expect(source).not.toContain('responses' + '.create')
    expect(source).not.toContain('fetch' + '(')
    expect(source).not.toContain('axios' + '.')
  })
})
