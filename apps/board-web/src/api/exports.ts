import axios from 'axios'
import type {
  ApiResponse,
  AgentContextProfile,
  BoardCurrentQuery,
  BoardExportLevel,
  BoardExportResult,
} from '@labour-board/shared'
import { appendBoardFilterUrlParams } from '../utils/boardFilterUrl'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api/v0'

export interface ExportRequestOptions {
  level?: BoardExportLevel
  profile?: AgentContextProfile
  language?: string
  contextGoal?: string
  recordId?: string
  sprintTag?: string
  filters?: BoardCurrentQuery
  includeDiagnostics?: boolean
  includeRelations?: boolean
  includeAssets?: boolean
  includeContent?: boolean
}

export async function exportCurrentBoard(
  options: ExportRequestOptions = {},
  signal?: AbortSignal
): Promise<BoardExportResult> {
  const response = await axios.get<ApiResponse<BoardExportResult>>(
    `${apiBaseUrl}/board/current/export`,
    { params: toParams(options), signal }
  )

  if (!response.data.ok) {
    throw new Error(response.data.error.message)
  }

  return response.data.data
}

export async function exportSnapshot(
  snapshotId: string,
  options: ExportRequestOptions = {},
  signal?: AbortSignal
): Promise<BoardExportResult> {
  const response = await axios.get<ApiResponse<BoardExportResult>>(
    `${apiBaseUrl}/snapshots/${encodeURIComponent(snapshotId)}/export`,
    { params: toParams(options), signal }
  )

  if (!response.data.ok) {
    throw new Error(response.data.error.message)
  }

  return response.data.data
}

function toParams(options: ExportRequestOptions): URLSearchParams {
  const params = new URLSearchParams()
  params.set('format', 'markdown')
  if (options.level) params.set('level', options.level)
  if (options.profile) params.set('profile', options.profile)
  if (options.language) params.set('language', options.language)
  if (options.contextGoal) params.set('contextGoal', options.contextGoal)
  if (options.recordId) params.set('recordId', options.recordId)
  if (options.sprintTag) params.set('sprintTag', options.sprintTag)
  addBoolean(params, 'includeDiagnostics', options.includeDiagnostics)
  addBoolean(params, 'includeRelations', options.includeRelations)
  addBoolean(params, 'includeAssets', options.includeAssets)
  addBoolean(params, 'includeContent', options.includeContent)

  appendBoardFilterUrlParams(params, options.filters)

  return params
}

function addBoolean(
  params: URLSearchParams,
  key: string,
  value: boolean | undefined
) {
  if (value !== undefined) params.set(key, value ? 'true' : 'false')
}
