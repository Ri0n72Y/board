import axios from 'axios'
import type {
  ApiResponse,
  CreateSnapshotInput,
  CreateSnapshotResponse,
  GetSnapshotResponse,
  ListSnapshotsResponse,
} from '@labour-board/shared'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api/v0'

export async function createSnapshot(
  payload: CreateSnapshotInput,
  signal?: AbortSignal,
): Promise<CreateSnapshotResponse> {
  const response = await axios.post<ApiResponse<CreateSnapshotResponse>>(
    `${apiBaseUrl}/snapshots`,
    payload,
    { signal },
  )

  if (!response.data.ok) {
    throw new Error(response.data.error.message)
  }

  return response.data.data
}

export async function fetchSnapshots(
  signal?: AbortSignal,
): Promise<ListSnapshotsResponse> {
  const response = await axios.get<ApiResponse<ListSnapshotsResponse>>(
    `${apiBaseUrl}/snapshots`,
    { signal },
  )

  if (!response.data.ok) {
    throw new Error(response.data.error.message)
  }

  return response.data.data
}

export async function fetchSnapshot(
  snapshotId: string,
  signal?: AbortSignal,
): Promise<GetSnapshotResponse> {
  const response = await axios.get<ApiResponse<GetSnapshotResponse>>(
    `${apiBaseUrl}/snapshots/${encodeURIComponent(snapshotId)}`,
    { signal },
  )

  if (!response.data.ok) {
    throw new Error(response.data.error.message)
  }

  return response.data.data
}
