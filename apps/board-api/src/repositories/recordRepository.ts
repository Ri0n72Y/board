import type { Collection, Document, Filter, OptionalId } from 'mongodb'
import type {
  BoardConfig,
  PublicKey,
  RecordBody,
  RecordItem,
  RecordQuery,
  Tag,
} from '@labour-board/shared'
import { shouldIncludeInSnapshot } from '@labour-board/shared'
import type { StoredPatchDoc } from './snapshotHeadRepository.js'

export type StoredRecordDoc = RecordItem<RecordBody> & {
  createdBy: PublicKey
  createdAt: string
}
export interface RecordRepository {
  list(
    query: Pick<RecordQuery, 'includeArchived'> & {
      excludeTags: BoardConfig['snapshot']['excludeTags']
    }
  ): Promise<StoredRecordDoc[]>
  findById(id: string): Promise<StoredRecordDoc | null>
  findByIds(ids: string[]): Promise<StoredRecordDoc[]>
  findByPid(pid: string): Promise<StoredRecordDoc | null>
  create(record: StoredRecordDoc): Promise<StoredRecordDoc>
  archive(id: string, tags: Tag[]): Promise<StoredRecordDoc | null>
  appendPatch(patch: StoredPatchDoc): Promise<StoredPatchDoc>
  findPatchById(id: string): Promise<StoredPatchDoc | null>
  findPatchesByTargetId(targetId: string): Promise<StoredPatchDoc[]>
  listPatches(): Promise<StoredPatchDoc[]>
}

// ─── helpers for record / patch separation ───

function recordOnlyFilter(extra?: Filter<Document>): Filter<Document> {
  const conditions: Filter<Document>[] = [{ targetId: { $exists: false } }]
  if (extra && Object.keys(extra).length > 0) {
    conditions.push(extra)
  }
  return { $and: conditions } as Filter<Document>
}

function patchOnlyFilter(extra?: Filter<Document>): Filter<Document> {
  const conditions: Filter<Document>[] = [{ targetId: { $exists: true } }]
  if (extra && Object.keys(extra).length > 0) {
    conditions.push(extra)
  }
  return { $and: conditions } as Filter<Document>
}

// ─── helper: strip _id from mongo document (record) ───

function cleanRecord(doc: Document): StoredRecordDoc {
  return {
    id: doc.id,
    pid: doc.pid,
    schema: doc.schema,
    body: doc.body,
    tags: doc.tags,
    assignee: doc.assignee,
    assets: doc.assets,
    relations: doc.relations,
    createdBy: doc.createdBy,
    createdAt: doc.createdAt,
  }
}

// ─── helper: strip _id from mongo document (patch) ───

function cleanPatch(doc: Document): StoredPatchDoc {
  return {
    id: doc.id,
    pid: doc.pid,
    schema: doc.schema,
    targetId: doc.targetId,
    parentId: doc.parentId ?? null,
    tagChanges: doc.tagChanges,
    assignee: doc.assignee,
    body: doc.body,
    assets: doc.assets,
    relations: doc.relations,
    description: doc.description,
    createdBy: doc.createdBy,
    createdAt: doc.createdAt,
  }
}

// ═══════════════════════════════════════════════════════════
//  Memory repository – for tests and dev without MongoDB
// ═══════════════════════════════════════════════════════════

export class MemoryRecordRepository implements RecordRepository {
  private records: StoredRecordDoc[] = []
  private patches: StoredPatchDoc[] = []

  async list(
    query: Pick<RecordQuery, 'includeArchived'> & {
      excludeTags: BoardConfig['snapshot']['excludeTags']
    }
  ): Promise<StoredRecordDoc[]> {
    const source = query.includeArchived
      ? this.records
      : this.records.filter((record) =>
          shouldIncludeInSnapshot(record, query.excludeTags)
        )
    return structuredClone(source)
  }

  async findById(id: string): Promise<StoredRecordDoc | null> {
    const record = this.records.find((record) => record.id === id) ?? null
    return record ? structuredClone(record) : null
  }

  async findByIds(ids: string[]): Promise<StoredRecordDoc[]> {
    const wanted = new Set(ids)
    const matches = this.records.filter((record) => wanted.has(record.id))
    return structuredClone(matches)
  }

