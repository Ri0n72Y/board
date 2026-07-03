import { createHash } from 'node:crypto'
import type {
  AgentSuggestionDetail,
  AgentSuggestionStatus,
  AgentSuggestionSummary,
  CreateAgentSuggestionInput,
  PublicKey,
  UpdateAgentSuggestionReviewInput,
} from '@labour-board/shared'
import type { AgentDraftRepository } from '../../repositories/agentDraftRepository.js'
import type { AgentSuggestionRepository } from '../../repositories/agentSuggestionRepository.js'
import type { AgentSuggestionProvider } from '../../config/agentSuggestionProvider.js'
import type { AgentProviderRuntimeConfig } from '../../config/agentProviderConfig.js'
import { loadAgentProviderRuntimeConfig } from '../../config/agentProviderConfig.js'
import type { AgentSkillService } from './agentSkillService.js'
import { resolveActor } from '../record/recordResponses.js'
import {
  buildSuggestionBudgetInput,
  checkSuggestionBudget,
} from './agentProviderBudget.js'
import { validateSuggestionOutput } from './agentSuggestionQuality.js'

const MAX_TITLE_LENGTH = 200
const MAX_INSTRUCTION_LENGTH = 5_000
const MAX_SUMMARY_LENGTH = 600
const MAX_HIGHLIGHTS = 5

export class AgentSuggestionService {
  private readonly suggestionRepository: AgentSuggestionRepository
  private readonly draftRepository: AgentDraftRepository
  private readonly skillService: AgentSkillService
  private readonly provider: AgentSuggestionProvider
  private readonly providerConfig: AgentProviderRuntimeConfig

  constructor(
    suggestionRepository: AgentSuggestionRepository,
    draftRepository: AgentDraftRepository,
    skillService: AgentSkillService,
    provider: AgentSuggestionProvider,
    providerConfig: AgentProviderRuntimeConfig = loadAgentProviderRuntimeConfig()
  ) {
    this.suggestionRepository = suggestionRepository
    this.draftRepository = draftRepository
    this.skillService = skillService
    this.provider = provider
    this.providerConfig = providerConfig
  }

  async createSuggestion(
    draftId: string,
    input: CreateAgentSuggestionInput,
    actor?: PublicKey
  ): Promise<AgentSuggestionDetail> {
    // 1. Draft must exist
    const draft = await this.draftRepository.findById(draftId)
    if (!draft) {
      throw new AgentSuggestionNotFoundError(`Agent draft ${draftId} not found`)
    }

    // 2. Draft must be reviewed
    if (draft.status !== 'reviewed') {
      throw new AgentSuggestionNotAllowedError(
        `Draft status "${draft.status}" is not "reviewed". Only reviewed drafts can generate AI suggestions.`
      )
    }

    if (!draft.reviewedAt || !draft.reviewedBy) {
      throw new AgentSuggestionNotAllowedError(
        'Draft is missing reviewedAt or reviewedBy metadata.'
      )
    }

    // 3. Validate input
    this.validateInput(input)

    // 4. Load skill snapshots (validates all skillIds exist)
    const skillSnapshots = await this.skillService.resolveSkillSnapshots(
      input.skillIds
    )

    // 5. Check provider input budget before any provider call.
    const instruction = input.instruction?.trim()
    const budgetInput = buildSuggestionBudgetInput(
      draft.contextMarkdown,
      skillSnapshots,
      instruction
    )
    checkSuggestionBudget(budgetInput, this.providerConfig)

    // 6. Compute context hash
    const contextHash = createHash('sha256')
      .update(draft.contextMarkdown)
      .digest('hex')

    // 7. Call provider
    const providerOutput = await this.provider.generate({
      contextMarkdown: draft.contextMarkdown,
      skillSnapshots,
      instruction,
      draftId: draft.id,
      draftTitle: draft.title,
      draftProfile: draft.profile,
      draftSource: draft.source,
      draftRecordCount: draft.recordCount,
      title: input.title?.trim(),
    })

    // 8. Validate provider output before saving.
    const validatedOutput = validateSuggestionOutput(
      providerOutput,
      this.providerConfig
    )

    // 9. Build suggestion detail
    const now = new Date().toISOString()
    const createdBy = resolveActor(actor)

    // Truncate summary to max length
    const summary =
      validatedOutput.summary.length > MAX_SUMMARY_LENGTH
        ? validatedOutput.summary.slice(0, MAX_SUMMARY_LENGTH - 3) + '...'
        : validatedOutput.summary

    const highlights = validatedOutput.highlights.slice(0, MAX_HIGHLIGHTS)

    const suggestion: AgentSuggestionDetail = {
      id: crypto.randomUUID(),
      draftId: draft.id,
      title: validatedOutput.title,
      summary,
      highlights,
      status: 'generated',
      createdAt: now,
      createdBy,
      provider: validatedOutput.provider,
      model: validatedOutput.model,
      contextHash,
      markdown: validatedOutput.markdown,
      skillSnapshots,
      diagnostics: validatedOutput.diagnostics,
      audit: {
        providerKind: this.provider.kind,
        providerModel: validatedOutput.model,
        generatedAt: now,
        contextHash,
        contextCharCount: budgetInput.contextCharCount,
        skillCharCount: budgetInput.skillCharCount,
        instructionCharCount: budgetInput.instructionCharCount,
        estimatedInputTokens: budgetInput.estimatedInputTokens,
        estimatedOutputTokens: validatedOutput.estimatedOutputTokens,
        maxInputChars: this.providerConfig.maxInputChars,
        maxOutputChars: this.providerConfig.maxOutputChars,
        maxEstimatedInputTokens: this.providerConfig.maxEstimatedInputTokens,
        maxEstimatedOutputTokens: this.providerConfig.maxEstimatedOutputTokens,
        budgetCheckStatus: 'passed',
        outputValidationStatus: 'passed',
        realProvider: this.provider.realProvider,
      },
    }

    return this.suggestionRepository.create(suggestion)
  }

