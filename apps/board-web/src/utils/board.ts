import type { BoardCurrentProjection, Tag } from '@labour-board/shared'
import type { BoardCurrentFilters } from '../api/boardCurrent'

export function hasEffectiveFilters(filters: BoardCurrentFilters): boolean {
  return (
    filters.q.trim().length > 0 ||
    filters.tags.length > 0 ||
    filters.assignee.trim().length > 0 ||
    filters.assetId.trim().length > 0 ||
    filters.relationTarget.trim().length > 0
  )
}

export function extractKnownTags(
  projection: BoardCurrentProjection | null,
): Tag[] {
  const values = new Set<Tag>()
  for (const record of projection?.records ?? []) {
    for (const tag of record.body.tags) {
      values.add(tag)
    }
  }
  return [...values].sort()
}
