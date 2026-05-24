export interface ApiError {
  code: string
  message: string
  details?: unknown
}

export type ApiResponse<T> =
  | {
      ok: true
      data: T
    }
  | {
      ok: false
      error: ApiError
    }
