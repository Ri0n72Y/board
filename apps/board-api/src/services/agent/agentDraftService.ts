import type {
  AgentDraftDetail,
  AgentDraftSummary,
  BoardContextPackOptions,
  BoardExportSource,
  CreateAgentDraftInput,
  PublicKey,
} from '@labour-board/shared'
import {
  buildBoardContextPack,
  getAgentContextProfileDefinition,
  validateAgentContextProfileOptions,
} from '@labour-board/shared'
import type { AgentDraftRepository } from '../../repositories/agentDraftRepository.js'
import type { RecordRepository } from '../../repositories/recordRepository.js'
import type { SnapshotHeadRepository } from '../../repositories/snapshotHeadRepository.js'
import type { SnapshotRepository } from '../../repositories/snapshotRepository.js'
import { getBoardCurrentProjection } from '../boardCurrent/boardCurrentService.js'
import { filterBoardCurrentRecords } from '../boardCurrent/boardCurrentFilter.js'
import { resolveActor } from '../record/recordResponses.js'

export class AgentDraftService {
  private readonly agentDraftRepository: AgentDraftRepository
  private readonly recordRepository: RecordRepository
  private readonly snapshotHeadRepository: SnapshotHeadRepository
  private readonly snapshotRepository: SnapshotRepository

  constructor(
    agentDraftRepository: AgentDraftRepository,
    recordRepository: RecordRepository,
    snapshotHeadRepository: SnapshotHeadRepository,
    snapshotRepository: SnapshotRepository,
  ) {
    this.agentDraftRepository = agentDraftRepository
    this.recordRepository = recordRepository
    this.snapshotHeadRepository = snapshotHeadRepository
    this.snapshotRepository = snapshotRepository
  }

  async createDraft(
    input: CreateAgentDraftInput,
    actor?: PublicKey,
  ): Promise<AgentDraftDetail> {
    // Validate profile
    const profileDefinition = getAgentContextProfileDefinition(input.profile)
    const validationError = validateAgentContextProfileOptions({
      source: input.source,
      profile: input.profile,
      recordId: input.recordId,
      sprintTag: input.sprintTag,
      filters: input.filters,
    })

    if (validationError) {
      throw new AgentDraftValidationError(validationError)
    }

    // Default include flags from profile definition
    const includeContent = input.includeContent ?? profileDefinition.defaultIncludeContent
    const includeAssets = input.includeAssets ?? profileDefinition.defaultIncludeAssets
    const includeRelations = input.includeRelations ?? profileDefinition.defaultIncludeRelations
    const includeDiagnostics = input.includeDiagnostics ?? profileDefinition.defaultIncludeDiagnostics

    const generatedAt = new Date().toISOString()
    const createdBy = resolveActor(actor)

    let snapshotId: string | undefined

    // Build the context pack based on source
    const contextPackOptions: BoardContextPackOptions = {
      source: input.source as BoardExportSource,
      profile: input.profile,
      format: 'markdown',
      ...(input.contextGoal?.trim() ? { contextGoal: input.contextGoal.trim() } : {}),
      ...(input.recordId ? { recordId: input.recordId } : {}),
      ...(input.sprintTag ? { sprintTag: input.sprintTag } : {}),
      ...(input.filters ? { filters: input.filters } : {}),
      includeContent,
      includeAssets,
      includeRelations,
      includeDiagnostics,
      generatedAt,
    }

    let projection: Awaited<ReturnType<typeof getBoardCurrentProjection>>
    let recordCount: number

    if (input.source === 'current-board') {
      projection = await getBoardCurrentProjection({
        repository: this.recordRepository,
        snapshotHeadRepository: this.snapshotHeadRepository,
        query: input.filters,
      })

      // Apply filters if any
      if (input.filters) {
        const filteredRecords = filterBoardCurrentRecords(
          projection.records,
          input.filters,
        )
        projection = {
          ...projection,
          records: filteredRecords,
          summary: {
            ...projection.summary,
            visibleCurrentRecords: filteredRecords.length,
          },
        }
      }

      recordCount = projection.records.length
    } else {
      // Snapshot source
      if (!input.snapshotId) {
        throw new AgentDraftValidationError(
          'snapshotId is required for snapshot source',
        )
      }
      const snapshot = await this.snapshotRepository.findById(input.snapshotId)
      if (!snapshot) {
        throw new AgentDraftNotFoundError(
          `Snapshot ${input.snapshotId} not found`,
        )
      }

      projection = snapshot.projection

      // Apply filters if any
      if (input.filters) {
        const filteredRecords = filterBoardCurrentRecords(
          projection.records,
          input.filters,
        )
        projection = {
          ...projection,
          records: filteredRecords,
          summary: {
            ...projection.summary,
            visibleCurrentRecords: filteredRecords.length,
          },
        }
      }

      recordCount = projection.records.length
      snapshotId = snapshot.id

      contextPackOptions.snapshotId = snapshot.id
      contextPackOptions.snapshotCreatedAt = snapshot.createdAt
      if (snapshot.reason) {
        contextPackOptions.snapshotReason = snapshot.reason
      }
    }

    const contextPack = buildBoardContextPack(projection, contextPackOptions)

    const draft: AgentDraftDetail = {
      id: crypto.randomUUID(),
      title: input.title,
      status: 'draft',
      profile: input.profile,
      source: input.source,
      createdAt: generatedAt,
      createdBy,
      ...(input.contextGoal?.trim() ? { contextGoal: input.contextGoal.trim() } : {}),
      recordCount,
      ...(snapshotId ? { snapshotId } : {}),
      contextMarkdown: contextPack.content,
      contextMeta: contextPack.meta,
      exportOptions: {
        source: contextPackOptions.source,
        profile: contextPackOptions.profile,
        format: contextPackOptions.format,
        ...(contextPackOptions.contextGoal
          ? { contextGoal: contextPackOptions.contextGoal }
          : {}),
        ...(contextPackOptions.recordId ? { recordId: contextPackOptions.recordId } : {}),
        ...(contextPackOptions.sprintTag ? { sprintTag: contextPackOptions.sprintTag } : {}),
        ...(contextPackOptions.filters ? { filters: contextPackOptions.filters } : {}),
        ...(contextPackOptions.snapshotId ? { snapshotId: contextPackOptions.snapshotId } : {}),
        includeContent,
        includeAssets,
        includeRelations,
        includeDiagnostics,
      },
    }

    return this.agentDraftRepository.create(draft)
  }

  async listDrafts(): Promise<AgentDraftSummary[]> {
    return this.agentDraftRepository.list()
  }

  async getDraft(id: string): Promise<AgentDraftDetail | null> {
    return this.agentDraftRepository.findById(id)
  }
}

export class AgentDraftValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AgentDraftValidationError'
  }
}

export class AgentDraftNotFoundError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AgentDraftNotFoundError'
  }
}
