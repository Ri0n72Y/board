import { Hono } from 'hono'
import type {
  ApiResponse,
  GetAgentSkillResponse,
  ListAgentSkillsResponse,
} from '@labour-board/shared'
import { ok, error } from '../http/responses.js'
import type { AgentSkillService } from '../services/agent/agentSkillService.js'
import { SkillNotFoundError } from '../services/agent/agentSkillService.js'

export function createAgentSkillsRoute(
  agentSkillService: AgentSkillService
): Hono {
  const route = new Hono()

  route.get('/skills', async (c) => {
    const skills = await agentSkillService.listSkills()
    return c.json<ApiResponse<ListAgentSkillsResponse>>(ok({ skills }))
  })

  route.get('/skills/:skillId', async (c) => {
    try {
      const skill = await agentSkillService.getSkill(c.req.param('skillId'))
      if (!skill) {
        return c.json(
          error('NOT_FOUND', `Agent skill ${c.req.param('skillId')} not found`),
          404
        )
      }
      return c.json<ApiResponse<GetAgentSkillResponse>>(ok({ skill }))
    } catch (caught) {
      if (caught instanceof SkillNotFoundError) {
        return c.json(error('NOT_FOUND', caught.message), 404)
      }
      throw caught
    }
  })

  return route
}
