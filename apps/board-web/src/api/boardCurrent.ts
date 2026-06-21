import axios from 'axios'
import type {
  ApiResponse,
  BoardCurrentProjection,
  BoardCurrentTagMatch,
  Tag,
} from '@labour-board/shared'
import { serializeBoardFilterUrl } from '../utils/boardFilterUrl'

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

export function buildBoardCurrentSearchParams(
  filters: BoardCurrentFilters,
): URLSearchParams {
  return serializeBoardFilterUrl(filters)
}

export async function fetchBoardCurrent(
  filters: BoardCurrentFilters,
  signal?: AbortSignal,
): Promise<BoardCurrentProjection> {
  const params = buildBoardCurrentSearchParams(filters)
  const url = `${apiBaseUrl}/board/current${params.size ? `?${params}` : ''}`
  const response = await axios.get<ApiResponse<BoardCurrentProjection>>(url, {
    signal,
  })

  if (!response.data.ok) {
    throw new Error(response.data.error.message)
  }

  return response.data.data
}
