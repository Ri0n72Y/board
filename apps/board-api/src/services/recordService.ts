import type {
  BoardConfig,
  CreateRecordInput,
  CreateRecordPatchInput,
  DeepPartial,
  RecordBody,
  RecordHistoryResponse,
  RecordQuery,
  RecordItem,
} from '@labour-board/shared'
import type { BoardConfigPidWriter } from '../config/boardConfig.js'
import type { StoredRecordDoc, RecordRepository } from '../repositories/recordRepository.js'
import type { SnapshotHead, SnapshotHeadRepository } from '../repositories/snapshotHeadRepository.js'
import { PidAllocator } from './pid/pidAllocator.js'
import { filterRecords } from './record/recordQuery.js'
import { assertCreateInput } from './record/recordValidation.js'
import {
  type BoardRecordResponse,
  type BoardPatchResponse,
  type PatchResult,
  RecordValidationError,
  toRecordResponse,
  toPatchResponse,
  resolveActor,
} from './record/recordResponses.js'
import { submitRecordPatch } from './record/recordPatchSubmit.js'
import { archiveRecord } from './record/recordArchive.js'
import { getRecordHistory } from './record/recordHistoryService.js'
import { getRecordCurrentHead } from './record/recordCurrentHead.js'

// ─── Re-exports for external consumers ───

export type { StoredRecordDoc } from '../repositories/recordRepository.js'
export type { SnapshotHead } from '../repositories/snapshotHeadRepository.js'
export {
  type BoardRecordResponse,
  type BoardPatchResponse,
  type PatchResult,
  RecordValidationError,
  SnapshotConflictError,
  CurrentHeadConflictError,
  DEFAULT_ACTOR,
} from './record/recordResponses.js'

// ─── RecordService façade ───

export class RecordService {
  private readonly boardConfig: BoardConfig
  private readonly pidAllocator: PidAllocator
  private readonly repository: RecordRepository
  private readonly snapshotHeadRepository: SnapshotHeadRepository

  constructor(
    repository: RecordRepository,
    snapshotHeadRepository: SnapshotHeadRepository,
    boardConfig: BoardConfig,
    boardConfigWriter?: BoardConfigPidWriter
  ) {
    this.repository = repository
    this.snapshotHeadRepository = snapshotHeadRepository
    this.boardConfig = boardConfig
    this.pidAllocator = new PidAllocator(
      repository,
      boardConfig,
      boardConfigWriter
    )
  }

  // ─── Snapshot head ───

  async getSnapshotHead(): Promise<Readonly<SnapshotHead>> {
    return this.snapshotHeadRepository.loadSnapshotHead()
  }

  // ─── Record CRUD ───

  async list(query: RecordQuery): Promise<BoardRecordResponse[]> {
    const records = await this.repository.list({
      includeArchived: query.includeArchived,
      excludeTags: this.boardConfig.snapshot.excludeTags,
    })

    const filtered = filterRecords(records, query, this.boardConfig)
    return filtered.map(toRecordResponse)
  }

  async findById(id: string): Promise<BoardRecordResponse | null> {
    const record = await this.repository.findById(id)
    const filtered =
      filterRecords(record ? [record] : [], {}, this.boardConfig)[0] ?? null
    return filtered ? toRecordResponse(filtered) : null
  }

  async create(
    input: CreateRecordInput<RecordBody>,
    createdBy?: string
  ): Promise<BoardRecordResponse> {
    assertCreateInput(input, this.boardConfig)

    const id = crypto.randomUUID()
    const pidPrefix = this.resolvePidPrefix(input)
    const now = new Date().toISOString()
    const actor = resolveActor(createdBy)

    const body: RecordItem<RecordBody> = {
      id,
      pid: await this.pidAllocator.drawPid(pidPrefix, id),
      schema: input.schema,
      body: input.body,
      tags: input.tags ?? [],
      assignee: input.assignee,
      assets: input.assets,
      relations: input.relations,
    }

    const record: StoredRecordDoc = {
      ...body,
      createdBy: actor,
      createdAt: now,
    }
    const saved = await this.repository.create(record)
    return toRecordResponse(saved)
  }

  async reconcilePidState(): Promise<void> {
    await this.pidAllocator.reconcilePidState()
  }

  // ─── Patch submission (delegated) ───

  async createRecordPatch(
    targetId: string,
    input: CreateRecordPatchInput<DeepPartial<RecordBody>>,
    createdBy?: string
  ): Promise<PatchResult | null> {
    return submitRecordPatch({
      targetId,
      input,
      createdBy,
      repository: this.repository,
      boardConfig: this.boardConfig,
    })
  }

  async getRecordCurrentHead(id: string) {
    return getRecordCurrentHead({ recordId: id, repository: this.repository })
  }

  // ─── Patch queries ───

  async findPatchById(id: string): Promise<BoardPatchResponse | null> {
    const patch = await this.repository.findPatchById(id)
    return patch ? toPatchResponse(patch) : null
  }

  async listPatchesByTargetId(targetId: string): Promise<BoardPatchResponse[]> {
    const patches = await this.repository.findPatchesByTargetId(targetId)
    return patches.map(toPatchResponse)
  }

  // ─── Record history (delegated) ───

  async getRecordHistory(
    recordId: string
  ): Promise<RecordHistoryResponse | null> {
    return getRecordHistory({ recordId, repository: this.repository })
  }

  // ─── Archive / delete (delegated) ───

  async delete(id: string): Promise<BoardRecordResponse | null> {
    return archiveRecord({
      id,
      repository: this.repository,
      snapshotHeadRepository: this.snapshotHeadRepository,
    })
  }

  // ─── Private helpers ───

  private resolvePidPrefix(input: CreateRecordInput<RecordBody>): string {
    const preferredPrefix =
      input.pidPrefix ?? this.boardConfig.pid.schemaPrefixes[input.schema]
    const prefixes = this.boardConfig.pid.prefixes

    if (preferredPrefix && prefixes.includes(preferredPrefix)) {
      return preferredPrefix
    }

    const fallbackPrefix = prefixes[0]
    if (!fallbackPrefix) {
      throw new RecordValidationError('No pid prefixes configured')
    }

    return fallbackPrefix
  }
}
