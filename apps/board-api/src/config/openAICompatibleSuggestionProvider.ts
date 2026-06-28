import type {
  AgentSuggestionProvider,
  AgentSuggestionProviderInput,
  AgentSuggestionProviderOutput,
} from './agentSuggestionProvider.js'
import {
  AgentProviderUnavailableError,
  AgentProviderTimeoutError,
  AgentProviderRateLimitedError,
  AgentProviderHttpError,
} from './agentSuggestionProvider.js'
import { AgentProviderOutputValidationError } from '../services/agent/agentSuggestionQuality.js'
import type { InternalAgentProviderRuntimeConfig } from './agentProviderConfig.js'
import { buildSuggestionPrompt } from '../services/agent/agentSuggestionPrompt.js'

export class OpenAICompatibleSuggestionProvider implements AgentSuggestionProvider {
  readonly kind = 'openai-compatible'
  readonly model: string
  readonly realProvider = true

  private readonly baseUrl: string
  private readonly apiKey: string
  private readonly requestTimeoutMs: number
  private readonly retryMaxAttempts: number
  private readonly maxOutputTokens: number
  private readonly fetchFn: typeof fetch
  private readonly delayFn: (ms: number) => Promise<void>

  constructor(
    config: InternalAgentProviderRuntimeConfig,
    fetchFn?: typeof fetch,
    delayFn?: (ms: number) => Promise<void>
  ) {
    if (!config.baseUrl || config.baseUrl.trim() === '') {
      throw new AgentProviderUnavailableError(
        'openai-compatible provider requires AGENT_SUGGESTION_BASE_URL to be set.'
      )
    }
    if (!config.apiKey || config.apiKey.trim() === '') {
      throw new AgentProviderUnavailableError(
        'openai-compatible provider requires AGENT_SUGGESTION_API_KEY to be set.'
      )
    }
    if (!config.model || config.model.trim() === '') {
      throw new AgentProviderUnavailableError(
        'openai-compatible provider requires AGENT_SUGGESTION_MODEL to be set.'
      )
    }

    this.model = config.model
    this.baseUrl = validateAndNormalizeBaseUrl(config.baseUrl)
    this.apiKey = config.apiKey
    this.requestTimeoutMs = config.requestTimeoutMs
    this.retryMaxAttempts = config.retryMaxAttempts
    this.maxOutputTokens = config.maxEstimatedOutputTokens
    this.fetchFn = fetchFn ?? globalThis.fetch.bind(globalThis)
    this.delayFn =
      delayFn ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)))
  }

  async generate(
    input: AgentSuggestionProviderInput
  ): Promise<AgentSuggestionProviderOutput> {
    const { systemPrompt, userPrompt } = buildSuggestionPrompt({
      contextMarkdown: input.contextMarkdown,
      skillSnapshots: input.skillSnapshots,
      instruction: input.instruction,
      draftTitle: input.draftTitle,
      title: input.title,
    })

    const body = {
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: this.maxOutputTokens,
      temperature: 0.3,
    }

    const url = `${this.baseUrl}/chat/completions`

    const rawOutput = await this.sendWithRetry(url, body)

    const parsed = parseResponseJson(rawOutput)
    const responseContent = extractMessageContent(parsed)
    const output = parseOutputJson(responseContent)

    // Pass through raw fields — quality layer validates everything.
    // Adapter must NOT add defaults, filter, truncate, or String()-coerce.
    return {
      title: output.title as string,
      summary: output.summary as string,
      highlights: output.highlights as string[],
      markdown: output.markdown as string,
      diagnostics: output.diagnostics as string[] | undefined,
      provider: 'openai-compatible',
      model: this.model,
    }
  }

  private async sendWithRetry(url: string, body: unknown): Promise<string> {
    let lastError: Error | undefined

    for (let attempt = 0; attempt <= this.retryMaxAttempts; attempt++) {
      try {
        return await this.sendOnce(url, body)
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err))

        if (!isRetryableError(lastError)) {
          throw lastError
        }

        if (attempt >= this.retryMaxAttempts) {
          throw lastError
        }

        await this.delayFn(100)
      }
    }

    throw lastError ?? new Error('Unexpected retry exhaustion')
  }

  private async sendOnce(url: string, body: unknown): Promise<string> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.requestTimeoutMs)

    let response: Response
    try {
      response = await this.fetchFn(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
    } catch (err: unknown) {
      clearTimeout(timer)
      if (isAbortError(err)) {
        throw new AgentProviderTimeoutError(
          `Provider request timed out after ${this.requestTimeoutMs}ms.`
        )
      }
      throw new AgentProviderHttpError(
        `Provider request failed: ${err instanceof Error ? err.message : String(err)}`,
        502
      )
    } finally {
      clearTimeout(timer)
    }

    if (!response.ok) {
      await response.body?.cancel()

      if (response.status === 429) {
        throw new AgentProviderRateLimitedError(
          `Provider rate limited (HTTP 429).`
        )
      }

      if (response.status === 401 || response.status === 403) {
        throw new AgentProviderUnavailableError(
          `Provider authentication failed (HTTP ${response.status}). Verify the API key configuration.`
        )
      }

      if (response.status >= 500) {
        throw new AgentProviderHttpError(
          `Provider returned HTTP ${response.status}.`,
          response.status
        )
      }

      throw new AgentProviderHttpError(
        `Provider returned HTTP ${response.status}.`,
        response.status
      )
    }

    return await response.text()
  }
}

