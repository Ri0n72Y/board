import axios from 'axios'
import type {
  ApiResponse,
  GetAgentSkillResponse,
  ListAgentSkillsResponse,
} from '@labour-board/shared'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api/v0'

export async function fetchAgentSkills(
  signal?: AbortSignal,
): Promise<ListAgentSkillsResponse> {
  const response = await axios.get<ApiResponse<ListAgentSkillsResponse>>(
    `${apiBaseUrl}/agent/skills`,
    { signal },
  )

  if (!response.data.ok) {
    throw new Error(response.data.error.message)
  }

  return response.data.data
}

export async function fetchAgentSkillDetail(
  skillId: string,
  signal?: AbortSignal,
): Promise<GetAgentSkillResponse> {
  const response = await axios.get<ApiResponse<GetAgentSkillResponse>>(
    `${apiBaseUrl}/agent/skills/${encodeURIComponent(skillId)}`,
    { signal },
  )

  if (!response.data.ok) {
    throw new Error(response.data.error.message)
  }

  return response.data.data
}
