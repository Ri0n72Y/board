import type {
  CreatePatchInput,
  CreateRecordInput,
  DeepPartial,
  RecordBody,
  RecordQuery,
  RecordItem,
} from '@labour-board/shared'
import type { RecordRepository } from '../repositories/recordRepository.js'

export type BoardRecord = RecordItem<RecordBody>

export class RecordService {
  private readonly repository: RecordRepository

  constructor(repository: RecordRepository) {
    this.repository = repository
  }

  async list(query: RecordQuery): Promise<BoardRecord[]> {
    const records = await this.repository.list({
      includeArchived: query.includeArchived,
    })

    return records.filter((record) => {
      if (!query.includeArchived && record.tags.includes('status:archived')) {
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

      return true
    })
  }

  async findById(id: string): Promise<BoardRecord | null> {
    const record = await this.repository.findById(id)
    return record && !record.tags.includes('status:archived') ? record : null
  }

  async create(input: CreateRecordInput<RecordBody>): Promise<BoardRecord> {
    const id = crypto.randomUUID()
    const record: BoardRecord = {
      id,
      pid: `${input.pidPrefix ?? 'CARD'}-${Date.now()}`,
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
}
