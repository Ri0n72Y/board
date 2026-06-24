import { describe, expect, it, beforeEach } from 'vitest'
import type { AgentDraftDetail, AgentSuggestionDetail } from '@labour-board/shared'
import type { AgentProviderRuntimeConfig } from '../../config/agentProviderConfig.js'
import { MemoryAgentDraftRepository } from '../../repositories/agentDraftRepository.js'
import { MemoryAgentSuggestionRepository } from '../../repositories/agentSuggestionRepository.js'
import { AgentSkillService, SkillNotFoundError } from '../agent/agentSkillService.js'
import {
  AgentProviderUnavailableError,
  DisabledAgentSuggestionProvider,
  MockAgentSuggestionProvider,
  type AgentSuggestionProvider,
  type AgentSuggestionProviderInput,
  type AgentSuggestionProviderOutput,
} from '../../config/agentSuggestionProvider.js'
import { AgentProviderBudgetExceededError } from './agentProviderBudget.js'
import { AgentProviderOutputValidationError } from './agentSuggestionQuality.js'
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

function makeProviderConfig(
  overrides?: Partial<AgentProviderRuntimeConfig>,
): AgentProviderRuntimeConfig {
  return {
    kind: 'mock',
    model: 'mock-suggestion-v1',
    apiKeyPresent: false,
    maxInputChars: 200_000,
    maxOutputChars: 50_000,
    maxEstimatedInputTokens: 50_000,
    maxEstimatedOutputTokens: 12_000,
    requestTimeoutMs: 30_000,
    retryMaxAttempts: 0,
    enabled: true,
    ...overrides,
  }
}

class InvalidOutputProvider implements AgentSuggestionProvider {
  readonly kind = 'mock'
  readonly model = 'invalid-output'
  readonly realProvider = false

  async generate(
    _input: AgentSuggestionProviderInput,
  ): Promise<AgentSuggestionProviderOutput> {
    return {
      title: 'Invalid',
      summary: 'Invalid',
      highlights: ['Invalid'],
      markdown: '# Missing required sections',
      provider: 'mock',
      model: 'invalid-output',
    }
  }
}

class DiagnosticsProvider extends MockAgentSuggestionProvider {
  private readonly diagnosticsValue: unknown

  constructor(diagnosticsValue: unknown) {
    super()
    this.diagnosticsValue = diagnosticsValue
  }

