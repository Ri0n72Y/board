import type { InternalAgentProviderRuntimeConfig } from './agentProviderConfig.js'
import {
  DisabledAgentSuggestionProvider,
  MockAgentSuggestionProvider,
  AgentProviderUnavailableError,
  type AgentSuggestionProvider,
} from './agentSuggestionProvider.js'
import { OpenAICompatibleSuggestionProvider } from './openAICompatibleSuggestionProvider.js'

export function createAgentSuggestionProvider(
  config: InternalAgentProviderRuntimeConfig,
): AgentSuggestionProvider {
  if (config.kind === 'mock') {
    return new MockAgentSuggestionProvider(config.model)
  }

  if (config.kind === 'openai-compatible') {
    // Validate required config — return disabled provider with clear message when missing
    if (!config.baseUrl || config.baseUrl.trim() === '') {
      return new DisabledAgentSuggestionProvider(
        'openai-compatible',
        config.model,
        'openai-compatible provider requires AGENT_SUGGESTION_BASE_URL to be set.',
      )
    }
    if (!config.apiKeyPresent || !config.apiKey || config.apiKey.trim() === '') {
      return new DisabledAgentSuggestionProvider(
        'openai-compatible',
        config.model,
        'openai-compatible provider requires AGENT_SUGGESTION_API_KEY to be set.',
      )
    }
    if (!config.model || config.model.trim() === '') {
      return new DisabledAgentSuggestionProvider(
        'openai-compatible',
        config.model || 'unknown',
        'openai-compatible provider requires AGENT_SUGGESTION_MODEL to be set.',
      )
    }

    try {
      return new OpenAICompatibleSuggestionProvider(config)
    } catch (err) {
      if (err instanceof AgentProviderUnavailableError) {
        return new DisabledAgentSuggestionProvider(
          'openai-compatible',
          config.model,
          err.message,
        )
      }
      throw err
    }
  }

  return new DisabledAgentSuggestionProvider(
    config.kind,
    config.model,
    'Agent suggestion provider is disabled. Enable a supported backend provider before generating suggestions.',
  )
}
