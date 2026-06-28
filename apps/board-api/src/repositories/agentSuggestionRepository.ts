import type { Collection, Document, Filter, OptionalId } from 'mongodb'
import type {
  AgentSuggestionDetail,
  AgentSuggestionStatus,
  AgentSuggestionSummary,
} from '@labour-board/shared'

export interface AgentSuggestionRepository {
  create(suggestion: AgentSuggestionDetail): Promise<AgentSuggestionDetail>
  listByDraftId(draftId: string): Promise<AgentSuggestionSummary[]>
  findById(id: string): Promise<AgentSuggestionDetail | null>
  updateReview(
    id: string,
    status: AgentSuggestionStatus
  ): Promise<AgentSuggestionDetail | null>
}

function cloneDetail(s: AgentSuggestionDetail): AgentSuggestionDetail {
  return structuredClone(s)
}

function toSummary(suggestion: AgentSuggestionDetail): AgentSuggestionSummary {
  const {
    id,
    draftId,
    title,
    summary,
    highlights,
    status,
    createdAt,
    createdBy,
    provider,
    model,
    contextHash,
  } = suggestion
  return {
    id,
    draftId,
    title,
    summary,
    highlights,
    status,
    createdAt,
    createdBy,
    provider,
    model,
    contextHash,
  }
}

// ─── Memory repository ───

export class MemoryAgentSuggestionRepository implements AgentSuggestionRepository {
  private suggestions: AgentSuggestionDetail[] = []

  async create(
    suggestion: AgentSuggestionDetail
  ): Promise<AgentSuggestionDetail> {
    const clone = cloneDetail(suggestion)
    this.suggestions.push(clone)
    return cloneDetail(clone)
  }

  async listByDraftId(draftId: string): Promise<AgentSuggestionSummary[]> {
    return this.suggestions
      .filter((s) => s.draftId === draftId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(toSummary)
  }

  async findById(id: string): Promise<AgentSuggestionDetail | null> {
    const suggestion = this.suggestions.find((item) => item.id === id) ?? null
    return suggestion ? cloneDetail(suggestion) : null
  }

  async updateReview(
    id: string,
    status: AgentSuggestionStatus
  ): Promise<AgentSuggestionDetail | null> {
    const index = this.suggestions.findIndex((item) => item.id === id)
    if (index === -1) return null

    const updated: AgentSuggestionDetail = {
      ...this.suggestions[index],
      status,
    }
    this.suggestions[index] = updated
    return cloneDetail(updated)
  }
}

// ─── Mongo repository ───

export class MongoAgentSuggestionRepository implements AgentSuggestionRepository {
  private readonly collection: Collection<Document>

  constructor(collection: Collection<Document>) {
    this.collection = collection
  }

  async create(
    suggestion: AgentSuggestionDetail
  ): Promise<AgentSuggestionDetail> {
    await this.collection.insertOne(toSuggestionDoc(suggestion))
    return cloneDetail(suggestion)
  }

  async listByDraftId(draftId: string): Promise<AgentSuggestionSummary[]> {
    const docs = await this.collection
      .find(suggestionFilter({ draftId }))
      .sort({ createdAt: -1 })
      .project<Document>({
        markdown: 0,
        skillSnapshots: 0,
        diagnostics: 0,
        audit: 0,
      })
      .toArray()
    return docs.map(fromSuggestionDoc).map(toSummary)
  }

  async findById(id: string): Promise<AgentSuggestionDetail | null> {
    const doc = await this.collection.findOne(suggestionFilter({ id }))
    return doc ? fromSuggestionDoc(doc) : null
  }

  async updateReview(
    id: string,
    status: AgentSuggestionStatus
  ): Promise<AgentSuggestionDetail | null> {
    const result = await this.collection.findOneAndUpdate(
      suggestionFilter({ id }),
      { $set: { status } },
      { returnDocument: 'after' }
    )
    return result ? fromSuggestionDoc(result) : null
  }
}

function suggestionFilter(extra?: Filter<Document>): Filter<Document> {
  const conditions: Filter<Document>[] = [{ kind: 'agentSuggestion' }]
  if (extra && Object.keys(extra).length > 0) {
    conditions.push(extra)
  }
  return { $and: conditions } as Filter<Document>
}

function toSuggestionDoc(
  suggestion: AgentSuggestionDetail
): OptionalId<Document> {
  return {
    kind: 'agentSuggestion',
    id: suggestion.id,
    draftId: suggestion.draftId,
    title: suggestion.title,
    summary: suggestion.summary,
    highlights: suggestion.highlights,
    status: suggestion.status,
    createdAt: suggestion.createdAt,
    createdBy: suggestion.createdBy,
    provider: suggestion.provider,
    model: suggestion.model,
    contextHash: suggestion.contextHash,
    markdown: suggestion.markdown,
    skillSnapshots: suggestion.skillSnapshots,
    diagnostics: suggestion.diagnostics,
    audit: suggestion.audit,
  }
}

function fromSuggestionDoc(doc: Document): AgentSuggestionDetail {
  return {
    id: doc.id,
    draftId: doc.draftId,
    title: doc.title,
    summary: doc.summary,
    highlights: doc.highlights ?? [],
    status: doc.status,
    createdAt: doc.createdAt,
    createdBy: doc.createdBy,
    provider: doc.provider,
    model: doc.model,
    contextHash: doc.contextHash,
    markdown: doc.markdown,
    skillSnapshots: doc.skillSnapshots ?? [],
    diagnostics: doc.diagnostics,
    audit: doc.audit,
  }
}
