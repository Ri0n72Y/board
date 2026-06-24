import { describe, expect, it } from 'vitest'
import type { AgentProviderRuntimeConfig } from '../../config/agentProviderConfig.js'
import type { AgentSkillSnapshot } from '@labour-board/shared'
import {
  AgentProviderBudgetExceededError,
  buildSuggestionBudgetInput,
  checkSuggestionBudget,
  estimateTokensByChars,
} from './agentProviderBudget.js'

const config: AgentProviderRuntimeConfig = {
  kind: 'mock',
  model: 'mock-suggestion-v1',
  apiKeyPresent: false,
  maxInputChars: 20,
  maxOutputChars: 50_000,
  maxEstimatedInputTokens: 5,
  maxEstimatedOutputTokens: 12_000,
  requestTimeoutMs: 30_000,
  retryMaxAttempts: 0,
  enabled: true,
}

function skill(markdown: string): AgentSkillSnapshot {
  return {
    id: 'labourboard-advisor',
    name: 'LabourBoard Advisor',
    source: 'built-in',
    path: 'built-in:labourboard-advisor/SKILL.md',
    contentHash: 'hash',
    markdown,
  }
}

describe('agentProviderBudget', () => {
  it('estimateTokensByChars is stable', () => {
    expect(estimateTokensByChars('')).toBe(0)
    expect(estimateTokensByChars('abcd')).toBe(1)
    expect(estimateTokensByChars('abcde')).toBe(2)
  })

  it('within budget passes', () => {
    const input = buildSuggestionBudgetInput('1234', [skill('1234')], '12')
    expect(() => checkSuggestionBudget(input, config)).not.toThrow()
  })

  it('context too large fails', () => {
    const input = buildSuggestionBudgetInput('x'.repeat(21), [], undefined)
    expect(() => checkSuggestionBudget(input, config)).toThrow(
      AgentProviderBudgetExceededError,
    )
  })

  it('skill markdown too large fails', () => {
    const input = buildSuggestionBudgetInput('', [skill('x'.repeat(21))])
    expect(() => checkSuggestionBudget(input, config)).toThrow(
      AgentProviderBudgetExceededError,
    )
  })

  it('instruction contributes to limit', () => {
    const input = buildSuggestionBudgetInput('12345678', [skill('12345678')], '12345')
    expect(input.instructionCharCount).toBe(5)
    expect(() => checkSuggestionBudget(input, config)).toThrow(
      AgentProviderBudgetExceededError,
    )
  })

  it('error does not include raw context', () => {
    const secretContext = 'SECRET_CONTEXT_SHOULD_NOT_LEAK'
    const input = buildSuggestionBudgetInput(secretContext, [], undefined)
    try {
      checkSuggestionBudget(input, config)
      throw new Error('expected budget failure')
    } catch (caught) {
      expect(caught).toBeInstanceOf(AgentProviderBudgetExceededError)
      expect((caught as Error).message).not.toContain(secretContext)
    }
  })
})
