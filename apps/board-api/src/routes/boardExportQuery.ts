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
import { getBoardExportLevelForProfile } from '@labour-board/shared'
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

const PROFILES: readonly AgentContextProfile[] = [
  'agent-full',
  'agent-sprint',
  'agent-filtered',
  'agent-card',
  'agent-related',
  'agent-snapshot',
  'human-summary',
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
  if (profile === 'agent-snapshot' && source !== 'snapshot') {
    throw new BoardExportQueryError('agent-snapshot profile requires snapshot export source')
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

  if ((level === 'card' || profile === 'agent-card') && !recordId) {
    throw new BoardExportQueryError('recordId is required for card export')
  }
  if ((level === 'sprint' || profile === 'agent-sprint') && !sprintTag) {
    throw new BoardExportQueryError('sprintTag is required for sprint export')
  }

  return {
    source,
    level,
    format: 'markdown',
    ...(profile ? { profile } : {}),
    ...(contextGoal ? { contextGoal } : {}),
    ...(recordId ? { recordId } : {}),
    ...(sprintTag ? { sprintTag } : {}),
    includeDiagnostics: parseBoolean(searchParams, 'includeDiagnostics', true),
    includeRelations: parseBoolean(searchParams, 'includeRelations', true),
    includeAssets: parseBoolean(searchParams, 'includeAssets', true),
    includeContent: parseBoolean(
      searchParams,
      'includeContent',
      level === 'full' || level === 'card'
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
  if (!PROFILES.includes(value as AgentContextProfile)) {
    throw new BoardExportQueryError(`Unsupported context profile: ${value}`)
  }
  return value as AgentContextProfile
}

function parseContextGoal(searchParams: URLSearchParams): string | undefined {
  const value = searchParams.get('contextGoal')?.trim()
  return value || undefined
}
