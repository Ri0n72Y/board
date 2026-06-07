import type { Hono } from 'hono'
import type {
  ApiResponse,
  CreateAgentResponseResponse,
  GetAgentResponseResponse,
  ListAgentResponsesResponse,
} from '@labour-board/shared'
import { ok, error } from '../http/responses.js'
import type { AgentResponseService } from '../services/agent/agentResponseService.js'
import {
  AgentResponseValidationError,
  AgentResponseNotFoundError,
  AgentResponseNotAllowedError,
} from '../services/agent/agentResponseService.js'

export function mountAgentResponseRoutes(
  app: Hono,
  agentResponseService: AgentResponseService,
): void {
  // POST /api/v0/agent/drafts/:id/responses
  app.post('/api/v0/agent/drafts/:id/responses', async (c) => {
    const actor = c.req.header('x-actor-id') ?? undefined
    const draftId = c.req.param('id')
    try {
      const input = await parseCreateResponseInput(c.req.raw, draftId)
      const response = await agentResponseService.createResponse(
        draftId,
        input,
        actor,
      )
      return c.json<ApiResponse<CreateAgentResponseResponse>>(
        ok({ response }),
        201,
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

  // GET /api/v0/agent/drafts/:id/responses
  app.get('/api/v0/agent/drafts/:id/responses', async (c) => {
    const draftId = c.req.param('id')
    try {
      const responses = await agentResponseService.listResponses(draftId)
      return c.json<ApiResponse<ListAgentResponsesResponse>>(
        ok({ responses }),
      )
    } catch (caught) {
      if (caught instanceof AgentResponseNotFoundError) {
        return c.json(error('NOT_FOUND', caught.message), 404)
      }
      throw caught
    }
  })

  // GET /api/v0/agent/responses/:responseId
  app.get('/api/v0/agent/responses/:responseId', async (c) => {
    const responseId = c.req.param('responseId')
    const response = await agentResponseService.getResponse(responseId)
    if (!response) {
      return c.json(
        error('NOT_FOUND', `Agent response ${responseId} not found`),
        404,
      )
    }
    return c.json<ApiResponse<GetAgentResponseResponse>>(
      ok({ response }),
    )
  })
}

async function parseCreateResponseInput(
  request: Request,
  draftId: string,
): Promise<{
  draftId: string
  source: 'manual-paste'
  responseMarkdown: string
  externalAgentName?: string
  responseNote?: string
}> {
  if (!request.headers.get('content-type')?.includes('application/json')) {
    throw new AgentResponseValidationError(
      'Content-Type must be application/json',
    )
  }

  const raw = (await request.json()) as unknown
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new AgentResponseValidationError(
      'Request body must be a JSON object',
    )
  }

  const body = raw as Record<string, unknown>

  const source = body.source as string | undefined
  if (typeof source !== 'string' || source !== 'manual-paste') {
    throw new AgentResponseValidationError('source must be "manual-paste"')
  }

  const externalAgentName =
    typeof body.externalAgentName === 'string' &&
    body.externalAgentName.trim()
      ? body.externalAgentName.trim()
      : undefined
  if (
    body.externalAgentName !== undefined &&
    typeof body.externalAgentName !== 'string'
  ) {
    throw new AgentResponseValidationError(
      'externalAgentName must be a string',
    )
  }

  const responseNote =
    typeof body.responseNote === 'string' && body.responseNote.trim()
      ? body.responseNote.trim()
      : undefined
  if (
    body.responseNote !== undefined &&
    typeof body.responseNote !== 'string'
  ) {
    throw new AgentResponseValidationError(
      'responseNote must be a string',
    )
  }

  if (typeof body.responseMarkdown !== 'string') {
    throw new AgentResponseValidationError(
      'responseMarkdown is required and must be a string',
    )
  }

  const responseMarkdown = body.responseMarkdown as string
  if (responseMarkdown.trim().length === 0) {
    throw new AgentResponseValidationError(
      'responseMarkdown must not be empty',
    )
  }

  return {
    draftId,
    source: 'manual-paste',
    responseMarkdown,
    ...(externalAgentName ? { externalAgentName } : {}),
    ...(responseNote ? { responseNote } : {}),
  }
}
