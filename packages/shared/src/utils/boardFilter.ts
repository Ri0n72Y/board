import type {
  BoardCurrentQuery,
  RecordBody,
  RecordItem,
  RecordResponse,
  Tag,
} from '../interfaces/index.js'

export type BoardFilterQuery = BoardCurrentQuery

export interface NormalizedBoardFilterQuery {
  tags: Tag[]
  tagMatch: 'all' | 'any'
  assignee?: string
  assetId?: string
  relationTarget?: string
  q?: string
  includeArchived: boolean
}

type BoardRecord = RecordResponse<RecordItem<RecordBody>>

export function normalizeBoardFilterQuery(
  query: BoardFilterQuery = {}
): NormalizedBoardFilterQuery {
  return {
    tags: query.tags?.filter((tag) => tag.trim().length > 0) ?? [],
    tagMatch: query.tagMatch === 'any' ? 'any' : 'all',
    assignee: normalizeString(query.assignee),
    assetId: normalizeString(query.assetId),
    relationTarget: normalizeString(query.relationTarget),
    q: normalizeString(query.q),
    includeArchived: query.includeArchived === true,
  }
}

export function recordMatchesBoardFilter(
  record: BoardRecord,
  query: BoardFilterQuery = {}
): boolean {
  const normalized = normalizeBoardFilterQuery(query)
  const body = record.body

  if (!normalized.includeArchived && body.tags.includes('status:archived')) {
    return false
  }
  if (normalized.assignee && body.assignee !== normalized.assignee) return false
  if (normalized.assetId && !body.assets?.includes(normalized.assetId))
    return false
  if (
    normalized.relationTarget &&
    !body.relations?.some(
      (relation) => relation.target === normalized.relationTarget
    )
  ) {
    return false
  }
  if (normalized.tags.length > 0 && !matchesTags(record, normalized)) {
    return false
  }
  if (normalized.q && !matchesBoardFilterText(record, normalized.q)) {
    return false
  }

  return true
}

export function filterBoardRecords(
  records: readonly BoardRecord[],
  query: BoardFilterQuery = {}
): BoardRecord[] {
  return records.filter((record) => recordMatchesBoardFilter(record, query))
}

function matchesTags(
  record: BoardRecord,
  query: NormalizedBoardFilterQuery
): boolean {
  return query.tagMatch === 'any'
    ? query.tags.some((tag) => record.body.tags.includes(tag))
    : query.tags.every((tag) => record.body.tags.includes(tag))
}

function matchesBoardFilterText(record: BoardRecord, query: string): boolean {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return true
  return extractBoardFilterText(record).some((value) =>
    value.toLowerCase().includes(normalized)
  )
}

function extractBoardFilterText(record: BoardRecord): string[] {
  const body = record.body
  const values = [
    body.pid,
    body.id,
    ...body.tags,
    body.assignee,
    ...(body.assets ?? []),
    ...(body.relations ?? []).flatMap((relation) => [
      relation.constraint,
      relation.target,
    ]),
  ]

  if (isRecordObject(body.body)) {
    values.push(stringField(body.body, 'title'))
    values.push(stringField(body.body, 'description'))
    values.push(stringField(body.body, 'content'))
  }

  return values.filter((value): value is string => typeof value === 'string')
}

function normalizeString(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

function isRecordObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stringField(
  body: Record<string, unknown>,
  key: string
): string | undefined {
  const value = body[key]
  return typeof value === 'string' ? value : undefined
}
