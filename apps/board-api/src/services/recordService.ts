import type {
  BoardConfig,
  CreatePatchInput,
  CreateRecordInput,
  DeepPartial,
  RecordBody,
  RecordQuery,
  RecordItem,
} from '@labour-board/shared'
import type { BoardConfigPidWriter } from '../config/boardConfig.js'
import type { RecordRepository } from '../repositories/recordRepository.js'
import { PidAllocator } from './pid/pidAllocator.js'
import { filterRecords } from './record/recordQuery.js'
import { assertCreateInput } from './record/recordValidation.js'

export type BoardRecord = RecordItem<RecordBody>

export class RecordValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RecordValidationError'
  }
}

export class RecordService {
  private readonly boardConfig: BoardConfig
  private readonly pidAllocator: PidAllocator
  private readonly repository: RecordRepository

  constructor(
    repository: RecordRepository,
    boardConfig: BoardConfig,
    boardConfigWriter?: BoardConfigPidWriter
  ) {
    this.repository = repository
    this.boardConfig = boardConfig
    this.pidAllocator = new PidAllocator(repository, boardConfig, boardConfigWriter)
  }

  async list(query: RecordQuery): Promise<BoardRecord[]> {
    const records = await this.repository.list({
      includeArchived: query.includeArchived,
      excludeTags: this.boardConfig.snapshot.excludeTags,
    })

    return filterRecords(records, query, this.boardConfig)
  }

  async findById(id: string): Promise<BoardRecord | null> {
    const record = await this.repository.findById(id)
    return filterRecords(record ? [record] : [], {}, this.boardConfig)[0] ?? null
  }

  async create(input: CreateRecordInput<RecordBody>): Promise<BoardRecord> {
    assertCreateInput(input, this.boardConfig)

    const id = crypto.randomUUID()
    const pidPrefix = this.resolvePidPrefix(input)
    const record: BoardRecord = {
      id,
      pid: await this.pidAllocator.drawPid(pidPrefix, id),
      schema: input.schema,
      body: input.body,
      tags: input.tags ?? [],
      assignee: input.assignee,
      assets: input.assets,
      relations: input.relations,
    }

    return this.repository.create(record)
  }

  async reconcilePidState(): Promise<void> {
    await this.pidAllocator.reconcilePidState()
  }

  async update(
    id: string,
    input: CreatePatchInput<DeepPartial<RecordBody>>
  ): Promise<BoardRecord | null> {
    return this.repository.update(id, {
      body: input.body,
      tags: input.tags,
      assignee: input.assignee,
      assets: input.assets,
      relations: input.relations,
      description: input.description,
    })
  }

  async delete(id: string): Promise<BoardRecord | null> {
    const record = await this.repository.findById(id)
    if (!record) {
      return null
    }

    return this.repository.update(id, {
      tags: Array.from(new Set([...record.tags, 'status:archived'])),
    })
  }

  private resolvePidPrefix(input: CreateRecordInput<RecordBody>): string {
    const preferredPrefix = input.pidPrefix ?? this.boardConfig.pid.schemaPrefixes[input.schema]
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
