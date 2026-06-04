import type { BoardCurrentQuery, Tag } from '@labour-board/shared'

export function parseBoardCurrentQuery(
  searchParams: URLSearchParams
): BoardCurrentQuery {
  const tag = searchParams.get('tag')
  const tags = searchParams.getAll('tags') as Tag[]
  const tagMatch = searchParams.get('tagMatch')

  return {
    tags: tag ? [tag as Tag] : tags.length ? tags : undefined,
    tagMatch: tagMatch === 'any' ? 'any' : 'all',
    assignee: searchParams.get('assignee') ?? undefined,
    assetId: searchParams.get('assetId') ?? undefined,
    relationTarget: searchParams.get('relationTarget') ?? undefined,
    q: searchParams.get('q') ?? undefined,
    includeArchived: searchParams.get('includeArchived') === 'true',
  }
}
