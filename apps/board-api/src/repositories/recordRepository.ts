import type { Collection, Document, Filter, OptionalId } from 'mongodb'
import type {
  DeepPartial,
  PatchItem,
  RecordBody,
  RecordId,
  RecordItem,
  RecordQuery,
  Tag,
} from '@labour-board/shared'
import {
  DEFAULT_BOARD_CONFIG,
  applyRecordPatch,
  shouldIncludeInSnapshot,
} from '@labour-board/shared'

export type BoardRecord = RecordItem<RecordBody>

export interface RecordMutationInput {
  body?: DeepPartial<RecordBody>
  tags?: Tag[]
  assignee?: string
  assets?: BoardRecord['assets']
  relations?: BoardRecord['relations']
  description?: string
}

export interface RecordRepository {
  list(query: Pick<RecordQuery, 'includeArchived'>): Promise<BoardRecord[]>
  findById(id: string): Promise<BoardRecord | null>
  create(record: BoardRecord): Promise<BoardRecord>
  update(id: string, input: RecordMutationInput): Promise<BoardRecord | null>
}

type MongoRecordDocument = BoardRecord & Document

function withoutMongoId(document: MongoRecordDocument): BoardRecord {
  return {
    id: document.id,
    pid: document.pid,
    schema: document.schema,
    body: document.body,
    tags: document.tags,
    assignee: document.assignee,
    assets: document.assets,
    relations: document.relations,
  }
}

export class MemoryRecordRepository implements RecordRepository {
  private records: BoardRecord[] = []

  async list(
    query: Pick<RecordQuery, 'includeArchived'>
  ): Promise<BoardRecord[]> {
    if (query.includeArchived) {
      return [...this.records]
    }

    return this.records.filter((record) => shouldIncludeInSnapshot(record))
  }

  async findById(id: string): Promise<BoardRecord | null> {
    return this.records.find((record) => record.id === id) ?? null
  }

  async create(record: BoardRecord): Promise<BoardRecord> {
    this.records.push(record)
    return record
  }

  async update(
    id: string,
    input: RecordMutationInput
  ): Promise<BoardRecord | null> {
    const index = this.records.findIndex((record) => record.id === id)
    if (index === -1) {
      return null
    }

    const current = this.records[index]
    const updated = applyRecordPatch(current, toPatchItem(current, input))

    this.records[index] = updated
    return updated
  }
}

export class MongoRecordRepository implements RecordRepository {
  private readonly collection: Collection<MongoRecordDocument>

  constructor(collection: Collection<MongoRecordDocument>) {
    this.collection = collection
  }

  async list(
    query: Pick<RecordQuery, 'includeArchived'>
  ): Promise<BoardRecord[]> {
    const filter: Filter<MongoRecordDocument> = query.includeArchived
      ? {}
      : {
          tags: {
            $nin: DEFAULT_BOARD_CONFIG.snapshot.excludeTags as readonly Tag[],
          },
        }
    const records = await this.collection.find(filter).toArray()
    return records.map(withoutMongoId)
  }

  async findById(id: string): Promise<BoardRecord | null> {
    const record = await this.collection.findOne({ id })
    return record ? withoutMongoId(record) : null
  }

  async create(record: BoardRecord): Promise<BoardRecord> {
    await this.collection.insertOne(record as OptionalId<MongoRecordDocument>)
    return record
  }

  async update(
    id: string,
    input: RecordMutationInput
  ): Promise<BoardRecord | null> {
    const current = await this.findById(id)
    if (!current) {
      return null
    }

    const updated = applyRecordPatch(current, toPatchItem(current, input))
    const result = await this.collection.findOneAndReplace({ id }, updated, {
      returnDocument: 'after',
    })

    return result ? withoutMongoId(result) : null
  }
}

function toPatchItem(
  record: BoardRecord,
  input: RecordMutationInput
): PatchItem<DeepPartial<RecordBody>> {
  return {
    id: crypto.randomUUID() as RecordId,
    pid: record.pid,
    schema: record.schema,
    targetId: record.id,
    tags: input.tags,
    assignee: input.assignee,
    body: input.body,
    assets: input.assets,
    relations: input.relations,
    description: input.description,
  }
}
