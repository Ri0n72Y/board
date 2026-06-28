import axios from 'axios'
import type {
  ApiResponse,
  CreateAgentResponseInput,
  CreateAgentResponseResponse,
  GetAgentResponseResponse,
  ListAgentResponsesResponse,
} from '@labour-board/shared'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api/v0'

export async function createAgentResponse(
  draftId: string,
  input: Pick<
    CreateAgentResponseInput,
    'source' | 'responseMarkdown' | 'externalAgentName' | 'responseNote'
  >,
  signal?: AbortSignal
): Promise<CreateAgentResponseResponse> {
  const response = await axios.post<ApiResponse<CreateAgentResponseResponse>>(
    `${apiBaseUrl}/agent/drafts/${encodeURIComponent(draftId)}/responses`,
    input,
    { signal }
  )

  if (!response.data.ok) {
    throw new Error(response.data.error.message)
  }

  return response.data.data
}

export async function fetchAgentResponses(
  draftId: string,
  signal?: AbortSignal
): Promise<ListAgentResponsesResponse> {
  const response = await axios.get<ApiResponse<ListAgentResponsesResponse>>(
    `${apiBaseUrl}/agent/drafts/${encodeURIComponent(draftId)}/responses`,
    { signal }
  )

  if (!response.data.ok) {
    throw new Error(response.data.error.message)
  }

  return response.data.data
}

export async function fetchAgentResponse(
  responseId: string,
  signal?: AbortSignal
): Promise<GetAgentResponseResponse> {
  const response = await axios.get<ApiResponse<GetAgentResponseResponse>>(
    `${apiBaseUrl}/agent/responses/${encodeURIComponent(responseId)}`,
    { signal }
  )

  if (!response.data.ok) {
    throw new Error(response.data.error.message)
  }

  return response.data.data
}
