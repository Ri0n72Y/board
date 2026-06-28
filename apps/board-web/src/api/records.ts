import axios from 'axios'
import type {
  ApiResponse,
  CreateRecordInput,
  RecordBody,
  RecordItem,
  RecordResponse,
} from '@labour-board/shared'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api/v0'

export type CreateRecordPayload = CreateRecordInput<RecordBody>
export type CreatedRecordResponse = RecordResponse<RecordItem<RecordBody>>

export async function createRecord(
  payload: CreateRecordPayload,
  signal?: AbortSignal
): Promise<CreatedRecordResponse> {
  try {
    const response = await axios.post<ApiResponse<CreatedRecordResponse>>(
      `${apiBaseUrl}/records`,
      payload,
      { signal }
    )

    if (!response.data.ok) {
      throw new Error(response.data.error.message)
    }

    return response.data.data
  } catch (caught) {
    if (axios.isAxiosError<ApiResponse<CreatedRecordResponse>>(caught)) {
      const data = caught.response?.data
      if (data && !data.ok) {
        throw new Error(data.error.message, { cause: caught })
      }
    }

    throw caught
  }
}
