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
  overrides?: Partial<AgentSuggestionProviderOutput>
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
      validateSuggestionOutput(validOutput({ title: '' }), config)
    ).toThrow(AgentProviderOutputValidationError)
  })

  it('missing required section fails', () => {
    expect(() =>
      validateSuggestionOutput(
        validOutput({ markdown: validMarkdown().replace('## 3. Risks', '') }),
        config
      )
    ).toThrow(AgentProviderOutputValidationError)
  })

  it('empty markdown fails', () => {
    expect(() =>
      validateSuggestionOutput(validOutput({ markdown: '   ' }), config)
    ).toThrow(AgentProviderOutputValidationError)
  })

  it('execution claim fails', () => {
    expect(() =>
      validateSuggestionOutput(
        validOutput({ markdown: validMarkdown('\nI applied the patch.') }),
        config
      )
    ).toThrow(AgentProviderOutputValidationError)
  })

  it('execution claim denylist is case-insensitive', () => {
    for (const claim of [
      'I APPLIED THE PATCH.',
      'i applied the patch.',
      'I Executed the suggested update.',
    ]) {
      expect(() =>
        validateSuggestionOutput(
          validOutput({ markdown: validMarkdown(`\n${claim}`) }),
          config
        )
      ).toThrow(AgentProviderOutputValidationError)
    }
  })

  it('over maxOutputChars fails', () => {
    expect(() =>
      validateSuggestionOutput(
        validOutput({ markdown: validMarkdown('x'.repeat(10_000)) }),
        config
      )
    ).toThrow(AgentProviderOutputValidationError)
  })

  it('non-string highlight fails', () => {
    expect(() =>
      validateSuggestionOutput(
        validOutput({ highlights: ['One', 2 as unknown as string] }),
        config
      )
    ).toThrow(AgentProviderOutputValidationError)
  })

  it('too many highlights are capped at 5', () => {
    const output = validateSuggestionOutput(
      validOutput({
        highlights: ['1', '2', '3', '4', '5', '6'],
      }),
      config
    )
    expect(output.highlights).toEqual(['1', '2', '3', '4', '5'])
  })

  it('diagnostics non-array fails', () => {
    expect(() =>
      validateSuggestionOutput(
        validOutput({
          diagnostics: 'not-array' as unknown as string[],
        }),
        config
      )
    ).toThrow(AgentProviderOutputValidationError)
  })

  it('diagnostics containing non-string fails', () => {
    expect(() =>
      validateSuggestionOutput(
        validOutput({
          diagnostics: ['ok', 1 as unknown as string],
        }),
        config
      )
    ).toThrow(AgentProviderOutputValidationError)
  })

  it('diagnostics too long fails', () => {
    expect(() =>
      validateSuggestionOutput(
        validOutput({
          diagnostics: ['x'.repeat(501)],
        }),
        config
      )
    ).toThrow(AgentProviderOutputValidationError)
  })

  it('diagnostics containing API_KEY fails', () => {
    expect(() =>
      validateSuggestionOutput(
        validOutput({
          diagnostics: ['OPENAI_API_KEY was present'],
        }),
        config
      )
    ).toThrow(AgentProviderOutputValidationError)
  })

  it('valid diagnostics pass', () => {
    const output = validateSuggestionOutput(
      validOutput({
        diagnostics: ['Mock provider generated a bounded diagnostic.'],
      }),
      config
    )
    expect(output.diagnostics).toEqual([
      'Mock provider generated a bounded diagnostic.',
    ])
  })

  // ─── Output object guard ───

  it('output null fails as AgentProviderOutputValidationError', () => {
    expect(() =>
      validateSuggestionOutput(
        null as unknown as AgentSuggestionProviderOutput,
        config
      )
    ).toThrow(AgentProviderOutputValidationError)
  })

  it('output string fails as AgentProviderOutputValidationError', () => {
    expect(() =>
      validateSuggestionOutput(
        'string' as unknown as AgentSuggestionProviderOutput,
        config
      )
    ).toThrow(AgentProviderOutputValidationError)
  })

  it('output array fails as AgentProviderOutputValidationError', () => {
    expect(() =>
      validateSuggestionOutput(
        [] as unknown as AgentSuggestionProviderOutput,
        config
      )
    ).toThrow(AgentProviderOutputValidationError)
  })

  it('output object missing markdown fails', () => {
    expect(() =>
      validateSuggestionOutput(
        {
          title: 'T',
          summary: 'S',
          highlights: [],
          provider: 'p',
          model: 'm',
        } as AgentSuggestionProviderOutput,
        config
      )
    ).toThrow(AgentProviderOutputValidationError)
  })

  it('output object with markdown as number fails', () => {
    expect(() =>
      validateSuggestionOutput(
        validOutput({ markdown: 123 as unknown as string }),
        config
      )
    ).toThrow(AgentProviderOutputValidationError)
  })

  // ─── Diagnostics case-insensitive hardening ───

  it('diagnostics containing Authorization (case mixed) fails', () => {
    expect(() =>
      validateSuggestionOutput(
        validOutput({ diagnostics: ['some authorization header was sent'] }),
        config
      )
    ).toThrow(AgentProviderOutputValidationError)
  })

  it('diagnostics containing Bearer fails', () => {
    expect(() =>
      validateSuggestionOutput(
        validOutput({ diagnostics: ['used bearer token'] }),
        config
      )
    ).toThrow(AgentProviderOutputValidationError)
  })

  it('diagnostics containing bearer (lowercase) fails', () => {
    expect(() =>
      validateSuggestionOutput(
        validOutput({ diagnostics: ['sent bearer auth'] }),
        config
      )
    ).toThrow(AgentProviderOutputValidationError)
  })

  it('diagnostics containing api_key fails', () => {
    expect(() =>
      validateSuggestionOutput(
        validOutput({ diagnostics: ['the api_key was set'] }),
        config
      )
    ).toThrow(AgentProviderOutputValidationError)
  })

  it('diagnostics containing secret fails', () => {
    expect(() =>
      validateSuggestionOutput(
        validOutput({ diagnostics: ['secret key was used'] }),
        config
      )
    ).toThrow(AgentProviderOutputValidationError)
  })

  it('diagnostics containing access token fails', () => {
    expect(() =>
      validateSuggestionOutput(
        validOutput({ diagnostics: ['access_token was provided'] }),
        config
      )
    ).toThrow(AgentProviderOutputValidationError)
  })

  it('diagnostics containing Prompt (case-insensitive) fails', () => {
    expect(() =>
      validateSuggestionOutput(
        validOutput({ diagnostics: ['Prompt was too long'] }),
        config
      )
    ).toThrow(AgentProviderOutputValidationError)
  })

  it('diagnostics containing raw response fails', () => {
    expect(() =>
      validateSuggestionOutput(
        validOutput({ diagnostics: ['raw response was logged'] }),
        config
      )
    ).toThrow(AgentProviderOutputValidationError)
  })

  it('diagnostics exceeding 20 entries fails', () => {
    const entries = Array.from({ length: 21 }, (_, i) => `diagnostic ${i + 1}`)
    expect(() =>
      validateSuggestionOutput(validOutput({ diagnostics: entries }), config)
    ).toThrow(AgentProviderOutputValidationError)
  })

  it('diagnostics at exactly 20 entries passes', () => {
    const entries = Array.from({ length: 20 }, (_, i) => `diagnostic ${i + 1}`)
    const output = validateSuggestionOutput(
      validOutput({ diagnostics: entries }),
      config
    )
    expect(output.diagnostics?.length).toBe(20)
  })

  // ─── Token budget semantics allowed ───

  it('diagnostics containing "token budget" passes', () => {
    const output = validateSuggestionOutput(
      validOutput({ diagnostics: ['token budget: 5000 tokens allocated'] }),
      config
    )
    expect(output.diagnostics).toBeDefined()
  })

  it('diagnostics containing "input tokens" passes', () => {
    const output = validateSuggestionOutput(
      validOutput({ diagnostics: ['input tokens: 1200'] }),
      config
    )
    expect(output.diagnostics).toBeDefined()
  })

  it('diagnostics containing "estimated output tokens" passes', () => {
    const output = validateSuggestionOutput(
      validOutput({ diagnostics: ['estimated output tokens: 800'] }),
      config
    )
    expect(output.diagnostics).toBeDefined()
  })

  it('diagnostics containing token usage budget sentence passes', () => {
    const output = validateSuggestionOutput(
      validOutput({ diagnostics: ['Token usage is within budget'] }),
      config
    )
    expect(output.diagnostics).toBeDefined()
  })

  it('diagnostics containing "token 预算" passes', () => {
    const output = validateSuggestionOutput(
      validOutput({ diagnostics: ['token 预算: 5000'] }),
      config
    )
    expect(output.diagnostics).toBeDefined()
  })

  // ─── Credential semantics still blocked ───

  it('diagnostics containing "api key" fails', () => {
    expect(() =>
      validateSuggestionOutput(
        validOutput({ diagnostics: ['the api key was set'] }),
        config
      )
    ).toThrow(AgentProviderOutputValidationError)
  })

  it('diagnostics containing "Bearer token" fails', () => {
    expect(() =>
      validateSuggestionOutput(
        validOutput({ diagnostics: ['used Bearer token for auth'] }),
        config
      )
    ).toThrow(AgentProviderOutputValidationError)
  })

  it('diagnostics containing "access token" fails', () => {
    expect(() =>
      validateSuggestionOutput(
        validOutput({ diagnostics: ['access token is invalid'] }),
        config
      )
    ).toThrow(AgentProviderOutputValidationError)
  })

  it('diagnostics containing "refresh token" fails', () => {
    expect(() =>
      validateSuggestionOutput(
        validOutput({ diagnostics: ['refresh token was used'] }),
        config
      )
    ).toThrow(AgentProviderOutputValidationError)
  })

  it('diagnostics containing "Authorization" fails', () => {
    expect(() =>
      validateSuggestionOutput(
        validOutput({ diagnostics: ['Authorization header present'] }),
        config
      )
    ).toThrow(AgentProviderOutputValidationError)
  })

  it('diagnostics containing "密钥" fails', () => {
    expect(() =>
      validateSuggestionOutput(
        validOutput({ diagnostics: ['检测到 密钥 泄露'] }),
        config
      )
    ).toThrow(AgentProviderOutputValidationError)
  })

  it('diagnostics containing "私钥" fails', () => {
    expect(() =>
      validateSuggestionOutput(
        validOutput({ diagnostics: ['私钥 不应出现在日志中'] }),
        config
      )
    ).toThrow(AgentProviderOutputValidationError)
  })
})
