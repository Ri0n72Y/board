import axios from 'axios'
import type {
  ApiResponse,
  CreateAgentSuggestionInput,
  CreateAgentSuggestionResponse,
  GetAgentSuggestionResponse,
  ListAgentSuggestionsResponse,
  UpdateAgentSuggestionReviewInput,
  UpdateAgentSuggestionReviewResponse,
} from '@labour-board/shared'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api/v0'

export async function createAgentSuggestion(
  draftId: string,
  input: CreateAgentSuggestionInput,
  signal?: AbortSignal
): Promise<CreateAgentSuggestionResponse> {
  const response = await axios.post<ApiResponse<CreateAgentSuggestionResponse>>(
    `${apiBaseUrl}/agent/drafts/${encodeURIComponent(draftId)}/suggestions`,
    input,
    { signal }
  )

  if (!response.data.ok) {
    throw new Error(response.data.error.message)
  }

  return response.data.data
}

export async function fetchAgentSuggestions(
  draftId: string,
  signal?: AbortSignal
): Promise<ListAgentSuggestionsResponse> {
  const response = await axios.get<ApiResponse<ListAgentSuggestionsResponse>>(
    `${apiBaseUrl}/agent/drafts/${encodeURIComponent(draftId)}/suggestions`,
    { signal }
  )

  if (!response.data.ok) {
    throw new Error(response.data.error.message)
  }

  return response.data.data
}

export async function fetchAgentSuggestionDetail(
  suggestionId: string,
  signal?: AbortSignal
): Promise<GetAgentSuggestionResponse> {
  const response = await axios.get<ApiResponse<GetAgentSuggestionResponse>>(
    `${apiBaseUrl}/agent/suggestions/${encodeURIComponent(suggestionId)}`,
    { signal }
  )

  if (!response.data.ok) {
    throw new Error(response.data.error.message)
  }

  return response.data.data
}

export async function updateAgentSuggestionReview(
  suggestionId: string,
  input: UpdateAgentSuggestionReviewInput,
  signal?: AbortSignal
): Promise<UpdateAgentSuggestionReviewResponse> {
  const response = await axios.patch<
    ApiResponse<UpdateAgentSuggestionReviewResponse>
  >(
    `${apiBaseUrl}/agent/suggestions/${encodeURIComponent(suggestionId)}/review`,
    input,
    { signal }
  )

  if (!response.data.ok) {
    throw new Error(response.data.error.message)
  }

  return response.data.data
}
