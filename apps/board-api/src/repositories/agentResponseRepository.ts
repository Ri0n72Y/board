import type { Collection, Document, Filter, OptionalId } from 'mongodb'
import type {
  AgentResponseDetail,
  AgentResponseSummary,
} from '@labour-board/shared'

export interface AgentResponseRepository {
  create(response: AgentResponseDetail): Promise<AgentResponseDetail>
  listByDraftId(draftId: string): Promise<AgentResponseSummary[]>
  findById(id: string): Promise<AgentResponseDetail | null>
}

function cloneDetail(response: AgentResponseDetail): AgentResponseDetail {
  return structuredClone(response)
}

function toSummary(response: AgentResponseDetail): AgentResponseSummary {
  const {
    id,
    draftId,
    draftTitle,
    source,
    externalAgentName,
    pastedAt,
    pastedBy,
    responseNote,
    responseLength,
  } = response
  return {
    id,
    draftId,
    draftTitle,
    source,
    ...(externalAgentName ? { externalAgentName } : {}),
    pastedAt,
    pastedBy,
    ...(responseNote ? { responseNote } : {}),
    responseLength,
  }
}

// ─── Memory repository ───

export class MemoryAgentResponseRepository implements AgentResponseRepository {
  private responses: AgentResponseDetail[] = []

  async create(response: AgentResponseDetail): Promise<AgentResponseDetail> {
    const clone = cloneDetail(response)
    this.responses.push(clone)
    return cloneDetail(clone)
  }

  async listByDraftId(draftId: string): Promise<AgentResponseSummary[]> {
    return this.responses
      .filter((r) => r.draftId === draftId)
      .sort((a, b) => b.pastedAt.localeCompare(a.pastedAt))
      .map(toSummary)
      .map((s) => structuredClone(s))
  }

  async findById(id: string): Promise<AgentResponseDetail | null> {
    const response = this.responses.find((item) => item.id === id) ?? null
    return response ? cloneDetail(response) : null
  }
}

// ─── Mongo repository ───

export class MongoAgentResponseRepository implements AgentResponseRepository {
  private readonly collection: Collection<Document>

  constructor(collection: Collection<Document>) {
    this.collection = collection
  }

  async create(response: AgentResponseDetail): Promise<AgentResponseDetail> {
    await this.collection.insertOne(toResponseDoc(response))
    return cloneDetail(response)
  }

  async listByDraftId(draftId: string): Promise<AgentResponseSummary[]> {
    const docs = await this.collection
      .find(responseFilter({ draftId }))
      .sort({ pastedAt: -1 })
      .project<Document>({ responseMarkdown: 0, draftSnapshot: 0 })
      .toArray()
    return docs.map(fromResponseDoc).map(toSummary)
  }

  async findById(id: string): Promise<AgentResponseDetail | null> {
    const doc = await this.collection.findOne(responseFilter({ id }))
    return doc ? fromResponseDoc(doc) : null
  }
}

function responseFilter(extra?: Filter<Document>): Filter<Document> {
  const conditions: Filter<Document>[] = [{ kind: 'agentResponse' }]
  if (extra && Object.keys(extra).length > 0) {
    conditions.push(extra)
  }
  return { $and: conditions } as Filter<Document>
}

function toResponseDoc(response: AgentResponseDetail): OptionalId<Document> {
  return {
    kind: 'agentResponse',
    id: response.id,
    draftId: response.draftId,
    draftTitle: response.draftTitle,
    source: response.source,
    externalAgentName: response.externalAgentName,
    pastedAt: response.pastedAt,
    pastedBy: response.pastedBy,
    responseNote: response.responseNote,
    responseLength: response.responseLength,
    responseMarkdown: response.responseMarkdown,
    draftSnapshot: response.draftSnapshot,
  }
}

function fromResponseDoc(doc: Document): AgentResponseDetail {
  return {
    id: doc.id,
    draftId: doc.draftId,
    draftTitle: doc.draftTitle,
    source: doc.source,
    ...(typeof doc.externalAgentName === 'string' &&
    doc.externalAgentName.trim()
      ? { externalAgentName: doc.externalAgentName }
      : {}),
    pastedAt: doc.pastedAt,
    pastedBy: doc.pastedBy,
    ...(typeof doc.responseNote === 'string' && doc.responseNote.trim()
      ? { responseNote: doc.responseNote }
      : {}),
    responseLength: doc.responseLength,
    responseMarkdown: doc.responseMarkdown,
    draftSnapshot: doc.draftSnapshot,
  }
}
