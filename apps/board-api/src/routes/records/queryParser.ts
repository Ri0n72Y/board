import type { RecordQuery, Tag } from '@labour-board/shared'

export function parseQuery(searchParams: URLSearchParams): RecordQuery {
  const tag = searchParams.get('tag')
  const tags = searchParams.getAll('tags') as Tag[]
  return {
    tags: tag ? [tag as Tag] : tags.length ? tags : undefined,
    tagMatch: 'any',
    id: searchParams.get('id') ?? undefined,
    pid: searchParams.get('pid') ?? undefined,
    schema: searchParams.get('schema') ?? undefined,
    assignee: searchParams.get('assignee') ?? undefined,
    assetId: searchParams.get('assetId') ?? undefined,
    relationTarget: searchParams.get('relationTarget') ?? undefined,
    q: searchParams.get('q') ?? undefined,
    limit: parseLimit(searchParams.get('limit')),
    includeArchived:
      searchParams.get('includeArchived') === 'true' ||
      searchParams.get('includeDeleted') === 'true',
  }
}

function parseLimit(value: string | null): number | undefined {
  if (!value) {
    return undefined
  }

  const limit = Number(value)
  return Number.isInteger(limit) && limit > 0 ? limit : undefined
}
