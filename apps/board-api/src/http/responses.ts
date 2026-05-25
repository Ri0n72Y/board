import type { ApiResponse } from '@labour-board/shared'

export function ok<T>(data: T): ApiResponse<T> {
  return { ok: true, data }
}

export function error(
  code: string,
  message: string,
  details?: unknown
): ApiResponse<never> {
  return {
    ok: false,
    error: {
      code,
      message,
      details,
    },
  }
}
