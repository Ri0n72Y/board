import axios from 'axios'
import type { ApiResponse, BoardCurrentProjection } from '@labour-board/shared'
import {
  serializeBoardFilterUrl,
  type BoardCurrentFilters,
} from '../utils/boardFilterUrl'
export type { BoardCurrentFilters } from '../utils/boardFilterUrl'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api/v0'

export function buildBoardCurrentSearchParams(
  filters: BoardCurrentFilters
): URLSearchParams {
  return serializeBoardFilterUrl(filters)
}

export async function fetchBoardCurrent(
  filters: BoardCurrentFilters,
  signal?: AbortSignal
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
