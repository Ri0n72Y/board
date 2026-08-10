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

/**
 * Translate an axios/network failure into a user-facing error message.
 *
 * Returns an Error whose `.message` is either:
 * - an i18n key (`status.networkError` / `status.backendUnavailable`) that the
 *   UI layer resolves via `t(message, { defaultValue: message })`, or
 * - the backend-provided error message when the API responded with `ok: false`.
 */
export function toApiErrorMessage(caught: unknown): Error {
  if (axios.isAxiosError(caught)) {
    if (!caught.response) {
      // No HTTP response: DNS failure, ECONNREFUSED, proxy error, timeout.
      return new Error('status.networkError', { cause: caught })
    }

    const { status } = caught.response
    if (status === 502 || status === 503 || status === 504) {
      // Upstream (board-api / database) unavailable through the dev proxy.
      return new Error('status.backendUnavailable', { cause: caught })
    }

    const data = caught.response.data as
      | { error?: { message?: string } }
      | undefined
    if (data?.error?.message) {
      return new Error(data.error.message, { cause: caught })
    }

    return new Error(caught.message, { cause: caught })
  }

  return caught instanceof Error ? caught : new Error(String(caught))
}
