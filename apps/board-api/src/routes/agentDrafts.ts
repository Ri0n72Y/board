import { Hono } from 'hono'
import type {
  ApiResponse,
  AgentDraftSource,
  AgentDraftStatus,
  AgentContextProfile,
  CreateAgentDraftInput,
  CreateAgentDraftResponse,
  CreateAgentResponseResponse,
  GetAgentDraftHandoffResponse,
  GetAgentDraftResponse,
  GetAgentResponseResponse,
  ListAgentDraftsResponse,
  ListAgentResponsesResponse,
  Tag,
  UpdateAgentDraftReviewInput,
  UpdateAgentDraftReviewResponse,
} from '@labour-board/shared'
import { getAgentContextProfileDefinition } from '@labour-board/shared'
import { ok, error } from '../http/responses.js'
import type { AgentDraftService } from '../services/agent/agentDraftService.js'
import type { AgentResponseService } from '../services/agent/agentResponseService.js'
import {
  AgentDraftValidationError,
  AgentDraftNotFoundError,
  AgentDraftHandoffNotReadyError,
} from '../services/agent/agentDraftService.js'
import {
  AgentResponseValidationError,
  AgentResponseNotFoundError,
  AgentResponseNotAllowedError,
} from '../services/agent/agentResponseService.js'

const VALID_SOURCES: readonly AgentDraftSource[] = ['current-board', 'snapshot']

/**
 * Single unified Hono route for ALL agent endpoints.
 * Mounted at /api/v0/agent.
 */
export function createAgentRoute(
  agentDraftService: AgentDraftService,
  agentResponseService: AgentResponseService
): Hono {
  const route = new Hono()

  // ─── Drafts ───

  route.post('/drafts', async (c) => {
    const actor = c.req.header('x-actor-id') ?? undefined
    try {
      const input = await parseCreateDraftInput(c.req.raw)
      const draft = await agentDraftService.createDraft(input, actor)
      return c.json<ApiResponse<CreateAgentDraftResponse>>(ok({ draft }), 201)
    } catch (caught) {
      if (caught instanceof AgentDraftValidationError) {
        return c.json(error('INVALID_DRAFT', caught.message), 400)
      }
      if (caught instanceof AgentDraftNotFoundError) {
        return c.json(error('NOT_FOUND', caught.message), 404)
      }
      throw caught
    }
  })

  route.get('/drafts', async (c) => {
    const drafts = await agentDraftService.listDrafts()
    return c.json<ApiResponse<ListAgentDraftsResponse>>(ok({ drafts }))
  })

  route.get('/drafts/:id/handoff', async (c) => {
    try {
      const handoff = await agentDraftService.getHandoff(c.req.param('id'))
      return c.json<ApiResponse<GetAgentDraftHandoffResponse>>(
        ok({ handoff }),
        200
      )
    } catch (caught) {
      if (caught instanceof AgentDraftNotFoundError) {
        return c.json(error('NOT_FOUND', caught.message), 404)
      }
      if (caught instanceof AgentDraftHandoffNotReadyError) {
        return c.json(error('HANDOFF_NOT_READY', caught.message), 409)
      }
      throw caught
    }
  })

  route.get('/drafts/:id', async (c) => {
    const draft = await agentDraftService.getDraft(c.req.param('id'))
    if (!draft) {
      return c.json(
        error('NOT_FOUND', `Agent draft ${c.req.param('id')} not found`),
        404
      )
    }
    return c.json<ApiResponse<GetAgentDraftResponse>>(ok({ draft }))
  })

  route.patch('/drafts/:id/review', async (c) => {
    const actor = c.req.header('x-actor-id') ?? undefined
    try {
      const input = await parseUpdateReviewInput(c.req.raw)
      const draft = await agentDraftService.updateReview(
        c.req.param('id'),
        input,
        actor
      )
      return c.json<ApiResponse<UpdateAgentDraftReviewResponse>>(ok({ draft }))
    } catch (caught) {
      if (caught instanceof AgentDraftValidationError) {
        return c.json(error('INVALID_REVIEW', caught.message), 400)
      }
      if (caught instanceof AgentDraftNotFoundError) {
        return c.json(error('NOT_FOUND', caught.message), 404)
      }
      throw caught
    }
  })

  // ─── Responses ───

  route.post('/drafts/:id/responses', async (c) => {
    const actor = c.req.header('x-actor-id') ?? undefined
    const draftId = c.req.param('id')
    try {
      const input = await parseCreateResponseInput(c.req.raw, draftId)
      const response = await agentResponseService.createResponse(
        draftId,
        input,
        actor
      )
      return c.json<ApiResponse<CreateAgentResponseResponse>>(
        ok({ response }),
        201
      )
    } catch (caught) {
      if (caught instanceof AgentResponseValidationError) {
        return c.json(error('INVALID_AGENT_RESPONSE', caught.message), 400)
      }
      if (caught instanceof AgentResponseNotFoundError) {
        return c.json(error('NOT_FOUND', caught.message), 404)
      }
      if (caught instanceof AgentResponseNotAllowedError) {
        return c.json(error('RESPONSE_NOT_ALLOWED', caught.message), 409)
      }
      throw caught
    }
  })

  route.get('/drafts/:id/responses', async (c) => {
    const draftId = c.req.param('id')
    try {
      const responses = await agentResponseService.listResponses(draftId)
      return c.json<ApiResponse<ListAgentResponsesResponse>>(ok({ responses }))
    } catch (caught) {
      if (caught instanceof AgentResponseNotFoundError) {
        return c.json(error('NOT_FOUND', caught.message), 404)
      }
      throw caught
    }
  })

  route.get('/responses/:responseId', async (c) => {
    const response = await agentResponseService.getResponse(
      c.req.param('responseId')
    )
    if (!response) {
      return c.json(
        error(
          'NOT_FOUND',
          `Agent response ${c.req.param('responseId')} not found`
        ),
        404
      )
    }
    return c.json<ApiResponse<GetAgentResponseResponse>>(ok({ response }))
  })

  return route
}