  async listSuggestions(draftId: string): Promise<AgentSuggestionSummary[]> {
    const draft = await this.draftRepository.findById(draftId)
    if (!draft) {
      throw new AgentSuggestionNotFoundError(`Agent draft ${draftId} not found`)
    }

    return this.suggestionRepository.listByDraftId(draftId)
  }

  async getSuggestion(
    suggestionId: string
  ): Promise<AgentSuggestionDetail | null> {
    return this.suggestionRepository.findById(suggestionId)
  }

  async updateReview(
    suggestionId: string,
    input: UpdateAgentSuggestionReviewInput,
    _actor?: PublicKey
  ): Promise<AgentSuggestionDetail | null> {
    const VALID_STATUSES: AgentSuggestionStatus[] = [
      'generated',
      'reviewed',
      'discarded',
    ]
    if (!VALID_STATUSES.includes(input.status)) {
      throw new AgentSuggestionValidationError(
        `Invalid status: ${input.status}. Must be one of: ${VALID_STATUSES.join(', ')}`
      )
    }

    const existing = await this.suggestionRepository.findById(suggestionId)
    if (!existing) {
      throw new AgentSuggestionNotFoundError(
        `Agent suggestion ${suggestionId} not found`
      )
    }

    return this.suggestionRepository.updateReview(suggestionId, input.status)
  }

  private validateInput(input: CreateAgentSuggestionInput): void {
    if (input.title !== undefined && input.title !== null) {
      if (typeof input.title !== 'string') {
        throw new AgentSuggestionValidationError('title must be a string')
      }
      if (input.title.length > MAX_TITLE_LENGTH) {
        throw new AgentSuggestionValidationError(
          `title must not exceed ${MAX_TITLE_LENGTH} characters`
        )
      }
    }

    if (input.instruction !== undefined && input.instruction !== null) {
      if (typeof input.instruction !== 'string') {
        throw new AgentSuggestionValidationError('instruction must be a string')
      }
      if (input.instruction.length > MAX_INSTRUCTION_LENGTH) {
        throw new AgentSuggestionValidationError(
          `instruction must not exceed ${MAX_INSTRUCTION_LENGTH} characters`
        )
      }
    }

    if (input.skillIds !== undefined && input.skillIds !== null) {
      if (!Array.isArray(input.skillIds)) {
        throw new AgentSuggestionValidationError('skillIds must be an array')
      }
      for (const id of input.skillIds) {
        if (typeof id !== 'string') {
          throw new AgentSuggestionValidationError(
            'each skillId must be a string'
          )
        }
      }
    }

    if (input.provider !== undefined && input.provider !== null) {
      if (
        typeof input.provider !== 'string' ||
        input.provider.trim().length === 0
      ) {
        throw new AgentSuggestionValidationError(
          'provider must be a non-empty string'
        )
      }
      const requestedProvider = input.provider.trim()
      if (requestedProvider !== this.providerConfig.kind) {
        throw new AgentSuggestionValidationError(
          `Requested provider "${requestedProvider}" does not match configured provider "${this.providerConfig.kind}". Provider fallback is not allowed.`
        )
      }
    }
  }
}

export class AgentSuggestionValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AgentSuggestionValidationError'
  }
}

export class AgentSuggestionNotFoundError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AgentSuggestionNotFoundError'
  }
}

export class AgentSuggestionNotAllowedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AgentSuggestionNotAllowedError'
  }
}