  async findByPid(pid: string): Promise<StoredRecordDoc | null> {
    const record = this.records.find((record) => record.pid === pid) ?? null
    return record ? structuredClone(record) : null
  }

  async create(record: StoredRecordDoc): Promise<StoredRecordDoc> {
    const clone = structuredClone(record)
    this.records.push(clone)
    return structuredClone(clone)
  }

  async archive(id: string, tags: Tag[]): Promise<StoredRecordDoc | null> {
    const index = this.records.findIndex((record) => record.id === id)
    if (index === -1) {
      return null
    }

    const current = this.records[index]
    const updated: StoredRecordDoc = {
      ...current,
      tags,
    }

    this.records[index] = updated
    return structuredClone(updated)
  }

  async appendPatch(patch: StoredPatchDoc): Promise<StoredPatchDoc> {
    const clone = structuredClone(patch)
    this.patches.push(clone)
    return structuredClone(clone)
  }

  async findPatchById(id: string): Promise<StoredPatchDoc | null> {
    const patch = this.patches.find((patch) => patch.id === id) ?? null
    return patch ? structuredClone(patch) : null
  }

  async findPatchesByTargetId(targetId: string): Promise<StoredPatchDoc[]> {
    const matches = this.patches.filter((patch) => patch.targetId === targetId)
    return structuredClone(matches)
  }

  async listPatches(): Promise<StoredPatchDoc[]> {
    return structuredClone(this.patches)
  }
}

// ═══════════════════════════════════════════════════════════
//  Mongo repository
// ═══════════════════════════════════════════════════════════

export class MongoRecordRepository implements RecordRepository {
  private readonly collection: Collection<Document>

  constructor(collection: Collection<Document>) {
    this.collection = collection
  }

  async list(
    query: Pick<RecordQuery, 'includeArchived'> & {
      excludeTags: BoardConfig['snapshot']['excludeTags']
    }
  ): Promise<StoredRecordDoc[]> {
    const filter: Filter<Document> = recordOnlyFilter()
    if (!query.includeArchived) {
      filter.tags = { $nin: query.excludeTags as readonly Tag[] }
    }
    const docs = await this.collection.find(filter).toArray()
    return docs.map(cleanRecord)
  }

  async findById(id: string): Promise<StoredRecordDoc | null> {
    const doc = await this.collection.findOne(recordOnlyFilter({ id }))
    return doc ? cleanRecord(doc) : null
  }

  async findByIds(ids: string[]): Promise<StoredRecordDoc[]> {
    if (ids.length === 0) return []
    const docs = await this.collection
      .find(recordOnlyFilter({ id: { $in: ids } }))
      .toArray()
    return docs.map(cleanRecord)
  }

  async findByPid(pid: string): Promise<StoredRecordDoc | null> {
    const doc = await this.collection.findOne(recordOnlyFilter({ pid }))
    return doc ? cleanRecord(doc) : null
  }

  async create(record: StoredRecordDoc): Promise<StoredRecordDoc> {
    await this.collection.insertOne(record as OptionalId<Document>)
    return record
  }

  async archive(id: string, tags: Tag[]): Promise<StoredRecordDoc | null> {
    const current = await this.findById(id)
    if (!current) {
      return null
    }

    const updated: StoredRecordDoc = {
      ...current,
      tags,
    }
    const result = await this.collection.findOneAndReplace(
      recordOnlyFilter({ id }),
      updated,
      { returnDocument: 'after' }
    )

    return result ? cleanRecord(result) : null
  }

  async appendPatch(patch: StoredPatchDoc): Promise<StoredPatchDoc> {
    await this.collection.insertOne({ ...patch } as OptionalId<Document>)
    return patch
  }

  async findPatchById(id: string): Promise<StoredPatchDoc | null> {
    const doc = await this.collection.findOne(patchOnlyFilter({ id }))
    return doc ? cleanPatch(doc) : null
  }

  async findPatchesByTargetId(targetId: string): Promise<StoredPatchDoc[]> {
    const docs = await this.collection
      .find(patchOnlyFilter({ targetId }))
      .toArray()
    return docs.map(cleanPatch)
  }

  async listPatches(): Promise<StoredPatchDoc[]> {
    const docs = await this.collection.find(patchOnlyFilter()).toArray()
    return docs.map(cleanPatch)
  }
}