// ─── Parsers ───

async function parseUpdateReviewInput(
  request: Request
): Promise<UpdateAgentDraftReviewInput> {
  if (!request.headers.get('content-type')?.includes('application/json')) {
    throw new AgentDraftValidationError('Content-Type must be application/json')
  }
  const raw = (await request.json()) as unknown
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new AgentDraftValidationError('Request body must be a JSON object')
  }
  const body = raw as Record<string, unknown>
  const VALID_STATUSES: AgentDraftStatus[] = ['draft', 'reviewed', 'discarded']
  if (
    typeof body.status !== 'string' ||
    !VALID_STATUSES.includes(body.status as AgentDraftStatus)
  ) {
    throw new AgentDraftValidationError(
      `status is required and must be one of: ${VALID_STATUSES.join(', ')}`
    )
  }
  const status = body.status as AgentDraftStatus
  const reviewNote =
    body.reviewNote !== undefined
      ? typeof body.reviewNote === 'string'
        ? body.reviewNote
        : undefined
      : undefined
  if (body.reviewNote !== undefined && typeof body.reviewNote !== 'string') {
    throw new AgentDraftValidationError('reviewNote must be a string')
  }
  return { status, ...(reviewNote !== undefined ? { reviewNote } : {}) }
}

async function parseCreateDraftInput(
  request: Request
): Promise<CreateAgentDraftInput> {
  if (!request.headers.get('content-type')?.includes('application/json')) {
    throw new AgentDraftValidationError('Content-Type must be application/json')
  }
  const raw = (await request.json()) as unknown
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new AgentDraftValidationError('Request body must be a JSON object')
  }
  const body = raw as Record<string, unknown>
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  if (!title) throw new AgentDraftValidationError('title is required')
  if (typeof body.profile !== 'string')
    throw new AgentDraftValidationError('profile is required')
  let profile: AgentContextProfile
  try {
    profile = getAgentContextProfileDefinition(
      body.profile as AgentContextProfile
    ).id
  } catch {
    throw new AgentDraftValidationError(`Invalid profile: ${body.profile}`)
  }
  const rawSource = body.source as string | undefined
  if (!rawSource || !VALID_SOURCES.includes(rawSource as AgentDraftSource)) {
    throw new AgentDraftValidationError(
      'source is required and must be current-board or snapshot'
    )
  }
  const source = rawSource as AgentDraftSource
  const snapshotId =
    typeof body.snapshotId === 'string' && body.snapshotId.trim()
      ? body.snapshotId.trim()
      : undefined
  const contextGoal =
    typeof body.contextGoal === 'string' && body.contextGoal.trim()
      ? body.contextGoal.trim()
      : undefined
  const recordId =
    typeof body.recordId === 'string' && body.recordId.trim()
      ? body.recordId.trim()
      : undefined
  const sprintTag =
    typeof body.sprintTag === 'string' && body.sprintTag.trim()
      ? body.sprintTag.trim()
      : undefined
  const includeContent =
    typeof body.includeContent === 'boolean' ? body.includeContent : undefined
  const includeAssets =
    typeof body.includeAssets === 'boolean' ? body.includeAssets : undefined
  const includeRelations =
    typeof body.includeRelations === 'boolean'
      ? body.includeRelations
      : undefined
  const includeDiagnostics =
    typeof body.includeDiagnostics === 'boolean'
      ? body.includeDiagnostics
      : undefined
  const filters = parseFilters(body)
  return {
    title,
    profile,
    source,
    ...(contextGoal ? { contextGoal } : {}),
    ...(recordId ? { recordId } : {}),
    ...(sprintTag ? { sprintTag } : {}),
    ...(snapshotId ? { snapshotId } : {}),
    ...(filters ? { filters } : {}),
    ...(includeContent !== undefined ? { includeContent } : {}),
    ...(includeAssets !== undefined ? { includeAssets } : {}),
    ...(includeRelations !== undefined ? { includeRelations } : {}),
    ...(includeDiagnostics !== undefined ? { includeDiagnostics } : {}),
  }
}

