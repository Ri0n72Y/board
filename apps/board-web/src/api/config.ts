import axios from 'axios'
import type { ApiResponse, BoardConfig } from '@labour-board/shared'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api/v0'

export async function fetchConfig(signal?: AbortSignal): Promise<BoardConfig> {
  const url = `${apiBaseUrl}/config`
  const response = await axios.get<ApiResponse<BoardConfig>>(url, { signal })

  if (!response.data.ok) {
    throw new Error(response.data.error.message)
  }

  return response.data.data
}
