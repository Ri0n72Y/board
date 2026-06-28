import type { AgentSkillSnapshot } from '@labour-board/shared'
import type { AgentProviderRuntimeConfig } from '../../config/agentProviderConfig.js'

export interface SuggestionBudgetInput {
  contextCharCount: number
  skillCharCount: number
  instructionCharCount: number
  totalInputChars: number
  estimatedInputTokens: number
}

export function estimateTokensByChars(text: string): number {
  return Math.ceil(text.length / 4)
}

export function buildSuggestionBudgetInput(
  contextMarkdown: string,
  skillSnapshots: AgentSkillSnapshot[],
  instruction?: string
): SuggestionBudgetInput {
  const contextCharCount = contextMarkdown.length
  const skillCharCount = skillSnapshots.reduce(
    (sum, skill) => sum + skill.markdown.length,
    0
  )
  const instructionCharCount = instruction?.length ?? 0
  const totalInputChars =
    contextCharCount + skillCharCount + instructionCharCount

  return {
    contextCharCount,
    skillCharCount,
    instructionCharCount,
    totalInputChars,
    estimatedInputTokens: Math.ceil(totalInputChars / 4),
  }
}

export function checkSuggestionBudget(
  input: SuggestionBudgetInput,
  config: AgentProviderRuntimeConfig
): void {
  if (input.totalInputChars > config.maxInputChars) {
    throw new AgentProviderBudgetExceededError(
      `Agent suggestion input exceeds maxInputChars: totalInputChars=${input.totalInputChars}, maxInputChars=${config.maxInputChars}.`
    )
  }

  if (input.estimatedInputTokens > config.maxEstimatedInputTokens) {
    throw new AgentProviderBudgetExceededError(
      `Agent suggestion input exceeds maxEstimatedInputTokens: estimatedInputTokens=${input.estimatedInputTokens}, maxEstimatedInputTokens=${config.maxEstimatedInputTokens}.`
    )
  }
}

export class AgentProviderBudgetExceededError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AgentProviderBudgetExceededError'
  }
}
