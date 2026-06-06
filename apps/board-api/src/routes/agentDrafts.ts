import { Hono } from 'hono'
import type {
  ApiResponse,
  AgentDraftSource,
  AgentContextProfile,
  CreateAgentDraftInput,
  CreateAgentDraftResponse,
  GetAgentDraftResponse,
  ListAgentDraftsResponse,
  Tag,
} from '@labour-board/shared'
import { getAgentContextProfileDefinition } from '@labour-board/shared'
import { ok, error } from '../http/responses.js'
import type { AgentDraftService } from '../services/agent/agentDraftService.js'
import {
  AgentDraftValidationError,
  AgentDraftNotFoundError,
} from '../services/agent/agentDraftService.js'

const VALID_SOURCES: readonly AgentDraftSource[] = ['current-board', 'snapshot']

export function createAgentDraftsRoute(agentDraftService: AgentDraftService): Hono {
  const route = new Hono()

  route.post('/', async (c) => {
    const actor = c.req.header('x-actor-id') ?? undefined
    try {
      const input = await parseCreateDraftInput(c.req.raw)
      const draft = await agentDraftService.createDraft(input, actor)
      return c.json<ApiResponse<CreateAgentDraftResponse>>(
        ok({ draft }),
        201,
      )
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

  route.get('/', async (c) => {
    const drafts = await agentDraftService.listDrafts()
    return c.json<ApiResponse<ListAgentDraftsResponse>>(ok({ drafts }))
  })

  route.get('/:id', async (c) => {
    const draft = await agentDraftService.getDraft(c.req.param('id'))
    if (!draft) {
      return c.json(
        error('NOT_FOUND', `Agent draft ${c.req.param('id')} not found`),
        404,
      )
    }
    return c.json<ApiResponse<GetAgentDraftResponse>>(ok({ draft }))
  })

  return route
}

async function parseCreateDraftInput(request: Request): Promise<CreateAgentDraftInput> {
  if (!request.headers.get('content-type')?.includes('application/json')) {
    throw new AgentDraftValidationError('Content-Type must be application/json')
  }

  const raw = (await request.json()) as unknown
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new AgentDraftValidationError('Request body must be a JSON object')
  }

  const body = raw as Record<string, unknown>

  // title (required)
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  if (!title) {
    throw new AgentDraftValidationError('title is required')
  }

  // profile (required)
  if (typeof body.profile !== 'string') {
    throw new AgentDraftValidationError('profile is required')
  }
  let profile: AgentContextProfile
  try {
    profile = getAgentContextProfileDefinition(body.profile as AgentContextProfile).id
  } catch {
    throw new AgentDraftValidationError(`Invalid profile: ${body.profile}`)
  }

  // source (required)
  const rawSource = body.source as string | undefined
  if (!rawSource || !VALID_SOURCES.includes(rawSource as AgentDraftSource)) {
    throw new AgentDraftValidationError(
      'source is required and must be current-board or snapshot',
    )
  }
  const source = rawSource as AgentDraftSource

  // snapshotId required for snapshot source
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

  const includeContent = typeof body.includeContent === 'boolean' ? body.includeContent : undefined
  const includeAssets = typeof body.includeAssets === 'boolean' ? body.includeAssets : undefined
  const includeRelations = typeof body.includeRelations === 'boolean' ? body.includeRelations : undefined
  const includeDiagnostics = typeof body.includeDiagnostics === 'boolean' ? body.includeDiagnostics : undefined

  // Parse filters from request body
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
  body: Record<string, unknown>,
): CreateAgentDraftInput['filters'] | undefined {
  const rawFilters = body.filters
  if (rawFilters === undefined || rawFilters === null) return undefined

  if (typeof rawFilters !== 'object' || Array.isArray(rawFilters)) {
    throw new AgentDraftValidationError('filters must be an object')
  }

  const f = rawFilters as Record<string, unknown>
  const filters: NonNullable<CreateAgentDraftInput['filters']> = {}

  if (f.q !== undefined) {
    if (typeof f.q !== 'string') throw new AgentDraftValidationError('filters.q must be a string')
    if (f.q.trim()) filters.q = f.q.trim()
  }

  if (f.tags !== undefined) {
    if (!Array.isArray(f.tags)) throw new AgentDraftValidationError('filters.tags must be an array')
    const tags = f.tags.filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
    if (tags.length > 0) filters.tags = tags as Tag[]
  }

  if (f.tagMatch !== undefined) {
    if (f.tagMatch !== 'all' && f.tagMatch !== 'any') {
      throw new AgentDraftValidationError('filters.tagMatch must be all or any')
    }
    filters.tagMatch = f.tagMatch
  }

  if (f.includeArchived !== undefined) {
    if (typeof f.includeArchived !== 'boolean') {
      throw new AgentDraftValidationError('filters.includeArchived must be a boolean')
    }
    filters.includeArchived = f.includeArchived
  }

  if (f.assignee !== undefined) {
    if (typeof f.assignee !== 'string') throw new AgentDraftValidationError('filters.assignee must be a string')
    if (f.assignee.trim()) filters.assignee = f.assignee.trim()
  }

  if (f.assetId !== undefined) {
    if (typeof f.assetId !== 'string') throw new AgentDraftValidationError('filters.assetId must be a string')
    if (f.assetId.trim()) filters.assetId = f.assetId.trim()
  }

  if (f.relationTarget !== undefined) {
    if (typeof f.relationTarget !== 'string') throw new AgentDraftValidationError('filters.relationTarget must be a string')
    if (f.relationTarget.trim()) filters.relationTarget = f.relationTarget.trim()
  }

  return Object.keys(filters).length > 0 ? filters : undefined
}