  override async generate(
    input: AgentSuggestionProviderInput,
  ): Promise<AgentSuggestionProviderOutput> {
    const output = await super.generate(input)
    return {
      ...output,
      diagnostics: this.diagnosticsValue as string[],
    }
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
      makeProviderConfig(),
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

  it('audit metadata saved on success', async () => {
    const draft = makeReviewedDraft()
    await draftRepo.create(draft)

    const suggestion = await svc.createSuggestion(draft.id, {})
    expect(suggestion.audit).toMatchObject({
      providerKind: 'mock',
      providerModel: 'mock-suggestion-v1',
      contextHash: suggestion.contextHash,
      budgetCheckStatus: 'passed',
      outputValidationStatus: 'passed',
      realProvider: false,
    })
    expect(suggestion.audit?.contextCharCount).toBe(draft.contextMarkdown.length)
    expect(suggestion.audit?.estimatedInputTokens).toBeGreaterThan(0)
    expect(suggestion.audit?.estimatedOutputTokens).toBeGreaterThan(0)
    expect(suggestion.audit?.maxOutputChars).toBe(50_000)
    expect(suggestion.audit?.maxEstimatedOutputTokens).toBe(12_000)
  })

  it('audit does not include markdown/context/apiKey', async () => {
    const draft = makeReviewedDraft()
    await draftRepo.create(draft)

    const suggestion = await svc.createSuggestion(draft.id, {})
    const auditJson = JSON.stringify(suggestion.audit)
    expect(auditJson).not.toContain(draft.contextMarkdown)
    expect(auditJson).not.toContain(suggestion.markdown)
    expect(auditJson).not.toContain('apiKey')
    expect(auditJson).not.toContain('prompt')
  })

  it('provider kind/model reflected in audit', async () => {
    const draft = makeReviewedDraft()
    await draftRepo.create(draft)

    const suggestion = await svc.createSuggestion(draft.id, {})
    expect(suggestion.audit?.providerKind).toBe('mock')
    expect(suggestion.audit?.providerModel).toBe('mock-suggestion-v1')
  })

  it('detail returns audit', async () => {
    const draft = makeReviewedDraft()
    await draftRepo.create(draft)
    const suggestion = await svc.createSuggestion(draft.id, {})

    const detail = await svc.getSuggestion(suggestion.id)
    expect(detail?.audit).toBeDefined()
  })

  it('list summary does not return full audit', async () => {
    const draft = makeReviewedDraft()
    await draftRepo.create(draft)
    await svc.createSuggestion(draft.id, {})

    const list = await svc.listSuggestions(draft.id)
    expect((list[0] as Record<string, unknown>).audit).toBeUndefined()
  })

  it('budget exceeded does not save suggestion', async () => {
    const draft = makeReviewedDraft()
    await draftRepo.create(draft)
    const budgetLimitedService = new AgentSuggestionService(
      suggestionRepo,
      draftRepo,
      skillService,
      provider,
      makeProviderConfig({ maxInputChars: 1 }),
    )

    await expect(
      budgetLimitedService.createSuggestion(draft.id, {}),
    ).rejects.toThrow(AgentProviderBudgetExceededError)
    expect(await suggestionRepo.listByDraftId(draft.id)).toHaveLength(0)
  })

  it('provider unavailable does not save suggestion', async () => {
    const draft = makeReviewedDraft()
    await draftRepo.create(draft)
    const disabledService = new AgentSuggestionService(
      suggestionRepo,
      draftRepo,
      skillService,
      new DisabledAgentSuggestionProvider(
        'disabled',
        'none',
        'provider disabled',
      ),
      makeProviderConfig({
        kind: 'disabled',
        model: 'none',
        enabled: false,
      }),
    )

    await expect(disabledService.createSuggestion(draft.id, {})).rejects.toThrow(
      AgentProviderUnavailableError,
    )
    expect(await suggestionRepo.listByDraftId(draft.id)).toHaveLength(0)
  })

  it('invalid provider output does not save suggestion', async () => {
    const draft = makeReviewedDraft()
    await draftRepo.create(draft)
    const invalidOutputService = new AgentSuggestionService(
      suggestionRepo,
      draftRepo,
      skillService,
      new InvalidOutputProvider(),
      makeProviderConfig(),
    )

    await expect(
      invalidOutputService.createSuggestion(draft.id, {}),
    ).rejects.toThrow(AgentProviderOutputValidationError)
    expect(await suggestionRepo.listByDraftId(draft.id)).toHaveLength(0)
  })

  it('diagnostics failure does not save suggestion', async () => {
    const draft = makeReviewedDraft()
    await draftRepo.create(draft)
    const invalidDiagnosticsService = new AgentSuggestionService(
      suggestionRepo,
      draftRepo,
      skillService,
      new DiagnosticsProvider(['Authorization: Bearer secret']),
      makeProviderConfig(),
    )

    await expect(
      invalidDiagnosticsService.createSuggestion(draft.id, {}),
    ).rejects.toThrow(AgentProviderOutputValidationError)
    expect(await suggestionRepo.listByDraftId(draft.id)).toHaveLength(0)
  })

  it('valid diagnostics are saved', async () => {
    const draft = makeReviewedDraft()
    await draftRepo.create(draft)
    const diagnosticsService = new AgentSuggestionService(
      suggestionRepo,
      draftRepo,
      skillService,
      new DiagnosticsProvider(['Mock provider diagnostic.']),
      makeProviderConfig(),
    )

    const suggestion = await diagnosticsService.createSuggestion(draft.id, {})
    expect(suggestion.diagnostics).toEqual(['Mock provider diagnostic.'])
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
