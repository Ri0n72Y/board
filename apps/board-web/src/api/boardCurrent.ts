import axios from 'axios'
import type {
  ApiResponse,
  BoardCurrentProjection,
  BoardCurrentTagMatch,
  Tag,
} from '@labour-board/shared'

export interface BoardCurrentFilters {
  q: string
  tags: Tag[]
  tagMatch: BoardCurrentTagMatch
  includeArchived: boolean
  assignee: string
  assetId: string
  relationTarget: string
}

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api/v0'

export async function fetchBoardCurrent(
  filters: BoardCurrentFilters,
  signal?: AbortSignal
): Promise<BoardCurrentProjection> {
  const params = new URLSearchParams()
  const q = filters.q.trim()

  if (q) params.set('q', q)
  if (filters.includeArchived) params.set('includeArchived', 'true')

  const trimmedAssignee = filters.assignee.trim()
  if (trimmedAssignee) params.set('assignee', trimmedAssignee)

  const trimmedAssetId = filters.assetId.trim()
  if (trimmedAssetId) params.set('assetId', trimmedAssetId)

  const trimmedRelationTarget = filters.relationTarget.trim()
  if (trimmedRelationTarget) params.set('relationTarget', trimmedRelationTarget)

  if (filters.tags.length > 0) {
    for (const tag of filters.tags) {
      params.append('tags', tag)
    }
    params.set('tagMatch', filters.tagMatch)
  }

  const url = `${apiBaseUrl}/board/current${params.size ? `?${params}` : ''}`
  const response = await axios.get<ApiResponse<BoardCurrentProjection>>(url, {
    signal,
  })

  if (!response.data.ok) {
    throw new Error(response.data.error.message)
  }

  return response.data.data
}
