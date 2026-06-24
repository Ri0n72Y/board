import type { AgentProviderRuntimeConfig } from './agentProviderConfig.js'
import {
  DisabledAgentSuggestionProvider,
  MockAgentSuggestionProvider,
  type AgentSuggestionProvider,
} from './agentSuggestionProvider.js'

export function createAgentSuggestionProvider(
  config: AgentProviderRuntimeConfig,
): AgentSuggestionProvider {
  if (config.kind === 'mock') {
    return new MockAgentSuggestionProvider()
  }

  if (config.kind === 'openai-compatible') {
    return new DisabledAgentSuggestionProvider(
      config.kind,
      config.model,
      'Agent suggestion provider "openai-compatible" is configured but real provider network calls are not implemented in MVP 2.4.',
    )
  }

  return new DisabledAgentSuggestionProvider(
    config.kind,
    config.model,
    'Agent suggestion provider is disabled. Enable a supported backend provider before generating suggestions.',
  )
}
