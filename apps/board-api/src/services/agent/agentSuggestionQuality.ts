import type { AgentProviderRuntimeConfig } from '../../config/agentProviderConfig.js'
import type { AgentSuggestionProviderOutput } from '../../config/agentSuggestionProvider.js'

export interface ValidatedSuggestionOutput {
  title: string
  summary: string
  highlights: string[]
  markdown: string
  provider: string
  model: string
  diagnostics?: string[]
  estimatedOutputTokens: number
}

const REQUIRED_MARKDOWN_SECTIONS = [
  '# LabourBoard AI Suggestion',
  '## 1. Summary',
  '## 2. Board Diagnosis',
  '## 3. Risks',
  '## 4. Recommended Actions',
  '## 5. Patch Candidate Notes',
  '## 6. Questions for Human Review',
  '## 7. Limits',
]

const EXECUTION_CLAIM_DENYLIST = [
  'I have updated the board',
  'I applied the patch',
  '已修改看板',
  '已应用补丁',
  'I executed',
  '已执行',
]

const MAX_HIGHLIGHTS = 5
const MAX_DIAGNOSTIC_LENGTH = 500
const MAX_DIAGNOSTIC_ENTRIES = 20

const DIAGNOSTIC_SENSITIVE_MARKERS_LOWER = [
  'api key',
  'apikey',
  'api_key',
  'secret',
  'password',
  'private key',
  'bearer token',
  'access token',
  'access_token',
  'refresh token',
  'refresh_token',
  'authorization',
  'bearer',
  'x-api-key',
  'prompt',
  'contextmarkdown',
  'context markdown',
  'skill markdown',
  'system prompt',
  'raw request',
  'raw response',
  '密钥',
  '私钥',
  '密码',
  '访问令牌',
  '刷新令牌',
  '授权头',
]

export function validateSuggestionOutput(
  output: AgentSuggestionProviderOutput,
  config: AgentProviderRuntimeConfig,
): ValidatedSuggestionOutput {
  // ─── Object guard: ensure output is a proper object ───
  if (output === null) {
    throw new AgentProviderOutputValidationError(
      'Provider output must be an object, received null.',
    )
  }
  if (typeof output !== 'object') {
    throw new AgentProviderOutputValidationError(
      `Provider output must be an object, received ${typeof output}.`,
    )
  }
  if (Array.isArray(output)) {
    throw new AgentProviderOutputValidationError(
      'Provider output must be an object, received array.',
    )
  }

  // ─── Field validation ───

  if (typeof output.markdown !== 'string' || output.markdown.trim() === '') {
    throw new AgentProviderOutputValidationError(
      'Provider output markdown must be a non-empty string.',
    )
  }

  if (output.markdown.length > config.maxOutputChars) {
    throw new AgentProviderOutputValidationError(
      `Provider output markdown exceeds maxOutputChars: markdownChars=${output.markdown.length}, maxOutputChars=${config.maxOutputChars}.`,
    )
  }

  const estimatedOutputTokens = Math.ceil(output.markdown.length / 4)
  if (estimatedOutputTokens > config.maxEstimatedOutputTokens) {
    throw new AgentProviderOutputValidationError(
      `Provider output exceeds maxEstimatedOutputTokens: estimatedOutputTokens=${estimatedOutputTokens}, maxEstimatedOutputTokens=${config.maxEstimatedOutputTokens}.`,
    )
  }

  for (const section of REQUIRED_MARKDOWN_SECTIONS) {
    if (!output.markdown.includes(section)) {
      throw new AgentProviderOutputValidationError(
        `Provider output markdown is missing required section: ${section}.`,
      )
    }
  }

  const deniedClaim = EXECUTION_CLAIM_DENYLIST.find((claim) =>
    output.markdown.includes(claim),
  )
  if (deniedClaim) {
    throw new AgentProviderOutputValidationError(
      `Provider output contains a prohibited execution claim: ${deniedClaim}.`,
    )
  }

  if (typeof output.title !== 'string' || output.title.trim() === '') {
    throw new AgentProviderOutputValidationError(
      'Provider output title must be a non-empty string.',
    )
  }

  if (typeof output.summary !== 'string' || output.summary.trim() === '') {
    throw new AgentProviderOutputValidationError(
      'Provider output summary must be a non-empty string.',
    )
  }

  if (typeof output.provider !== 'string' || output.provider.trim() === '') {
    throw new AgentProviderOutputValidationError(
      'Provider output provider must be a non-empty string.',
    )
  }

  if (typeof output.model !== 'string' || output.model.trim() === '') {
    throw new AgentProviderOutputValidationError(
      'Provider output model must be a non-empty string.',
    )
  }

  if (!Array.isArray(output.highlights)) {
    throw new AgentProviderOutputValidationError(
      'Provider output highlights must be an array.',
    )
  }

  for (const highlight of output.highlights) {
    if (typeof highlight !== 'string') {
      throw new AgentProviderOutputValidationError(
        'Provider output highlights must contain only strings.',
      )
    }
  }

  if (output.diagnostics !== undefined) {
    if (!Array.isArray(output.diagnostics)) {
      throw new AgentProviderOutputValidationError(
        'Provider output diagnostics must be an array.',
      )
    }

    if (output.diagnostics.length > MAX_DIAGNOSTIC_ENTRIES) {
      throw new AgentProviderOutputValidationError(
        `Provider output diagnostics must not exceed ${MAX_DIAGNOSTIC_ENTRIES} entries.`,
      )
    }

    for (const diagnostic of output.diagnostics) {
      if (typeof diagnostic !== 'string') {
        throw new AgentProviderOutputValidationError(
          'Provider output diagnostics must contain only strings.',
        )
      }
      if (diagnostic.length > MAX_DIAGNOSTIC_LENGTH) {
        throw new AgentProviderOutputValidationError(
          `Provider output diagnostics entries must not exceed ${MAX_DIAGNOSTIC_LENGTH} characters.`,
        )
      }
      const lowerDiagnostic = diagnostic.toLowerCase()
      const marker = DIAGNOSTIC_SENSITIVE_MARKERS_LOWER.find((value) =>
        lowerDiagnostic.includes(value),
      )
      if (marker) {
        throw new AgentProviderOutputValidationError(
          `Provider output diagnostics contain a prohibited sensitive marker: ${marker}.`,
        )
      }
    }
  }

  return {
    ...output,
    title: output.title.trim(),
    summary: output.summary.trim(),
    provider: output.provider.trim(),
    model: output.model.trim(),
    highlights: output.highlights.slice(0, MAX_HIGHLIGHTS),
    estimatedOutputTokens,
  }
}

export class AgentProviderOutputValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AgentProviderOutputValidationError'
  }
}
