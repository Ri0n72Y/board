import type { Collection, Document, Filter, OptionalId } from 'mongodb'
import type { AgentDraftDetail, AgentDraftSummary } from '@labour-board/shared'

export interface AgentDraftRepository {
  create(draft: AgentDraftDetail): Promise<AgentDraftDetail>
  list(): Promise<AgentDraftSummary[]>
  findById(id: string): Promise<AgentDraftDetail | null>
}

function cloneDetail(draft: AgentDraftDetail): AgentDraftDetail {
  return structuredClone(draft)
}

function toSummary(draft: AgentDraftDetail): AgentDraftSummary {
  const {
    id,
    title,
    status,
    profile,
    source,
    createdAt,
    createdBy,
    contextGoal,
    recordCount,
    snapshotId,
  } = draft
  return {
    id,
    title,
    status,
    profile,
    source,
    createdAt,
    createdBy,
    ...(contextGoal ? { contextGoal } : {}),
    recordCount,
    ...(snapshotId ? { snapshotId } : {}),
  }
}

// ─── Memory repository ───

export class MemoryAgentDraftRepository implements AgentDraftRepository {
  private drafts: AgentDraftDetail[] = []

  async create(draft: AgentDraftDetail): Promise<AgentDraftDetail> {
    const clone = cloneDetail(draft)
    this.drafts.push(clone)
    return cloneDetail(clone)
  }

  async list(): Promise<AgentDraftSummary[]> {
    return this.drafts
      .map(toSummary)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((draft) => structuredClone(draft))
  }

  async findById(id: string): Promise<AgentDraftDetail | null> {
    const draft = this.drafts.find((item) => item.id === id) ?? null
    return draft ? cloneDetail(draft) : null
  }
}

// ─── Mongo repository ───

export class MongoAgentDraftRepository implements AgentDraftRepository {
  private readonly collection: Collection<Document>

  constructor(collection: Collection<Document>) {
    this.collection = collection
  }

  async create(draft: AgentDraftDetail): Promise<AgentDraftDetail> {
    await this.collection.insertOne(toDraftDoc(draft))
    return cloneDetail(draft)
  }

  async list(): Promise<AgentDraftSummary[]> {
    const docs = await this.collection
      .find(draftFilter())
      .sort({ createdAt: -1 })
      .project<Document>({ contextMarkdown: 0, contextMeta: 0, exportOptions: 0 })
      .toArray()
    return docs.map(fromDraftDoc).map(toSummary)
  }

  async findById(id: string): Promise<AgentDraftDetail | null> {
    const doc = await this.collection.findOne(draftFilter({ id }))
    return doc ? fromDraftDoc(doc) : null
  }
}

function draftFilter(extra?: Filter<Document>): Filter<Document> {
  const conditions: Filter<Document>[] = [{ kind: 'agentDraft' }]
  if (extra && Object.keys(extra).length > 0) {
    conditions.push(extra)
  }
  return { $and: conditions } as Filter<Document>
}

function toDraftDoc(draft: AgentDraftDetail): OptionalId<Document> {
  return {
    kind: 'agentDraft',
    id: draft.id,
    title: draft.title,
    status: draft.status,
    profile: draft.profile,
    source: draft.source,
    createdAt: draft.createdAt,
    createdBy: draft.createdBy,
    contextGoal: draft.contextGoal,
    recordCount: draft.recordCount,
    snapshotId: draft.snapshotId,
    contextMarkdown: draft.contextMarkdown,
    contextMeta: draft.contextMeta,
    exportOptions: draft.exportOptions,
  }
}

function fromDraftDoc(doc: Document): AgentDraftDetail {
  return {
    id: doc.id,
    title: doc.title,
    status: doc.status,
    profile: doc.profile,
    source: doc.source,
    createdAt: doc.createdAt,
    createdBy: doc.createdBy,
    ...(typeof doc.contextGoal === 'string' && doc.contextGoal.trim()
      ? { contextGoal: doc.contextGoal }
      : {}),
    recordCount: doc.recordCount,
    ...(typeof doc.snapshotId === 'string' && doc.snapshotId.trim()
      ? { snapshotId: doc.snapshotId }
      : {}),
    contextMarkdown: doc.contextMarkdown,
    contextMeta: doc.contextMeta,
    exportOptions: doc.exportOptions,
  }
}
