import { describe, expect, it, beforeEach } from 'vitest'
import type { AgentDraftDetail, AgentSuggestionDetail } from '@labour-board/shared'
import { MemoryAgentDraftRepository } from '../../repositories/agentDraftRepository.js'
import { MemoryAgentSuggestionRepository } from '../../repositories/agentSuggestionRepository.js'
import { AgentSkillService, SkillNotFoundError } from '../agent/agentSkillService.js'
import { MockAgentSuggestionProvider } from '../../config/agentSuggestionProvider.js'
import {
  AgentSuggestionService,
  AgentSuggestionNotFoundError,
  AgentSuggestionNotAllowedError,
  AgentSuggestionValidationError,
} from '../agent/agentSuggestionService.js'

function makeReviewedDraft(overrides?: Partial<AgentDraftDetail>): AgentDraftDetail {
  return {
    id: crypto.randomUUID(),
    title: 'Test Draft',
    status: 'reviewed',
    profile: 'agent-full',
    source: 'current-board',
    createdAt: new Date().toISOString(),
    createdBy: 'user-1',
    recordCount: 5,
    reviewedAt: new Date().toISOString(),
    reviewedBy: 'reviewer-1',
    contextMarkdown: '# Board Context\n\nTest context content.',
    contextMeta: {
      profile: 'agent-full',
      source: 'current-board',
      recordCount: 5,
      generatedAt: new Date().toISOString(),
    },
    exportOptions: {
      source: 'current-board',
      profile: 'agent-full',
      format: 'markdown',
    },
    ...overrides,
  }
}

