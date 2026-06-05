import type { Collection, Document, Filter, OptionalId } from 'mongodb'
import type { SnapshotDetail, SnapshotSummary } from '@labour-board/shared'

export interface SnapshotRepository {
  create(snapshot: SnapshotDetail): Promise<SnapshotDetail>
  list(): Promise<SnapshotSummary[]>
  findById(id: string): Promise<SnapshotDetail | null>
}

function cloneDetail(snapshot: SnapshotDetail): SnapshotDetail {
  return structuredClone(snapshot)
}

function toSummary(snapshot: SnapshotDetail): SnapshotSummary {
  const {
    id,
    createdAt,
    createdBy,
    reason,
    recordCount,
    patchCount,
    source,
    projectionStatus,
  } = snapshot
  return {
    id,
    createdAt,
    createdBy,
    ...(reason ? { reason } : {}),
    recordCount,
    ...(patchCount === undefined ? {} : { patchCount }),
    source,
    projectionStatus,
  }
}

export class MemorySnapshotRepository implements SnapshotRepository {
  private snapshots: SnapshotDetail[] = []

  async create(snapshot: SnapshotDetail): Promise<SnapshotDetail> {
    const clone = cloneDetail(snapshot)
    this.snapshots.push(clone)
    return cloneDetail(clone)
  }

  async list(): Promise<SnapshotSummary[]> {
    return this.snapshots
      .map(toSummary)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((snapshot) => structuredClone(snapshot))
  }

  async findById(id: string): Promise<SnapshotDetail | null> {
    const snapshot = this.snapshots.find((item) => item.id === id) ?? null
    return snapshot ? cloneDetail(snapshot) : null
  }
}

export class MongoSnapshotRepository implements SnapshotRepository {
  private readonly collection: Collection<Document>

  constructor(collection: Collection<Document>) {
    this.collection = collection
  }

  async create(snapshot: SnapshotDetail): Promise<SnapshotDetail> {
    await this.collection.insertOne(toSnapshotDoc(snapshot))
    return cloneDetail(snapshot)
  }

  async list(): Promise<SnapshotSummary[]> {
    const docs = await this.collection
      .find(snapshotFilter())
      .sort({ createdAt: -1 })
      .toArray()
    return docs.map(fromSnapshotDoc).map(toSummary)
  }

  async findById(id: string): Promise<SnapshotDetail | null> {
    const doc = await this.collection.findOne(snapshotFilter({ id }))
    return doc ? fromSnapshotDoc(doc) : null
  }
}

function snapshotFilter(extra?: Filter<Document>): Filter<Document> {
  const conditions: Filter<Document>[] = [{ source: 'manual' }]
  if (extra && Object.keys(extra).length > 0) {
    conditions.push(extra)
  }
  return { $and: conditions } as Filter<Document>
}

function toSnapshotDoc(snapshot: SnapshotDetail): OptionalId<Document> {
  return {
    kind: `manualSnapshot:${snapshot.id}`,
    id: snapshot.id,
    createdAt: snapshot.createdAt,
    createdBy: snapshot.createdBy,
    reason: snapshot.reason,
    recordCount: snapshot.recordCount,
    patchCount: snapshot.patchCount,
    source: snapshot.source,
    projectionStatus: snapshot.projectionStatus,
    projection: snapshot.projection,
  }
}

function fromSnapshotDoc(doc: Document): SnapshotDetail {
  return {
    id: doc.id,
    createdAt: doc.createdAt,
    createdBy: doc.createdBy,
    ...(typeof doc.reason === 'string' && doc.reason.trim()
      ? { reason: doc.reason }
      : {}),
    recordCount: doc.recordCount,
    ...(doc.patchCount === undefined ? {} : { patchCount: doc.patchCount }),
    source: 'manual',
    projectionStatus: doc.projectionStatus,
    projection: doc.projection,
  }
}
