import type {
  CreateRecordInput,
  RecordBody,
  RecordEnvelope,
  RecordQuery,
  UpdateRecordInput,
} from '@labour-board/shared'
import type { RecordRepository } from '../repositories/recordRepository.js'

export type BoardRecord = RecordEnvelope<RecordBody>

export class RecordService {
  private readonly repository: RecordRepository

  constructor(repository: RecordRepository) {
    this.repository = repository
  }

  async list(query: RecordQuery): Promise<BoardRecord[]> {
    const records = await this.repository.list({
      includeDeleted: query.includeDeleted,
    })

    return records.filter((record) => {
      if (!query.includeDeleted && record.meta.deleted) {
        return false
      }

      if (
        query.status &&
        (record.meta.status ?? record.body.card?.status) !== query.status
      ) {
        return false
      }

      if (
        query.parentId &&
        (record.meta.parentId ?? record.body.card?.parentId) !== query.parentId
      ) {
        return false
      }

      if (
        query.projectId &&
        (record.meta.projectId ?? record.body.card?.projectId) !==
          query.projectId
      ) {
        return false
      }

      if (query.tag) {
        const tags = record.meta.tags ?? record.body.card?.tags ?? []
        if (!tags.includes(query.tag)) {
          return false
        }
      }

      return true
    })
  }

  async findById(id: string): Promise<BoardRecord | null> {
    const record = await this.repository.findById(id)
    return record && !record.meta.deleted ? record : null
  }

  async create(input: CreateRecordInput): Promise<BoardRecord> {
    const now = new Date().toISOString()
    const record: BoardRecord = {
      id: input.id ?? crypto.randomUUID(),
      body: input.body,
      meta: {
        ...input.meta,
        createdAt: now,
        updatedAt: now,
        deleted: input.meta?.deleted ?? false,
      },
    }

    return this.repository.create(record)
  }

  async update(
    id: string,
    input: UpdateRecordInput
  ): Promise<BoardRecord | null> {
    return this.repository.update(id, {
      ...input,
      meta: {
        ...input.meta,
        updatedAt: new Date().toISOString(),
      },
    })
  }

  async delete(id: string): Promise<BoardRecord | null> {
    return this.update(id, {
      meta: {
        deleted: true,
      },
    })
  }
}