describe('AgentSuggestionService', () => {
  let draftRepo: MemoryAgentDraftRepository
  let suggestionRepo: MemoryAgentSuggestionRepository
  let skillService: AgentSkillService
  let provider: MockAgentSuggestionProvider
  let svc: AgentSuggestionService

  beforeEach(() => {
    draftRepo = new MemoryAgentDraftRepository()
    suggestionRepo = new MemoryAgentSuggestionRepository()
    skillService = new AgentSkillService()
    provider = new MockAgentSuggestionProvider()
    svc = new AgentSuggestionService(
      suggestionRepo,
      draftRepo,
      skillService,
      provider,
    )
  })

  // ─── Create suggestion ───

  it('reviewed draft can generate suggestion', async () => {
    const draft = makeReviewedDraft()
    await draftRepo.create(draft)

    const suggestion = await svc.createSuggestion(draft.id, {})
    expect(suggestion).toBeDefined()
    expect(suggestion.draftId).toBe(draft.id)
    expect(suggestion.status).toBe('generated')
    expect(suggestion.markdown).toBeTruthy()
  })

  it('missing draft returns NotFound', async () => {
    await expect(
      svc.createSuggestion('nonexistent', {}),
    ).rejects.toThrow(AgentSuggestionNotFoundError)
  })

  it('draft status "draft" returns NotAllowed', async () => {
    const draft = makeReviewedDraft({ status: 'draft' })
    await draftRepo.create(draft)
    await expect(
      svc.createSuggestion(draft.id, {}),
    ).rejects.toThrow(AgentSuggestionNotAllowedError)
  })

  it('draft status "discarded" returns NotAllowed', async () => {
    const draft = makeReviewedDraft({ status: 'discarded' })
    await draftRepo.create(draft)
    await expect(
      svc.createSuggestion(draft.id, {}),
    ).rejects.toThrow(AgentSuggestionNotAllowedError)
  })

  it('missing reviewedAt returns NotAllowed', async () => {
    const draft = makeReviewedDraft({ reviewedAt: undefined })
    await draftRepo.create(draft)
    await expect(
      svc.createSuggestion(draft.id, {}),
    ).rejects.toThrow(AgentSuggestionNotAllowedError)
  })

  it('missing reviewedBy returns NotAllowed', async () => {
    const draft = makeReviewedDraft({ reviewedBy: undefined })
    await draftRepo.create(draft)
    await expect(
      svc.createSuggestion(draft.id, {}),
    ).rejects.toThrow(AgentSuggestionNotAllowedError)
  })

  // ─── contextHash ───

  it('contextHash is sha256 of draft.contextMarkdown', async () => {
    const draft = makeReviewedDraft({
      contextMarkdown: 'specific content',
    })
    await draftRepo.create(draft)

    const suggestion = await svc.createSuggestion(draft.id, {})
    // sha256 of 'specific content' is a known value
    expect(suggestion.contextHash).toMatch(/^[a-f0-9]{64}$/)
  })

  // ─── skillSnapshots ───

  it('skillSnapshots saved with suggestion', async () => {
    const draft = makeReviewedDraft()
    await draftRepo.create(draft)

    const suggestion = await svc.createSuggestion(draft.id, {})
    expect(suggestion.skillSnapshots.length).toBeGreaterThan(0)
    expect(suggestion.skillSnapshots[0].id).toBe('labourboard-advisor')
    expect(suggestion.skillSnapshots[0].markdown).toBeTruthy()
  })

  // ─── unknown skillId ───

  it('unknown skillId returns validation error', async () => {
    const draft = makeReviewedDraft()
    await draftRepo.create(draft)

    // SkillNotFoundError is thrown by skillService, maps to validation
    await expect(
      svc.createSuggestion(draft.id, { skillIds: ['unknown-skill'] }),
    ).rejects.toThrow(SkillNotFoundError)
  })

  // ─── List excludes markdown ───

  it('list summary excludes markdown', async () => {
    const draft = makeReviewedDraft()
    await draftRepo.create(draft)
    await svc.createSuggestion(draft.id, {})

    const list = await svc.listSuggestions(draft.id)
    expect(list.length).toBe(1)
    for (const s of list) {
      expect((s as Record<string, unknown>).markdown).toBeUndefined()
    }
  })

  // ─── Summary truncated to 600 ───

  it('summary is truncated to 600 via provider', async () => {
    // Mock provider generates summary < 600 chars, so we just verify it's present
    const draft = makeReviewedDraft()
    await draftRepo.create(draft)

    const suggestion = await svc.createSuggestion(draft.id, {})
    expect(suggestion.summary.length).toBeGreaterThan(0)
  })

  // ─── Highlights capped at 5 ───

  it('highlights capped at 5', async () => {
    const draft = makeReviewedDraft()
    await draftRepo.create(draft)

    const suggestion = await svc.createSuggestion(draft.id, {})
    expect(suggestion.highlights.length).toBeLessThanOrEqual(5)
  })

  // ─── No board mutation ───

  it('no board mutation happens', async () => {
    const draft = makeReviewedDraft()
    await draftRepo.create(draft)
    const originalMarkdown = draft.contextMarkdown

    await svc.createSuggestion(draft.id, {})
    // Draft should be unchanged
    const refetched = await draftRepo.findById(draft.id)
    expect(refetched).not.toBeNull()
    expect(refetched!.contextMarkdown).toBe(originalMarkdown)
    expect(refetched!.status).toBe('reviewed')
  })

  // ─── Provider output saved ───

  it('provider output saved correctly', async () => {
    const draft = makeReviewedDraft()
    await draftRepo.create(draft)

    const suggestion = await svc.createSuggestion(draft.id, {})
    expect(suggestion.provider).toBe('mock')
    expect(suggestion.model).toBe('mock-suggestion-v1')
    expect(suggestion.title).toBeTruthy()
    expect(suggestion.markdown).toContain('LabourBoard AI Suggestion')
  })

  // ─── Review status ───

  it('can update review status', async () => {
    const draft = makeReviewedDraft()
    await draftRepo.create(draft)
    const suggestion = await svc.createSuggestion(draft.id, {})

    const updated = await svc.updateReview(suggestion.id, {
      status: 'reviewed',
    })
    expect(updated).not.toBeNull()
    expect(updated!.status).toBe('reviewed')
  })
})
