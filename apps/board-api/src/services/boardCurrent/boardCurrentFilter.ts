import type { BoardCurrentQuery } from '@labour-board/shared'
import type { BoardRecordResponse } from '../record/recordResponses.js'
import { isRecord } from '../../utils/object.js'

export function filterBoardCurrentRecords(
  records: BoardRecordResponse[],
  query: BoardCurrentQuery
): BoardRecordResponse[] {
  return records.filter((record) => matchesBoardCurrentQuery(record, query))
}

function matchesBoardCurrentQuery(
  envelope: BoardRecordResponse,
  query: BoardCurrentQuery
): boolean {
  const record = envelope.body

  if (query.assignee && record.assignee !== query.assignee) return false
  if (query.assetId && !record.assets?.includes(query.assetId)) return false

  if (
    query.relationTarget &&
    !record.relations?.some(
      (relation) => relation.target === query.relationTarget
    )
  ) {
    return false
  }

  if (query.tags?.length && !matchesTags(envelope, query)) {
    return false
  }

  return !(query.q && !matchesCurrentBodyText(envelope, query.q))
}

function matchesTags(
  envelope: BoardRecordResponse,
  query: BoardCurrentQuery
): boolean {
  const tags = envelope.body.tags
  return query.tagMatch === 'any'
    ? query.tags?.some((tag) => tags.includes(tag)) === true
    : query.tags?.every((tag) => tags.includes(tag)) === true
}

function matchesCurrentBodyText(
  envelope: BoardRecordResponse,
  query: string
): boolean {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) {
    return true
  }

  return extractCurrentBodyText(envelope).some((value) =>
    value.toLowerCase().includes(normalizedQuery)
  )
}

function extractCurrentBodyText(envelope: BoardRecordResponse): string[] {
  const body = envelope.body.body
  if (!isRecord(body)) {
    return []
  }

  return ['title', 'description', 'content']
    .map((key) => body[key])
    .filter((value): value is string => typeof value === 'string')
}
