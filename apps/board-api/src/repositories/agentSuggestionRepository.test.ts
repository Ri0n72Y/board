import { describe, expect, it } from 'vitest'
import type {
  AgentSuggestionDetail,
  AgentSuggestionSummary,
} from '@labour-board/shared'
import { MemoryAgentSuggestionRepository } from './agentSuggestionRepository.js'

function makeDetail(
  overrides?: Partial<AgentSuggestionDetail>
): AgentSuggestionDetail {
  return {
    id: crypto.randomUUID(),
    draftId: 'draft-1',
    title: 'Test Suggestion',
    summary: 'Test summary for the suggestion.',
    highlights: ['Highlight 1', 'Highlight 2'],
    status: 'generated',
    createdAt: new Date().toISOString(),
    createdBy: 'test-user',
    provider: 'mock',
    model: 'mock-v1',
    contextHash: 'abc123',
    markdown: '# Full markdown\n\nThis is the full content.',
    skillSnapshots: [],
    audit: {
      providerKind: 'mock',
      providerModel: 'mock-v1',
      generatedAt: '2026-06-24T00:00:00.000Z',
      contextHash: 'abc123',
      contextCharCount: 10,
      skillCharCount: 20,
      instructionCharCount: 0,
      estimatedInputTokens: 8,
      estimatedOutputTokens: 10,
      maxInputChars: 200_000,
      maxOutputChars: 50_000,
      maxEstimatedInputTokens: 50_000,
      maxEstimatedOutputTokens: 12_000,
      budgetCheckStatus: 'passed',
      outputValidationStatus: 'passed',
      realProvider: false,
    },
    ...overrides,
  }
}

describe('MemoryAgentSuggestionRepository', () => {
  // ─── Create and find ───

  it('create and find detail', async () => {
    const repo = new MemoryAgentSuggestionRepository()
    const detail = makeDetail()
    const created = await repo.create(detail)
    expect(created.id).toBe(detail.id)

    const found = await repo.findById(detail.id)
    expect(found).not.toBeNull()
    expect(found!.markdown).toBe(detail.markdown)
    expect(found!.skillSnapshots).toEqual(detail.skillSnapshots)
    expect(found!.audit).toEqual(detail.audit)
  })

  it('findById returns null for missing', async () => {
    const repo = new MemoryAgentSuggestionRepository()
    const found = await repo.findById('nonexistent')
    expect(found).toBeNull()
  })

  // ─── List excludes markdown ───

  it('listByDraftId excludes markdown', async () => {
    const repo = new MemoryAgentSuggestionRepository()
    const d1 = makeDetail({
      draftId: 'draft-x',
      createdAt: '2026-02-01T00:00:00Z',
    })
    const d2 = makeDetail({
      draftId: 'draft-x',
      createdAt: '2026-02-02T00:00:00Z',
    })
    await repo.create(d1)
    await repo.create(d2)

    const list = await repo.listByDraftId('draft-x')
    expect(list.length).toBe(2)
    for (const s of list) {
      expect((s as Record<string, unknown>).markdown).toBeUndefined()
      expect((s as Record<string, unknown>).skillSnapshots).toBeUndefined()
      expect((s as Record<string, unknown>).audit).toBeUndefined()
    }
  })

  // ─── List sorted by createdAt desc ───

  it('list sorted by createdAt desc', async () => {
    const repo = new MemoryAgentSuggestionRepository()
    const d1 = makeDetail({
      draftId: 'draft-y',
      createdAt: '2026-01-01T00:00:00Z',
    })
    const d2 = makeDetail({
      draftId: 'draft-y',
      createdAt: '2026-03-01T00:00:00Z',
    })
    await repo.create(d1)
    await repo.create(d2)

    const list = await repo.listByDraftId('draft-y')
    expect(list[0].createdAt).toBe('2026-03-01T00:00:00Z')
    expect(list[1].createdAt).toBe('2026-01-01T00:00:00Z')
  })

  it('listByDraftId returns empty for unmatched draftId', async () => {
    const repo = new MemoryAgentSuggestionRepository()
    await repo.create(makeDetail({ draftId: 'draft-a' }))
    const list = await repo.listByDraftId('draft-b')
    expect(list.length).toBe(0)
  })

  // ─── Update review ───

  it('updateReview updates status', async () => {
    const repo = new MemoryAgentSuggestionRepository()
    const detail = makeDetail()
    await repo.create(detail)

    const updated = await repo.updateReview(detail.id, 'reviewed')
    expect(updated).not.toBeNull()
    expect(updated!.status).toBe('reviewed')
  })

  it('updateReview returns null for missing', async () => {
    const repo = new MemoryAgentSuggestionRepository()
    const result = await repo.updateReview('nonexistent', 'reviewed')
    expect(result).toBeNull()
  })
})
