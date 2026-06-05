import type { Tag } from '@labour-board/shared'
import type { BoardStatusColumn } from './boardView'

export interface MoveStatusOption {
  tag: Tag
  label: string
}

export function getMoveStatusOptions(
  columns: Pick<BoardStatusColumn, 'label' | 'tag'>[],
): MoveStatusOption[] {
  const options = new Map<Tag, MoveStatusOption>()

  for (const column of columns) {
    if (!column.tag || !column.tag.startsWith('status:')) continue
    if (options.has(column.tag)) continue
    options.set(column.tag, { tag: column.tag, label: column.label })
  }

  return [...options.values()]
}

export function buildMovedStatusTags(
  currentTags: Tag[],
  targetStatusTag: Tag,
): Tag[] {
  const nextTags = currentTags.filter((tag) => !tag.startsWith('status:'))
  nextTags.unshift(targetStatusTag)
  return dedupeTags(nextTags)
}

export function isStatusMoveNoop(
  currentTags: Tag[],
  targetStatusTag: Tag,
): boolean {
  return currentTags.find((tag) => tag.startsWith('status:')) === targetStatusTag
}

function dedupeTags(tags: Tag[]): Tag[] {
  const seen = new Set<Tag>()
  const deduped: Tag[] = []

  for (const tag of tags) {
    if (seen.has(tag)) continue
    seen.add(tag)
    deduped.push(tag)
  }

  return deduped
}
