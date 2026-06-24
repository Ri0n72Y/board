import { describe, expect, it } from 'vitest'
import type { AgentProviderRuntimeConfig } from '../../config/agentProviderConfig.js'
import type { AgentSuggestionProviderOutput } from '../../config/agentSuggestionProvider.js'
import {
  AgentProviderOutputValidationError,
  validateSuggestionOutput,
} from './agentSuggestionQuality.js'

const config: AgentProviderRuntimeConfig = {
  kind: 'mock',
  model: 'mock-suggestion-v1',
  apiKeyPresent: false,
  maxInputChars: 200_000,
  maxOutputChars: 10_000,
  maxEstimatedInputTokens: 50_000,
  maxEstimatedOutputTokens: 12_000,
  requestTimeoutMs: 30_000,
  retryMaxAttempts: 0,
  enabled: true,
}

function validMarkdown(extra = ''): string {
  return `# LabourBoard AI Suggestion

## 1. Summary

Summary.

## 2. Board Diagnosis

Diagnosis.

## 3. Risks

Risks.

## 4. Recommended Actions

Actions.

## 5. Patch Candidate Notes

Notes.

## 6. Questions for Human Review

Questions.

## 7. Limits

Limits.
${extra}`
}

function validOutput(
  overrides?: Partial<AgentSuggestionProviderOutput>,
): AgentSuggestionProviderOutput {
  return {
    title: 'Suggestion',
    summary: 'Summary',
    highlights: ['One', 'Two'],
    markdown: validMarkdown(),
    provider: 'mock',
    model: 'mock-suggestion-v1',
    ...overrides,
  }
}

describe('agentSuggestionQuality', () => {
  it('valid mock markdown passes', () => {
    const output = validateSuggestionOutput(validOutput(), config)
    expect(output.estimatedOutputTokens).toBeGreaterThan(0)
  })

  it('missing title fails', () => {
    expect(() =>
      validateSuggestionOutput(validOutput({ title: '' }), config),
    ).toThrow(AgentProviderOutputValidationError)
  })

  it('missing required section fails', () => {
    expect(() =>
      validateSuggestionOutput(
        validOutput({ markdown: validMarkdown().replace('## 3. Risks', '') }),
        config,
      ),
    ).toThrow(AgentProviderOutputValidationError)
  })

  it('empty markdown fails', () => {
    expect(() =>
      validateSuggestionOutput(validOutput({ markdown: '   ' }), config),
    ).toThrow(AgentProviderOutputValidationError)
  })

  it('execution claim fails', () => {
    expect(() =>
      validateSuggestionOutput(
        validOutput({ markdown: validMarkdown('\nI applied the patch.') }),
        config,
      ),
    ).toThrow(AgentProviderOutputValidationError)
  })

  it('over maxOutputChars fails', () => {
    expect(() =>
      validateSuggestionOutput(
        validOutput({ markdown: validMarkdown('x'.repeat(10_000)) }),
        config,
      ),
    ).toThrow(AgentProviderOutputValidationError)
  })

  it('non-string highlight fails', () => {
    expect(() =>
      validateSuggestionOutput(
        validOutput({ highlights: ['One', 2 as unknown as string] }),
        config,
      ),
    ).toThrow(AgentProviderOutputValidationError)
  })

  it('too many highlights are capped at 5', () => {
    const output = validateSuggestionOutput(
      validOutput({
        highlights: ['1', '2', '3', '4', '5', '6'],
      }),
      config,
    )
    expect(output.highlights).toEqual(['1', '2', '3', '4', '5'])
  })
})
