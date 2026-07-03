import axios from 'axios'
import type {
  ApiResponse,
  RecordCurrentHeadResponse,
} from '@labour-board/shared'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api/v0'

export async function fetchRecordHead(
  recordId: string,
  signal?: AbortSignal
): Promise<RecordCurrentHeadResponse> {
  const response = await axios.get<ApiResponse<RecordCurrentHeadResponse>>(
    `${apiBaseUrl}/records/${encodeURIComponent(recordId)}/head`,
    { signal }
  )

  if (!response.data.ok) {
    throw new Error(response.data.error.message)
  }

  return response.data.data
}
