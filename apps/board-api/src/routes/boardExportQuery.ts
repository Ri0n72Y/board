import type {
  BoardCurrentProjection,
  BoardCurrentQuery,
  AgentContextProfile,
  BoardContextPackOptions,
  BoardExportLevel,
  BoardExportOptions,
  BoardExportSource,
  Tag,
} from '@labour-board/shared'
import {
  getAgentContextProfileDefinition,
  getBoardExportLevelForProfile,
  validateAgentContextProfileOptions,
} from '@labour-board/shared'
import { filterBoardCurrentRecords } from '../services/boardCurrent/boardCurrentFilter.js'
import { parseBoardCurrentQuery } from './boardCurrentQuery.js'

const LEVELS: readonly BoardExportLevel[] = [
  'full',
  'summary',
  'meta',
  'card',
  'related',
  'sprint',
  'filtered',
]

export class BoardExportQueryError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BoardExportQueryError'
  }
}

export function parseBoardExportOptions(
  searchParams: URLSearchParams,
  source: BoardExportSource,
  snapshot?: { id: string; createdAt: string; reason?: string }
): BoardExportOptions | BoardContextPackOptions {
  const format = searchParams.get('format') ?? 'markdown'
  if (format !== 'markdown') {
    throw new BoardExportQueryError(`Unsupported export format: ${format}`)
  }

  const rawProfile = searchParams.get('profile')
  const profile = parseProfile(rawProfile)
  if (profile && searchParams.has('level')) {
    throw new BoardExportQueryError('level cannot be combined with profile')
  }
  const rawLevel = profile
    ? getBoardExportLevelForProfile(profile)
    : searchParams.get('level') ?? 'full'
  if (!LEVELS.includes(rawLevel as BoardExportLevel)) {
    throw new BoardExportQueryError(`Unsupported export level: ${rawLevel}`)
  }

  const level = rawLevel as BoardExportLevel
  const filters = parseBoardCurrentQuery(searchParams)
  const recordId = searchParams.get('recordId') ?? undefined
  const sprintTag = searchParams.get('sprintTag') ?? inferSprintTag(filters)
  const contextGoal = parseContextGoal(searchParams)

  if (profile) {
    const validationError = validateAgentContextProfileOptions({
      source,
      profile,
      recordId,
      sprintTag,
      filters,
    })
    if (validationError) {
      throw new BoardExportQueryError(validationError)
    }
  } else {
    if (level === 'card' && !recordId) {
      throw new BoardExportQueryError('recordId is required for card export')
    }
    if (level === 'sprint' && !sprintTag) {
      throw new BoardExportQueryError('sprintTag is required for sprint export')
    }
  }

  const profileDefinition = profile
    ? getAgentContextProfileDefinition(profile)
    : undefined

  const base = {
    source,
    level,
    format: 'markdown' as const,
    language: parseLanguage(searchParams),
    ...(profile ? { profile } : {}),
    ...(contextGoal ? { contextGoal } : {}),
    ...(recordId ? { recordId } : {}),
    ...(sprintTag ? { sprintTag } : {}),
    includeDiagnostics: parseBoolean(
      searchParams,
      'includeDiagnostics',
      profileDefinition?.defaultIncludeDiagnostics ?? true
    ),
    includeRelations: parseBoolean(
      searchParams,
      'includeRelations',
      profileDefinition?.defaultIncludeRelations ?? true
    ),
    includeAssets: parseBoolean(
      searchParams,
      'includeAssets',
      profileDefinition?.defaultIncludeAssets ?? true
    ),
    includeContent: parseBoolean(
      searchParams,
      'includeContent',
      profileDefinition?.defaultIncludeContent ?? (level === 'full' || level === 'card')
    ),
    filters,
    ...(snapshot
      ? {
          snapshotId: snapshot.id,
          snapshotCreatedAt: snapshot.createdAt,
          ...(snapshot.reason ? { snapshotReason: snapshot.reason } : {}),
        }
      : {}),
  }

  return base as BoardExportOptions | BoardContextPackOptions
}

export function applyExportFilters(
  projection: BoardCurrentProjection,
  filters: BoardCurrentQuery
): BoardCurrentProjection {
  const records = filterBoardCurrentRecords(projection.records, filters)
  return {
    ...projection,
    records,
    summary: {
      ...projection.summary,
      visibleCurrentRecords: records.length,
    },
  }
}

function parseBoolean(
  searchParams: URLSearchParams,
  key: string,
  fallback: boolean
): boolean {
  const value = searchParams.get(key)
  if (value === null) return fallback
  return value === 'true'
}

function inferSprintTag(filters: BoardCurrentQuery): Tag | undefined {
  const sprintTags = (filters.tags ?? []).filter((tag) =>
    tag.startsWith('sprint:')
  )
  return sprintTags.length === 1 ? sprintTags[0] : undefined
}

function parseProfile(value: string | null): AgentContextProfile | undefined {
  if (value === null || value === '') return undefined
  try {
    return getAgentContextProfileDefinition(value as AgentContextProfile).id
  } catch {
    throw new BoardExportQueryError(`Unsupported context profile: ${value}`)
  }
}

function parseContextGoal(searchParams: URLSearchParams): string | undefined {
  const value = searchParams.get('contextGoal')?.trim()
  return value || undefined
}

function parseLanguage(searchParams: URLSearchParams): string | undefined {
  const value = searchParams.get('language')
  if (value === 'zh-CN' || value === 'en-US') return value
  return undefined // let downstream fallback to en-US
}
