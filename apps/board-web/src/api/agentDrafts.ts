import axios from 'axios'
import type {
  ApiResponse,
  AgentContextProfile,
  AgentDraftSource,
  BoardCurrentQuery,
  CreateAgentDraftResponse,
  GetAgentDraftResponse,
  ListAgentDraftsResponse,
} from '@labour-board/shared'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api/v0'

export interface CreateAgentDraftRequest {
  title: string
  profile: AgentContextProfile
  source: AgentDraftSource
  contextGoal?: string
  recordId?: string
  sprintTag?: string
  snapshotId?: string
  filters?: BoardCurrentQuery
  includeContent?: boolean
  includeAssets?: boolean
  includeRelations?: boolean
  includeDiagnostics?: boolean
}

export async function createAgentDraft(
  input: CreateAgentDraftRequest,
  signal?: AbortSignal,
): Promise<CreateAgentDraftResponse> {
  const response = await axios.post<ApiResponse<CreateAgentDraftResponse>>(
    `${apiBaseUrl}/agent/drafts`,
    input,
    { signal },
  )

  if (!response.data.ok) {
    throw new Error(response.data.error.message)
  }

  return response.data.data
}

export async function fetchAgentDrafts(
  signal?: AbortSignal,
): Promise<ListAgentDraftsResponse> {
  const response = await axios.get<ApiResponse<ListAgentDraftsResponse>>(
    `${apiBaseUrl}/agent/drafts`,
    { signal },
  )

  if (!response.data.ok) {
    throw new Error(response.data.error.message)
  }

  return response.data.data
}

export async function fetchAgentDraft(
  id: string,
  signal?: AbortSignal,
): Promise<GetAgentDraftResponse> {
  const response = await axios.get<ApiResponse<GetAgentDraftResponse>>(
    `${apiBaseUrl}/agent/drafts/${encodeURIComponent(id)}`,
    { signal },
  )

  if (!response.data.ok) {
    throw new Error(response.data.error.message)
  }

  return response.data.data
}