function parseFilters(
  body: Record<string, unknown>
): CreateAgentDraftInput['filters'] | undefined {
  const rawFilters = body.filters
  if (rawFilters === undefined || rawFilters === null) return undefined
  if (typeof rawFilters !== 'object' || Array.isArray(rawFilters))
    throw new AgentDraftValidationError('filters must be an object')
  const f = rawFilters as Record<string, unknown>
  const filters: NonNullable<CreateAgentDraftInput['filters']> = {}
  if (f.q !== undefined) {
    if (typeof f.q !== 'string')
      throw new AgentDraftValidationError('filters.q must be a string')
    if (f.q.trim()) filters.q = f.q.trim()
  }
  if (f.tags !== undefined) {
    if (!Array.isArray(f.tags))
      throw new AgentDraftValidationError('filters.tags must be an array')
    const tags = f.tags.filter(
      (t): t is string => typeof t === 'string' && t.trim().length > 0
    )
    if (tags.length > 0) filters.tags = tags as Tag[]
  }
  if (f.tagMatch !== undefined) {
    if (f.tagMatch !== 'all' && f.tagMatch !== 'any')
      throw new AgentDraftValidationError('filters.tagMatch must be all or any')
    filters.tagMatch = f.tagMatch
  }
  if (f.includeArchived !== undefined) {
    if (typeof f.includeArchived !== 'boolean')
      throw new AgentDraftValidationError(
        'filters.includeArchived must be a boolean'
      )
    filters.includeArchived = f.includeArchived
  }
  if (f.assignee !== undefined) {
    if (typeof f.assignee !== 'string')
      throw new AgentDraftValidationError('filters.assignee must be a string')
    if (f.assignee.trim()) filters.assignee = f.assignee.trim()
  }
  if (f.assetId !== undefined) {
    if (typeof f.assetId !== 'string')
      throw new AgentDraftValidationError('filters.assetId must be a string')
    if (f.assetId.trim()) filters.assetId = f.assetId.trim()
  }
  if (f.relationTarget !== undefined) {
    if (typeof f.relationTarget !== 'string')
      throw new AgentDraftValidationError(
        'filters.relationTarget must be a string'
      )
    if (f.relationTarget.trim())
      filters.relationTarget = f.relationTarget.trim()
  }
  return Object.keys(filters).length > 0 ? filters : undefined
}

async function parseCreateResponseInput(
  request: Request,
  draftId: string
): Promise<{
  draftId: string
  source: 'manual-paste'
  responseMarkdown: string
  externalAgentName?: string
  responseNote?: string
}> {
  if (!request.headers.get('content-type')?.includes('application/json'))
    throw new AgentResponseValidationError(
      'Content-Type must be application/json'
    )
  const raw = (await request.json()) as unknown
  if (!raw || typeof raw !== 'object' || Array.isArray(raw))
    throw new AgentResponseValidationError('Request body must be a JSON object')
  const body = raw as Record<string, unknown>
  const source = body.source as string | undefined
  if (typeof source !== 'string' || source !== 'manual-paste')
    throw new AgentResponseValidationError('source must be "manual-paste"')
  const externalAgentName =
    typeof body.externalAgentName === 'string' && body.externalAgentName.trim()
      ? body.externalAgentName.trim()
      : undefined
  if (
    body.externalAgentName !== undefined &&
    typeof body.externalAgentName !== 'string'
  )
    throw new AgentResponseValidationError('externalAgentName must be a string')
  const responseNote =
    typeof body.responseNote === 'string' && body.responseNote.trim()
      ? body.responseNote.trim()
      : undefined
  if (body.responseNote !== undefined && typeof body.responseNote !== 'string')
    throw new AgentResponseValidationError('responseNote must be a string')
  if (typeof body.responseMarkdown !== 'string')
    throw new AgentResponseValidationError(
      'responseMarkdown is required and must be a string'
    )
  const responseMarkdown = body.responseMarkdown as string
  if (responseMarkdown.trim().length === 0)
    throw new AgentResponseValidationError('responseMarkdown must not be empty')
  return {
    draftId,
    source: 'manual-paste',
    responseMarkdown,
    ...(externalAgentName ? { externalAgentName } : {}),
    ...(responseNote ? { responseNote } : {}),
  }
}
