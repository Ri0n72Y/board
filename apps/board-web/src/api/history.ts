import axios from 'axios'
import type { ApiResponse, RecordHistoryResponse } from '@labour-board/shared'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api/v0'

export async function fetchRecordHistory(
  recordId: string,
  signal?: AbortSignal,
): Promise<RecordHistoryResponse> {
  const url = `${apiBaseUrl}/records/${encodeURIComponent(recordId)}/history`
  const response = await axios.get<ApiResponse<RecordHistoryResponse>>(url, {
    signal,
  })

  if (!response.data.ok) {
    throw new Error(response.data.error.message)
  }

  return response.data.data
}