// ─── JSON parsing helpers ───
// 2xx response parse / schema / content JSON errors → PROVIDER_OUTPUT_INVALID

function parseResponseJson(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    throw new AgentProviderOutputValidationError(
      'Provider response is not valid JSON.'
    )
  }
}

function extractMessageContent(parsed: unknown): string {
  if (!parsed || typeof parsed !== 'object') {
    throw new AgentProviderOutputValidationError(
      'Provider response is not a JSON object.'
    )
  }

  const resp = parsed as Record<string, unknown>

  if (!Array.isArray(resp.choices) || resp.choices.length === 0) {
    throw new AgentProviderOutputValidationError(
      'Provider response missing choices array.'
    )
  }

  const choice = resp.choices[0] as Record<string, unknown> | undefined
  if (!choice || !choice.message || typeof choice.message !== 'object') {
    throw new AgentProviderOutputValidationError(
      'Provider response missing message in first choice.'
    )
  }

  const message = choice.message as Record<string, unknown>
  if (typeof message.content !== 'string') {
    throw new AgentProviderOutputValidationError(
      'Provider response message content is not a string.'
    )
  }

  return message.content
}

function parseOutputJson(content: string): Record<string, unknown> {
  // Try direct JSON parse first
  try {
    const parsed = JSON.parse(content.trim())
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
  } catch {
    // Not JSON, attempt to extract JSON from markdown code block
  }

  // Try extracting from ```json code block
  const jsonBlockMatch = content.match(/```json\s*([\s\S]*?)\s*```/)
  if (jsonBlockMatch) {
    try {
      const parsed = JSON.parse(jsonBlockMatch[1].trim())
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>
      }
    } catch {
      throw new AgentProviderOutputValidationError(
        'Provider output contains an invalid JSON code block.'
      )
    }
  }

  throw new AgentProviderOutputValidationError(
    'Provider output is not valid JSON and does not contain a JSON code block.'
  )
}

// ─── Helpers ───

function validateAndNormalizeBaseUrl(raw: string): string {
  const trimmed = raw.trim()

  // Must be http:// or https://
  if (!/^https?:\/\//i.test(trimmed)) {
    throw new AgentProviderUnavailableError(
      'AGENT_SUGGESTION_BASE_URL must start with http:// or https://.'
    )
  }

  try {
    new URL(trimmed)
  } catch {
    throw new AgentProviderUnavailableError(
      'AGENT_SUGGESTION_BASE_URL is not a valid URL.'
    )
  }

  return trimmed.replace(/\/+$/, '')
}

function isAbortError(err: unknown): boolean {
  if (err && typeof err === 'object' && 'name' in err) {
    return (err as { name: string }).name === 'AbortError'
  }
  return false
}

function isRetryableError(error: Error): boolean {
  // Retry on rate limit
  if (error instanceof AgentProviderRateLimitedError) return true

  // Retry on provider HTTP 5xx
  if (error instanceof AgentProviderHttpError && error.httpStatus >= 500)
    return true

  // Retry on network transient error (502 from fetch failure in sendOnce catch)
  if (
    error instanceof AgentProviderHttpError &&
    error.httpStatus === 502 &&
    error.message.startsWith('Provider request failed:')
  )
    return true

  // NEVER retry output-invalid errors
  if (error instanceof AgentProviderOutputValidationError) return false

  return false
}
