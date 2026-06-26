import axios from 'axios'
import type { ApiResponse } from '@labour-board/shared'

export function extractApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError<ApiResponse<unknown>>(error)) {
    const data = error.response?.data
    if (isApiErrorResponse(data)) {
      return `${data.error.code}: ${data.error.message}`
    }
    if (error.response?.status) {
      return `HTTP ${error.response.status}: ${error.message}`
    }
    return error.message
  }

  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}

function isApiErrorResponse(value: unknown): value is {
  ok: false
  error: { code: string; message: string }
} {
  if (!value || typeof value !== 'object') return false
  const candidate = value as {
    ok?: unknown
    error?: { code?: unknown; message?: unknown }
  }
  return (
    candidate.ok === false &&
    typeof candidate.error?.code === 'string' &&
    typeof candidate.error.message === 'string'
  )
}
