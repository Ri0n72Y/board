import { Hono } from 'hono'
import type {
  ApiResponse,
  AgentSuggestionStatus,
  CreateAgentSuggestionInput,
  CreateAgentSuggestionResponse,
  GetAgentSuggestionResponse,
  ListAgentSuggestionsResponse,
  UpdateAgentSuggestionReviewInput,
  UpdateAgentSuggestionReviewResponse,
} from '@labour-board/shared'
import { ok, error } from '../http/responses.js'
import type { AgentSuggestionService } from '../services/agent/agentSuggestionService.js'
import {
  AgentSuggestionValidationError,
  AgentSuggestionNotFoundError,
  AgentSuggestionNotAllowedError,
} from '../services/agent/agentSuggestionService.js'
import { SkillNotFoundError } from '../services/agent/agentSkillService.js'

export function createAgentSuggestionsRoute(
  agentSuggestionService: AgentSuggestionService,
): Hono {
  const route = new Hono()

  // POST /agent/drafts/:draftId/suggestions
  route.post('/drafts/:draftId/suggestions', async (c) => {
    const actor = c.req.header('x-actor-id') ?? undefined
    const draftId = c.req.param('draftId')
    try {
      const input = await parseCreateSuggestionInput(c.req.raw)
      const suggestion = await agentSuggestionService.createSuggestion(
        draftId,
        input,
        actor,
      )
      return c.json<ApiResponse<CreateAgentSuggestionResponse>>(
        ok({ suggestion }),
        201,
      )
    } catch (caught) {
      if (caught instanceof AgentSuggestionValidationError) {
        return c.json(error('INVALID_SUGGESTION', caught.message), 400)
      }
      if (caught instanceof SkillNotFoundError) {
        return c.json(error('INVALID_SUGGESTION', caught.message), 400)
      }
      if (caught instanceof AgentSuggestionNotFoundError) {
        return c.json(error('NOT_FOUND', caught.message), 404)
      }
      if (caught instanceof AgentSuggestionNotAllowedError) {
        return c.json(error('SUGGESTION_NOT_ALLOWED', caught.message), 409)
      }
      throw caught
    }
  })

  // GET /agent/drafts/:draftId/suggestions
  route.get('/drafts/:draftId/suggestions', async (c) => {
    const draftId = c.req.param('draftId')
    try {
      const suggestions =
        await agentSuggestionService.listSuggestions(draftId)
      return c.json<ApiResponse<ListAgentSuggestionsResponse>>(
        ok({ suggestions }),
      )
    } catch (caught) {
      if (caught instanceof AgentSuggestionNotFoundError) {
        return c.json(error('NOT_FOUND', caught.message), 404)
      }
      throw caught
    }
  })

  // GET /agent/suggestions/:suggestionId
  route.get('/suggestions/:suggestionId', async (c) => {
    const suggestion = await agentSuggestionService.getSuggestion(
      c.req.param('suggestionId'),
    )
    if (!suggestion) {
      return c.json(
        error(
          'NOT_FOUND',
          `Agent suggestion ${c.req.param('suggestionId')} not found`,
        ),
        404,
      )
    }
    return c.json<ApiResponse<GetAgentSuggestionResponse>>(
      ok({ suggestion }),
    )
  })

  // PATCH /agent/suggestions/:suggestionId/review (optional)
  route.patch('/suggestions/:suggestionId/review', async (c) => {
    const actor = c.req.header('x-actor-id') ?? undefined
    try {
      const input = await parseUpdateReviewInput(c.req.raw)
      const suggestion = await agentSuggestionService.updateReview(
        c.req.param('suggestionId'),
        input,
        actor,
      )
      if (!suggestion) {
        return c.json(
          error(
            'NOT_FOUND',
            `Agent suggestion ${c.req.param('suggestionId')} not found`,
          ),
          404,
        )
      }
      return c.json<ApiResponse<UpdateAgentSuggestionReviewResponse>>(
        ok({ suggestion }),
      )
    } catch (caught) {
      if (caught instanceof AgentSuggestionValidationError) {
        return c.json(error('INVALID_SUGGESTION_REVIEW', caught.message), 400)
      }
      if (caught instanceof AgentSuggestionNotFoundError) {
        return c.json(error('NOT_FOUND', caught.message), 404)
      }
      throw caught
    }
  })

  return route
}

// ─── Parsers ───

async function parseCreateSuggestionInput(
  request: Request,
): Promise<CreateAgentSuggestionInput> {
  if (
    !request.headers.get('content-type')?.includes('application/json')
  ) {
    throw new AgentSuggestionValidationError(
      'Content-Type must be application/json',
    )
  }
  const raw = (await request.json()) as unknown
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new AgentSuggestionValidationError(
      'Request body must be a JSON object',
    )
  }
  const body = raw as Record<string, unknown>

  const input: CreateAgentSuggestionInput = {}

  // title: optional string
  if (body.title !== undefined && body.title !== null) {
    if (typeof body.title !== 'string') {
      throw new AgentSuggestionValidationError('title must be a string')
    }
    const trimmed = body.title.trim()
    if (trimmed.length > 0) {
      input.title = trimmed
    }
  }

  // instruction: optional string
  if (body.instruction !== undefined && body.instruction !== null) {
    if (typeof body.instruction !== 'string') {
      throw new AgentSuggestionValidationError('instruction must be a string')
    }
    const trimmed = body.instruction.trim()
    if (trimmed.length > 0) {
      input.instruction = trimmed
    }
  }

  // provider: optional string (only "mock" currently)
  if (body.provider !== undefined && body.provider !== null) {
    if (typeof body.provider !== 'string') {
      throw new AgentSuggestionValidationError('provider must be a string')
    }
    const trimmed = body.provider.trim()
    if (trimmed.length === 0) {
      throw new AgentSuggestionValidationError('provider must not be empty')
    }
    input.provider = trimmed
  }

  // skillIds: optional string[] — every element must be a non-empty string
  if (body.skillIds !== undefined && body.skillIds !== null) {
    if (!Array.isArray(body.skillIds)) {
      throw new AgentSuggestionValidationError('skillIds must be an array')
    }
    for (let i = 0; i < body.skillIds.length; i++) {
      const item = body.skillIds[i]
      if (typeof item !== 'string') {
        throw new AgentSuggestionValidationError(
          `skillIds[${i}] must be a string`,
        )
      }
      if (item.trim().length === 0) {
        throw new AgentSuggestionValidationError(
          `skillIds[${i}] must not be empty`,
        )
      }
    }
    input.skillIds = (body.skillIds as string[]).map(
      (s: string) => s.trim(),
    )
  }

  return input
}

async function parseUpdateReviewInput(
  request: Request,
): Promise<UpdateAgentSuggestionReviewInput> {
  if (
    !request.headers.get('content-type')?.includes('application/json')
  ) {
    throw new AgentSuggestionValidationError(
      'Content-Type must be application/json',
    )
  }
  const raw = (await request.json()) as unknown
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new AgentSuggestionValidationError(
      'Request body must be a JSON object',
    )
  }
  const body = raw as Record<string, unknown>

  const VALID_STATUSES: AgentSuggestionStatus[] = [
    'generated',
    'reviewed',
    'discarded',
  ]
  if (
    typeof body.status !== 'string' ||
    !VALID_STATUSES.includes(body.status as AgentSuggestionStatus)
  ) {
    throw new AgentSuggestionValidationError(
      `status is required and must be one of: ${VALID_STATUSES.join(', ')}`,
    )
  }

  return {
    status: body.status as AgentSuggestionStatus,
  }
}
