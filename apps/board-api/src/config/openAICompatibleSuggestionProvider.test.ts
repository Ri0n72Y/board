import { describe, expect, it } from 'vitest'
import { OpenAICompatibleSuggestionProvider } from './openAICompatibleSuggestionProvider.js'
import {
  AgentProviderUnavailableError,
  AgentProviderTimeoutError,
  AgentProviderRateLimitedError,
  AgentProviderHttpError,
} from './agentSuggestionProvider.js'
import { AgentProviderOutputValidationError } from '../services/agent/agentSuggestionQuality.js'
import type { AgentSuggestionProviderInput } from './agentSuggestionProvider.js'
import type { InternalAgentProviderRuntimeConfig } from './agentProviderConfig.js'

// ─── Helpers ───

function makeConfig(
  overrides?: Partial<InternalAgentProviderRuntimeConfig>
): InternalAgentProviderRuntimeConfig {
  return {
    kind: 'openai-compatible',
    model: 'test-model',
    baseUrl: 'https://api.test.invalid/v1',
    apiKey: 'test-key-12345',
    apiKeyPresent: true,
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

function makeInput(
  overrides?: Partial<AgentSuggestionProviderInput>
): AgentSuggestionProviderInput {
  return {
    contextMarkdown: '# Test Context\n\nSome markdown content.',
    skillSnapshots: [
      {
        id: 'skill-1',
        name: 'labourboard-advisor',
        source: 'built-in',
        path: '/skills/labourboard-advisor.md',
        contentHash: 'abc123',
        markdown: '# LabourBoard Advisor\n\nBuilt-in advisor skill.',
      },
    ],
    draftId: 'draft-1',
    draftTitle: 'Test Draft',
    draftProfile: 'agent-full',
    draftSource: 'current-board',
    draftRecordCount: 5,
    ...overrides,
  }
}

function fakeFetch(status: number, body: string | object): typeof fetch {
  return ((_url: string | URL | Request, _init?: RequestInit) => {
    const bodyStr = typeof body === 'string' ? body : JSON.stringify(body)
    return Promise.resolve(
      new Response(bodyStr, {
        status,
        headers: { 'Content-Type': 'application/json' },
      })
    )
  }) as typeof fetch
}

function successChoiceResponse(contentObj: Record<string, unknown>) {
  return {
    choices: [
      {
        message: {
          content: JSON.stringify(contentObj),
        },
      },
    ],
  }
}

const VALID_MARKDOWN = `# LabourBoard AI Suggestion

## 1. Summary

Test summary content.

## 2. Board Diagnosis

Test diagnosis content.

## 3. Risks

Test risks content.

## 4. Recommended Actions

Test actions content.

## 5. Patch Candidate Notes

Test patch notes content.

## 6. Questions for Human Review

Test questions content.

## 7. Limits

Test limits content.`

function validOutput() {
  return {
    title: 'Test Analysis',
    summary: 'A test summary of findings.',
    highlights: ['Highlight 1', 'Highlight 2'],
    markdown: VALID_MARKDOWN,
    diagnostics: ['Analyzed 5 records', 'skill labourboard-advisor applied'],
  }
}

// ─── Tests ───

describe('OpenAICompatibleSuggestionProvider', () => {
  // ── Config validation ──

  it('throws AgentProviderUnavailableError when baseUrl is missing', () => {
    expect(
      () =>
        new OpenAICompatibleSuggestionProvider(
          makeConfig({ baseUrl: undefined })
        )
    ).toThrow(AgentProviderUnavailableError)
  })

  it('throws AgentProviderUnavailableError when apiKey is missing', () => {
    expect(
      () =>
        new OpenAICompatibleSuggestionProvider(
          makeConfig({ apiKey: undefined })
        )
    ).toThrow(AgentProviderUnavailableError)
  })

  it('throws AgentProviderUnavailableError when model is missing', () => {
    expect(
      () => new OpenAICompatibleSuggestionProvider(makeConfig({ model: '' }))
    ).toThrow(AgentProviderUnavailableError)
  })

  it('throws AgentProviderUnavailableError when baseUrl has no http/https prefix', () => {
    expect(
      () =>
        new OpenAICompatibleSuggestionProvider(
          makeConfig({ baseUrl: 'api.openai.com/v1' })
        )
    ).toThrow(AgentProviderUnavailableError)
  })

  it('throws AgentProviderUnavailableError when baseUrl is not a valid URL', () => {
    expect(
      () =>
        new OpenAICompatibleSuggestionProvider(
          makeConfig({ baseUrl: 'https://' })
        )
    ).toThrow(AgentProviderUnavailableError)
  })

  // ── Success path ──

  it('success response creates valid AgentSuggestionProviderOutput', async () => {
    const provider = new OpenAICompatibleSuggestionProvider(
      makeConfig(),
      fakeFetch(200, successChoiceResponse(validOutput()))
    )
    const output = await provider.generate(makeInput())
    expect(output.title).toBe('Test Analysis')
    expect(output.summary).toBe('A test summary of findings.')
    expect(output.highlights).toEqual(['Highlight 1', 'Highlight 2'])
    expect(output.markdown).toBe(VALID_MARKDOWN)
    expect(output.provider).toBe('openai-compatible')
    expect(output.model).toBe('test-model')
    expect(output.diagnostics).toHaveLength(2)
  })

  it('realProvider is true', () => {
    const provider = new OpenAICompatibleSuggestionProvider(makeConfig())
    expect(provider.realProvider).toBe(true)
  })

  it('kind is openai-compatible', () => {
    const provider = new OpenAICompatibleSuggestionProvider(makeConfig())
    expect(provider.kind).toBe('openai-compatible')
  })

  // ── Authorization header ──

  it('Authorization header contains Bearer key', async () => {
    let capturedAuth = ''
    const captureFetch = ((
      _url: string | URL | Request,
      init?: RequestInit
    ) => {
      capturedAuth =
        (init?.headers as Record<string, string>)?.Authorization ?? ''
      return Promise.resolve(
        new Response(JSON.stringify(successChoiceResponse(validOutput())), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    }) as typeof fetch

    const provider = new OpenAICompatibleSuggestionProvider(
      makeConfig({ apiKey: 'my-secret-key' }),
      captureFetch
    )
    await provider.generate(makeInput())
    expect(capturedAuth).toBe('Bearer my-secret-key')
  })

  it('output JSON does not expose API key', async () => {
    const provider = new OpenAICompatibleSuggestionProvider(
      makeConfig({ apiKey: 'my-secret-key' }),
      fakeFetch(200, successChoiceResponse(validOutput()))
    )
    const output = await provider.generate(makeInput())
    const json = JSON.stringify(output)
    expect(json).not.toContain('my-secret-key')
    expect(json).not.toContain('Bearer')
  })

  // ── Request body ──

  it('request body includes model', async () => {
    let capturedBody = ''
    const captureFetch = ((
      _url: string | URL | Request,
      init?: RequestInit
    ) => {
      capturedBody = (init?.body as string) ?? ''
      return Promise.resolve(
        new Response(JSON.stringify(successChoiceResponse(validOutput())), {
          status: 200,
        })
      )
    }) as typeof fetch

    const provider = new OpenAICompatibleSuggestionProvider(
      makeConfig({ model: 'gpt-test' }),
      captureFetch
    )
    await provider.generate(makeInput())
    const parsed = JSON.parse(capturedBody)
    expect(parsed.model).toBe('gpt-test')
  })

  it('request body includes messages', async () => {
    let capturedBody = ''
    const captureFetch = ((
      _url: string | URL | Request,
      init?: RequestInit
    ) => {
      capturedBody = (init?.body as string) ?? ''
      return Promise.resolve(
        new Response(JSON.stringify(successChoiceResponse(validOutput())), {
          status: 200,
        })
      )
    }) as typeof fetch

    const provider = new OpenAICompatibleSuggestionProvider(
      makeConfig(),
      captureFetch
    )
    await provider.generate(makeInput())
    const parsed = JSON.parse(capturedBody)
    expect(parsed.messages).toBeDefined()
    expect(Array.isArray(parsed.messages)).toBe(true)
    expect(parsed.messages.length).toBeGreaterThanOrEqual(2)
  })

  it('request body uses configured max_tokens', async () => {
    let capturedBody = ''
    const captureFetch = ((
      _url: string | URL | Request,
      init?: RequestInit
    ) => {
      capturedBody = (init?.body as string) ?? ''
      return Promise.resolve(
        new Response(JSON.stringify(successChoiceResponse(validOutput())), {
          status: 200,
        })
      )
    }) as typeof fetch

    const provider = new OpenAICompatibleSuggestionProvider(
      makeConfig({ maxEstimatedOutputTokens: 9999 }),
      captureFetch
    )
    await provider.generate(makeInput())
    const parsed = JSON.parse(capturedBody)
    expect(parsed.max_tokens).toBe(9999)
  })

  // ── HTTP error handling ──

  it('HTTP 429 throws AgentProviderRateLimitedError', async () => {
    const provider = new OpenAICompatibleSuggestionProvider(
      makeConfig(),
      fakeFetch(429, '{}')
    )
    await expect(provider.generate(makeInput())).rejects.toThrow(
      AgentProviderRateLimitedError
    )
  })

  it('HTTP 401 throws AgentProviderUnavailableError without key leakage', async () => {
    const provider = new OpenAICompatibleSuggestionProvider(
      makeConfig({ apiKey: 'secret-key' }),
      fakeFetch(401, '{}')
    )
    await expect(provider.generate(makeInput())).rejects.toThrow(
      AgentProviderUnavailableError
    )
    try {
      await provider.generate(makeInput())
    } catch (err) {
      expect(String(err)).not.toContain('secret-key')
      expect(String(err)).not.toContain('Bearer')
    }
  })

  it('HTTP 403 throws AgentProviderUnavailableError without key leakage', async () => {
    const provider = new OpenAICompatibleSuggestionProvider(
      makeConfig({ apiKey: 'secret-key' }),
      fakeFetch(403, '{}')
    )
    await expect(provider.generate(makeInput())).rejects.toThrow(
      AgentProviderUnavailableError
    )
    try {
      await provider.generate(makeInput())
    } catch (err) {
      expect(String(err)).not.toContain('secret-key')
    }
  })

  it('HTTP 500 throws AgentProviderHttpError', async () => {
    const provider = new OpenAICompatibleSuggestionProvider(
      makeConfig(),
      fakeFetch(500, '{}')
    )
    await expect(provider.generate(makeInput())).rejects.toThrow(
      AgentProviderHttpError
    )
  })

  it('HTTP 502 throws AgentProviderHttpError', async () => {
    const provider = new OpenAICompatibleSuggestionProvider(
      makeConfig(),
      fakeFetch(502, '{}')
    )
    await expect(provider.generate(makeInput())).rejects.toThrow(
      AgentProviderHttpError
    )
  })

  it('HTTP 400 throws AgentProviderHttpError', async () => {
    const provider = new OpenAICompatibleSuggestionProvider(
      makeConfig(),
      fakeFetch(400, '{}')
    )
    await expect(provider.generate(makeInput())).rejects.toThrow(
      AgentProviderHttpError
    )
  })

  // ── Response parsing errors → PROVIDER_OUTPUT_INVALID ──

  it('response JSON parse fail → AgentProviderOutputValidationError', async () => {
    const provider = new OpenAICompatibleSuggestionProvider(
      makeConfig(),
      fakeFetch(200, 'not-json-at-all{{{')
    )
    await expect(provider.generate(makeInput())).rejects.toThrow(
      AgentProviderOutputValidationError
    )
  })

  it('response missing choices → AgentProviderOutputValidationError', async () => {
    const provider = new OpenAICompatibleSuggestionProvider(
      makeConfig(),
      fakeFetch(200, { choices: [] })
    )
    await expect(provider.generate(makeInput())).rejects.toThrow(
      AgentProviderOutputValidationError
    )
  })

  it('response with non-JSON message content → AgentProviderOutputValidationError', async () => {
    const provider = new OpenAICompatibleSuggestionProvider(
      makeConfig(),
      fakeFetch(200, {
        choices: [{ message: { content: 'just plain text, not json' } }],
      })
    )
    await expect(provider.generate(makeInput())).rejects.toThrow(
      AgentProviderOutputValidationError
    )
  })

  it('response with message content that is JSON array → AgentProviderOutputValidationError', async () => {
    const provider = new OpenAICompatibleSuggestionProvider(
      makeConfig(),
      fakeFetch(200, {
        choices: [{ message: { content: '[1, 2, 3]' } }],
      })
    )
    await expect(provider.generate(makeInput())).rejects.toThrow(
      AgentProviderOutputValidationError
    )
  })

  // ── Adapter must NOT coerce/filter/truncate ──

  it('passes missing title as undefined (quality layer rejects it)', async () => {
    const resp = successChoiceResponse({
      summary: 'OK',
      markdown: VALID_MARKDOWN,
      highlights: [],
    })
    const provider = new OpenAICompatibleSuggestionProvider(
      makeConfig(),
      fakeFetch(200, resp)
    )
    const output = await provider.generate(makeInput())
    // Adapter passes through raw value — quality layer will reject undefined
    expect(output.title).toBeUndefined()
    // markdown is correct (not lost)
    expect(output.markdown).toBe(VALID_MARKDOWN)
  })

  it('passes non-string highlight as-is (quality layer rejects it)', async () => {
    const resp = successChoiceResponse({
      title: 'T',
      summary: 'S',
      markdown: VALID_MARKDOWN,
      highlights: ['ok', 42],
    })
    const provider = new OpenAICompatibleSuggestionProvider(
      makeConfig(),
      fakeFetch(200, resp)
    )
    const output = await provider.generate(makeInput())
    // Adapter passes raw array — quality layer will reject the number
    expect(output.highlights).toEqual(['ok', 42])
  })

  it('passes diagnostics beyond 20 entries as-is (quality layer rejects it)', async () => {
    const diagnostics = Array.from({ length: 25 }, (_, i) => `diag ${i + 1}`)
    const resp = successChoiceResponse({
      title: 'T',
      summary: 'S',
      markdown: VALID_MARKDOWN,
      highlights: [],
      diagnostics,
    })
    const provider = new OpenAICompatibleSuggestionProvider(
      makeConfig(),
      fakeFetch(200, resp)
    )
    const output = await provider.generate(makeInput())
    expect(output.diagnostics).toHaveLength(25)
  })

  // ── Timeout ──

  it('timeout abort throws AgentProviderTimeoutError', async () => {
    const abortableFetch = ((
      _url: string | URL | Request,
      init?: RequestInit
    ) => {
      return new Promise<Response>((_resolve, reject) => {
        if (init?.signal) {
          const signal = init.signal as AbortSignal
          if (signal.aborted) {
            reject(
              Object.assign(new Error('The operation was aborted.'), {
                name: 'AbortError',
              })
            )
            return
          }
          signal.addEventListener(
            'abort',
            () => {
              reject(
                Object.assign(new Error('The operation was aborted.'), {
                  name: 'AbortError',
                })
              )
            },
            { once: true }
          )
        }
      })
    }) as typeof fetch

    const provider = new OpenAICompatibleSuggestionProvider(
      makeConfig({ requestTimeoutMs: 10 }),
      abortableFetch
    )
    await expect(provider.generate(makeInput())).rejects.toThrow(
      AgentProviderTimeoutError
    )
  })

  // ── Retry ──

  it('retryMaxAttempts=0 does not retry', async () => {
    let callCount = 0
    const countFetch = ((_url: string | URL | Request, _init?: RequestInit) => {
      callCount++
      return Promise.resolve(new Response('{}', { status: 500 }))
    }) as typeof fetch

    const provider = new OpenAICompatibleSuggestionProvider(
      makeConfig({ retryMaxAttempts: 0 }),
      countFetch
    )
    await expect(provider.generate(makeInput())).rejects.toThrow(
      AgentProviderHttpError
    )
    expect(callCount).toBe(1)
  })

  it('retryMaxAttempts > 0 retries on 5xx', async () => {
    let callCount = 0
    const countFetch = ((_url: string | URL | Request, _init?: RequestInit) => {
      callCount++
      return Promise.resolve(new Response('{}', { status: 500 }))
    }) as typeof fetch

    const provider = new OpenAICompatibleSuggestionProvider(
      makeConfig({ retryMaxAttempts: 2 }),
      countFetch,
      () => Promise.resolve() // 0 delay
    )
    await expect(provider.generate(makeInput())).rejects.toThrow(
      AgentProviderHttpError
    )
    expect(callCount).toBe(3)
  })

  it('does not retry on 401', async () => {
    let callCount = 0
    const countFetch = ((_url: string | URL | Request, _init?: RequestInit) => {
      callCount++
      return Promise.resolve(new Response('{}', { status: 401 }))
    }) as typeof fetch

    const provider = new OpenAICompatibleSuggestionProvider(
      makeConfig({ retryMaxAttempts: 2 }),
      countFetch,
      () => Promise.resolve()
    )
    await expect(provider.generate(makeInput())).rejects.toThrow(
      AgentProviderUnavailableError
    )
    expect(callCount).toBe(1)
  })

  it('does not retry on output invalid', async () => {
    let callCount = 0
    const countFetch = ((_url: string | URL | Request, _init?: RequestInit) => {
      callCount++
      return Promise.resolve(
        new Response('not json {{{', {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    }) as typeof fetch

    const provider = new OpenAICompatibleSuggestionProvider(
      makeConfig({ retryMaxAttempts: 3 }),
      countFetch,
      () => Promise.resolve()
    )
    await expect(provider.generate(makeInput())).rejects.toThrow(
      AgentProviderOutputValidationError
    )
    expect(callCount).toBe(1)
  })

  // ── Raw response is not stored ──

  it('raw response is not stored in diagnostics', async () => {
    const provider = new OpenAICompatibleSuggestionProvider(
      makeConfig(),
      fakeFetch(200, successChoiceResponse(validOutput()))
    )
    const output = await provider.generate(makeInput())
    const diagStr = JSON.stringify(output.diagnostics)
    expect(diagStr).not.toContain('choices')
    expect(diagStr).not.toContain('# Test Context')
    expect(diagStr).not.toContain('#### 1.')
  })

  // ── Model in output ──

  it('output model matches configured model', async () => {
    const provider = new OpenAICompatibleSuggestionProvider(
      makeConfig({ model: 'gpt-4-test' }),
      fakeFetch(200, successChoiceResponse(validOutput()))
    )
    const output = await provider.generate(makeInput())
    expect(output.model).toBe('gpt-4-test')
  })
})
