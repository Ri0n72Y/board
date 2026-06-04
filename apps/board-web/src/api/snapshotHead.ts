import axios from 'axios'
import type { ApiResponse, RecordId } from '@labour-board/shared'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api/v0'

export interface SnapshotHeadResponse {
  version: number
  records: Record<RecordId, { lastPatchId: RecordId | null }>
}

export async function fetchSnapshotHead(
  signal?: AbortSignal,
): Promise<SnapshotHeadResponse> {
  const response = await axios.get<ApiResponse<SnapshotHeadResponse>>(
    `${apiBaseUrl}/snapshot-head`,
    { signal },
  )

  if (!response.data.ok) {
    throw new Error(response.data.error.message)
  }

  return response.data.data
}
