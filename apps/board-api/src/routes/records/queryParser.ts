import type { RecordQuery, Tag } from '@labour-board/shared'

export function parseQuery(searchParams: URLSearchParams): RecordQuery {
  return {
    tags: parseTags(searchParams),
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

function parseTags(searchParams: URLSearchParams): Tag[] | undefined {
  const seen = new Set<string>()
  const tags: Tag[] = []

  for (const value of [
    ...searchParams.getAll('tag'),
    ...searchParams.getAll('tags'),
  ]) {
    const tag = value.trim()
    if (!tag || seen.has(tag)) continue
    seen.add(tag)
    tags.push(tag as Tag)
  }

  return tags.length ? tags : undefined
}

function parseLimit(value: string | null): number | undefined {
  if (!value) {
    return undefined
  }

  const limit = Number(value)
  return Number.isInteger(limit) && limit > 0 ? limit : undefined
}
