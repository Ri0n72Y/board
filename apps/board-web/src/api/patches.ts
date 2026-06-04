import axios from 'axios'
import type {
  ApiResponse,
  AssetRef,
  PatchItem,
  PublicKey,
  RecordId,
  RecordResponse,
  RelationRef,
  Tag,
} from '@labour-board/shared'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api/v0'

export class RecordPatchConflictError extends Error {
  readonly status = 409

  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'RecordPatchConflictError'
  }
}

export type NullableRecordBodyPatch = Record<string, unknown>

export interface SubmitRecordPatchPayload {
  parentId: RecordId | null
  snapshotVersion: number
  tags?: Tag[]
  assignee?: PublicKey | null
  body?: NullableRecordBodyPatch
  assets?: AssetRef[]
  relations?: RelationRef[]
  description?: string
}

export interface SubmitRecordPatchResponse {
  patch: RecordResponse<PatchItem<NullableRecordBodyPatch>>
  newSnapshotVersion: number
}

export async function submitRecordPatch(
  recordId: string,
  payload: SubmitRecordPatchPayload,
  signal?: AbortSignal,
): Promise<SubmitRecordPatchResponse> {
  try {
    const response = await axios.post<ApiResponse<SubmitRecordPatchResponse>>(
      `${apiBaseUrl}/records/${encodeURIComponent(recordId)}/patches`,
      payload,
      { signal },
    )

    if (!response.data.ok) {
      throw new Error(response.data.error.message)
    }

    return response.data.data
  } catch (caught) {
    if (axios.isAxiosError<ApiResponse<SubmitRecordPatchResponse>>(caught)) {
      const data = caught.response?.data
      if (data && !data.ok) {
        const message = data.error.message
        if (caught.response?.status === 409 || data.error.code === 'CONFLICT') {
          throw new RecordPatchConflictError(message, { cause: caught })
        }
        throw new Error(message, { cause: caught })
      }
    }

    throw caught
  }
}
