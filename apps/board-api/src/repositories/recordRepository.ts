import type { Collection, Document, OptionalId } from 'mongodb'
import type {
  RecordBody,
  RecordEnvelope,
  RecordQuery,
  UpdateRecordInput,
} from '@labour-board/shared'

export type BoardRecord = RecordEnvelope<RecordBody>

export interface RecordRepository {
  list(query: Pick<RecordQuery, 'includeDeleted'>): Promise<BoardRecord[]>
  findById(id: string): Promise<BoardRecord | null>
  create(record: BoardRecord): Promise<BoardRecord>
  update(id: string, input: UpdateRecordInput): Promise<BoardRecord | null>
}

type MongoRecordDocument = BoardRecord & Document

function withoutMongoId(document: MongoRecordDocument): BoardRecord {
  return {
    id: document.id,
    body: document.body,
    meta: document.meta,
  }
}

export class MemoryRecordRepository implements RecordRepository {
  private records: BoardRecord[] = []

  async list(
    query: Pick<RecordQuery, 'includeDeleted'>
  ): Promise<BoardRecord[]> {
    if (query.includeDeleted) {
      return [...this.records]
    }

    return this.records.filter((record) => !record.meta.deleted)
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
    input: UpdateRecordInput
  ): Promise<BoardRecord | null> {
    const index = this.records.findIndex((record) => record.id === id)
    if (index === -1) {
      return null
    }

    const current = this.records[index]
    const updated: BoardRecord = {
      ...current,
      body: {
        ...current.body,
        ...input.body,
      },
      meta: {
        ...current.meta,
        ...input.meta,
      },
    }

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
    query: Pick<RecordQuery, 'includeDeleted'>
  ): Promise<BoardRecord[]> {
    const filter = query.includeDeleted ? {} : { 'meta.deleted': { $ne: true } }
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
    input: UpdateRecordInput
  ): Promise<BoardRecord | null> {
    const set = {
      ...(input.body
        ? Object.fromEntries(
            Object.entries(input.body).map(([key, value]) => [
              `body.${key}`,
              value,
            ])
          )
        : {}),
      ...(input.meta
        ? Object.fromEntries(
            Object.entries(input.meta).map(([key, value]) => [
              `meta.${key}`,
              value,
            ])
          )
        : {}),
    }

    const result = await this.collection.findOneAndUpdate(
      { id },
      { $set: set },
      { returnDocument: 'after' }
    )

    return result ? withoutMongoId(result) : null
  }
}
