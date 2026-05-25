import type {
  BoardConfig,
  CreatePatchInput,
  CreateRecordInput,
  DeepPartial,
  RecordBody,
  RecordQuery,
  RecordItem,
  SchemaName,
  Tag,
} from '@labour-board/shared'
import type { RecordRepository } from '../repositories/recordRepository.js'

export type BoardRecord = RecordItem<RecordBody>

const DEFAULT_PREFIX_BY_SCHEMA: Partial<Record<SchemaName, string>> = {
  CardBody: 'CARD',
  AssetBody: 'ASSET',
  TransactionBody: 'TX',
}

export class RecordValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RecordValidationError'
  }
}

export class RecordService {
  private readonly boardConfig: BoardConfig
  private readonly repository: RecordRepository

  constructor(repository: RecordRepository, boardConfig: BoardConfig) {
    this.repository = repository
    this.boardConfig = boardConfig
  }

  async list(query: RecordQuery): Promise<BoardRecord[]> {
    const records = await this.repository.list({
      includeArchived: query.includeArchived,
      excludeTags: this.boardConfig.snapshot.excludeTags,
    })

    const filtered = records.filter((record) => {
      if (
        !query.includeArchived &&
        !this.shouldIncludeInCurrentBoard(record)
      ) {
        return false
      }

      if (query.id && record.id !== query.id) {
        return false
      }

      if (query.schema && record.schema !== query.schema) {
        return false
      }

      if (query.pid && record.pid !== query.pid) {
        return false
      }

      if (query.assignee && record.assignee !== query.assignee) {
        return false
      }

      if (query.assetId && !record.assets?.includes(query.assetId)) {
        return false
      }

      if (
        query.relationTarget &&
        !record.relations?.some(
          (relation) => relation.target === query.relationTarget
        )
      ) {
        return false
      }

      if (query.tags?.length) {
        const matches =
          query.tagMatch === 'any'
            ? query.tags.some((tag) => record.tags.includes(tag))
            : query.tags.every((tag) => record.tags.includes(tag))
        if (!matches) {
          return false
        }
      }

      if (query.q && !matchesTextQuery(record, query.q)) {
        return false
      }

      return true
    })

    return typeof query.limit === 'number' ? filtered.slice(0, query.limit) : filtered
  }

  async findById(id: string): Promise<BoardRecord | null> {
    const record = await this.repository.findById(id)
    return record && this.shouldIncludeInCurrentBoard(record) ? record : null
  }

  async create(input: CreateRecordInput<RecordBody>): Promise<BoardRecord> {
    this.assertCreateInput(input)

    const id = crypto.randomUUID()
    const pidPrefix = this.resolvePidPrefix(input)
    const record: BoardRecord = {
      id,
      pid: await this.generatePublicId(pidPrefix),
      schema: input.schema,
      body: input.body,
      tags: input.tags ?? [],
      assignee: input.assignee,
      assets: input.assets,
      relations: input.relations,
    }

    return this.repository.create(record)
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

  private async generatePublicId(prefix: string): Promise<string> {
    const records = await this.repository.list({
      includeArchived: true,
      excludeTags: this.boardConfig.snapshot.excludeTags,
    })
    const nextNumber = Math.max(
      this.boardConfig.pid.nextNumber,
      ...records
        .map((record) => parsePublicIdNumber(record.pid, prefix))
        .filter((value): value is number => value !== undefined)
        .map((value) => value + 1)
    )

    return `${prefix}-${nextNumber}`
  }

  private resolvePidPrefix(input: CreateRecordInput<RecordBody>): string {
    const preferredPrefix =
      input.pidPrefix ?? DEFAULT_PREFIX_BY_SCHEMA[input.schema]
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

  private assertCreateInput(input: CreateRecordInput<RecordBody>): void {
    if (!this.boardConfig.records.schemas.includes(input.schema)) {
      throw new RecordValidationError(`Unsupported record schema: ${input.schema}`)
    }

    if (
      input.pidPrefix &&
      !this.boardConfig.pid.prefixes.includes(input.pidPrefix)
    ) {
      throw new RecordValidationError(`Unsupported pid prefix: ${input.pidPrefix}`)
    }

    const configuredTags = getConfiguredTags(this.boardConfig)
    for (const tag of input.tags ?? []) {
      if (!configuredTags.has(tag)) {
        throw new RecordValidationError(`Unsupported tag: ${tag}`)
      }
    }

    for (const relation of input.relations ?? []) {
      if (!this.boardConfig.relations.constraints.includes(relation.constraint)) {
        throw new RecordValidationError(
          `Unsupported relation constraint: ${relation.constraint}`
        )
      }
    }
  }

  private shouldIncludeInCurrentBoard(record: BoardRecord): boolean {
    return !this.boardConfig.snapshot.excludeTags.some((tag) =>
      record.tags.includes(tag)
    )
  }
}

function parsePublicIdNumber(pid: string, prefix: string): number | undefined {
  const match = new RegExp(`^${escapeRegExp(prefix)}-(\\d+)$`).exec(pid)
  if (!match) {
    return undefined
  }

  return Number(match[1])
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function getConfiguredTags(config: BoardConfig): Set<Tag> {
  return new Set([
    ...config.tags.status.required.map((tag) => tag.id),
    ...config.tags.status.custom.map((tag) => tag.id),
    ...config.tags.priority.defaults.map((tag) => tag.id),
    ...config.tags.priority.custom.map((tag) => tag.id),
    ...config.tags.asset.defaults.map((tag) => tag.id),
    ...config.tags.asset.custom.map((tag) => tag.id),
    ...config.tags.transaction.defaults.map((tag) => tag.id),
    ...config.tags.transaction.custom.map((tag) => tag.id),
    ...config.tags.custom.map((tag) => tag.id),
  ])
}

function matchesTextQuery(record: BoardRecord, query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) {
    return true
  }

  const searchableValues = [
    record.id,
    record.pid,
    record.schema,
    record.assignee,
    ...record.tags,
    ...extractBodyText(record.body),
  ]

  return searchableValues.some((value) =>
    value?.toLowerCase().includes(normalizedQuery)
  )
}

function extractBodyText(body: RecordBody): string[] {
  if (!isRecord(body)) {
    return []
  }

  return ['title', 'description', 'content']
    .map((key) => body[key])
    .filter((value): value is string => typeof value === 'string')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
