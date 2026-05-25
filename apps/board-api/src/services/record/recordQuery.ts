import type {
  BoardConfig,
  RecordBody,
  RecordQuery,
} from '@labour-board/shared'
import type { BoardRecord } from '../../repositories/recordRepository.js'
import { isRecord } from '../../utils/object.js'

export function filterRecords(
  records: BoardRecord[],
  query: RecordQuery,
  config: BoardConfig
): BoardRecord[] {
  const filtered = records.filter((record) =>
    matchesRecordQuery(record, query, config)
  )

  return typeof query.limit === 'number' ? filtered.slice(0, query.limit) : filtered
}

function matchesRecordQuery(
  record: BoardRecord,
  query: RecordQuery,
  config: BoardConfig
): boolean {
  if (!query.includeArchived && !shouldIncludeInCurrentBoard(record, config)) {
    return false
  }

  if (query.id && record.id !== query.id) return false
  if (query.schema && record.schema !== query.schema) return false
  if (query.pid && record.pid !== query.pid) return false
  if (query.assignee && record.assignee !== query.assignee) return false
  if (query.assetId && !record.assets?.includes(query.assetId)) return false

  if (
    query.relationTarget &&
    !record.relations?.some((relation) => relation.target === query.relationTarget)
  ) {
    return false
  }

  if (query.tags?.length && !matchesTags(record, query)) {
    return false
  }

  return !(query.q && !matchesTextQuery(record, query.q))
}

function shouldIncludeInCurrentBoard(
  record: BoardRecord,
  config: BoardConfig
): boolean {
  return !config.snapshot.excludeTags.some((tag) => record.tags.includes(tag))
}

function matchesTags(record: BoardRecord, query: RecordQuery): boolean {
  return query.tagMatch === 'any'
    ? query.tags?.some((tag) => record.tags.includes(tag)) === true
    : query.tags?.every((tag) => record.tags.includes(tag)) === true
}

function matchesTextQuery(record: BoardRecord, query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) {
    return true
  }

  const searchableValues = [
    record.id,
    record.pid,
    record.schema,
    record.assignee,
    ...record.tags,
    ...extractBodyText(record.body),
  ]

  return searchableValues.some((value) =>
    value?.toLowerCase().includes(normalizedQuery)
  )
}

function extractBodyText(body: RecordBody): string[] {
  if (!isRecord(body)) {
    return []
  }

  return ['title', 'description', 'content']
    .map((key) => body[key])
    .filter((value): value is string => typeof value === 'string')
}
