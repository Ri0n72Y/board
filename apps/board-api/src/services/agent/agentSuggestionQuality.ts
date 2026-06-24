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

export function validateSuggestionOutput(
  output: AgentSuggestionProviderOutput,
  config: AgentProviderRuntimeConfig,
): ValidatedSuggestionOutput {
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
