import type {
  AgentResponseDetail,
  AgentResponseSource,
  AgentResponseSummary,
  CreateAgentResponseInput,
  PublicKey,
} from '@labour-board/shared'
import type { AgentDraftRepository } from '../../repositories/agentDraftRepository.js'
import type { AgentResponseRepository } from '../../repositories/agentResponseRepository.js'
import { resolveActor } from '../record/recordResponses.js'

const MAX_RESPONSE_MARKDOWN_LENGTH = 200_000
const MAX_EXTERNAL_AGENT_NAME_LENGTH = 100
const MAX_RESPONSE_NOTE_LENGTH = 2_000
const VALID_SOURCES: readonly AgentResponseSource[] = ['manual-paste']

export class AgentResponseService {
  private readonly agentResponseRepository: AgentResponseRepository
  private readonly agentDraftRepository: AgentDraftRepository

  constructor(
    agentResponseRepository: AgentResponseRepository,
    agentDraftRepository: AgentDraftRepository
  ) {
    this.agentResponseRepository = agentResponseRepository
    this.agentDraftRepository = agentDraftRepository
  }

  async createResponse(
    draftId: string,
    input: CreateAgentResponseInput,
    actor?: PublicKey
  ): Promise<AgentResponseDetail> {
    // 1. Check draft exists
    const draft = await this.agentDraftRepository.findById(draftId)
    if (!draft) {
      throw new AgentResponseNotFoundError(`Agent draft ${draftId} not found`)
    }

    // 2. Draft must be reviewed
    if (draft.status !== 'reviewed') {
      throw new AgentResponseNotAllowedError(
        `Draft status "${draft.status}" is not "reviewed". Only reviewed drafts can receive Agent responses.`
      )
    }

    // 3. Reviewed metadata must exist
    if (!draft.reviewedAt || !draft.reviewedBy) {
      throw new AgentResponseNotAllowedError(
        'Draft is missing reviewedAt or reviewedBy metadata.'
      )
    }

    // 4. Validate input
    this.validateInput(input)

    // 5. Build response detail
    const now = new Date().toISOString()
    const pastedBy = resolveActor(actor)

    const response: AgentResponseDetail = {
      id: crypto.randomUUID(),
      draftId: draft.id,
      draftTitle: draft.title,
      source: 'manual-paste',
      ...(input.externalAgentName?.trim()
        ? { externalAgentName: input.externalAgentName.trim() }
        : {}),
      ...(input.responseNote?.trim()
        ? { responseNote: input.responseNote.trim() }
        : {}),
      responseMarkdown: input.responseMarkdown,
      responseLength: input.responseMarkdown.length,
      pastedAt: now,
      pastedBy,
      draftSnapshot: {
        id: draft.id,
        title: draft.title,
        status: draft.status,
        profile: draft.profile,
        source: draft.source,
        reviewedAt: draft.reviewedAt,
        reviewedBy: draft.reviewedBy,
      },
    }

    // 6. Save
    return this.agentResponseRepository.create(response)
  }

  async listResponses(draftId: string): Promise<AgentResponseSummary[]> {
    const draft = await this.agentDraftRepository.findById(draftId)
    if (!draft) {
      throw new AgentResponseNotFoundError(`Agent draft ${draftId} not found`)
    }

    return this.agentResponseRepository.listByDraftId(draftId)
  }

  async getResponse(responseId: string): Promise<AgentResponseDetail | null> {
    return this.agentResponseRepository.findById(responseId)
  }

  private validateInput(input: CreateAgentResponseInput): void {
    // source
    if (
      !input.source ||
      !VALID_SOURCES.includes(input.source as AgentResponseSource)
    ) {
      throw new AgentResponseValidationError(`source must be "manual-paste"`)
    }

    // responseMarkdown required
    if (typeof input.responseMarkdown !== 'string') {
      throw new AgentResponseValidationError(
        'responseMarkdown is required and must be a string'
      )
    }
    const trimmed = input.responseMarkdown.trim()
    if (trimmed.length === 0) {
      throw new AgentResponseValidationError(
        'responseMarkdown must not be empty'
      )
    }
    if (trimmed.length > MAX_RESPONSE_MARKDOWN_LENGTH) {
      throw new AgentResponseValidationError(
        `responseMarkdown must not exceed ${MAX_RESPONSE_MARKDOWN_LENGTH} characters`
      )
    }

    // externalAgentName optional, max length
    if (
      input.externalAgentName !== undefined &&
      input.externalAgentName !== null
    ) {
      if (typeof input.externalAgentName !== 'string') {
        throw new AgentResponseValidationError(
          'externalAgentName must be a string'
        )
      }
      if (input.externalAgentName.length > MAX_EXTERNAL_AGENT_NAME_LENGTH) {
        throw new AgentResponseValidationError(
          `externalAgentName must not exceed ${MAX_EXTERNAL_AGENT_NAME_LENGTH} characters`
        )
      }
    }

    // responseNote optional, max length
    if (input.responseNote !== undefined && input.responseNote !== null) {
      if (typeof input.responseNote !== 'string') {
        throw new AgentResponseValidationError('responseNote must be a string')
      }
      if (input.responseNote.length > MAX_RESPONSE_NOTE_LENGTH) {
        throw new AgentResponseValidationError(
          `responseNote must not exceed ${MAX_RESPONSE_NOTE_LENGTH} characters`
        )
      }
    }
  }
}

export class AgentResponseValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AgentResponseValidationError'
  }
}

export class AgentResponseNotFoundError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AgentResponseNotFoundError'
  }
}

export class AgentResponseNotAllowedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AgentResponseNotAllowedError'
  }
}
