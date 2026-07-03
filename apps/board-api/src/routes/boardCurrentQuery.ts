import type { BoardCurrentQuery, Tag } from '@labour-board/shared'

export function parseBoardCurrentQuery(
  searchParams: URLSearchParams
): BoardCurrentQuery {
  return {
    tags: parseTags(searchParams),
    tagMatch: 'any',
    assignee: searchParams.get('assignee') ?? undefined,
    assetId: searchParams.get('assetId') ?? undefined,
    relationTarget: searchParams.get('relationTarget') ?? undefined,
    q: searchParams.get('q') ?? undefined,
    includeArchived: searchParams.get('includeArchived') === 'true',
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
