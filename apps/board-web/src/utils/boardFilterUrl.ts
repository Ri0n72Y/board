import type {
  BoardCurrentQuery,
  BoardCurrentTagMatch,
  Tag,
} from '@labour-board/shared'

export interface BoardCurrentFilters {
  q: string
  tags: Tag[]
  tagMatch: BoardCurrentTagMatch
  includeArchived: boolean
  assignee: string
  assetId: string
  relationTarget: string
}

export const DEFAULT_BOARD_CURRENT_FILTERS: BoardCurrentFilters = {
  q: '',
  tags: [],
  tagMatch: 'all',
  includeArchived: false,
  assignee: '',
  assetId: '',
  relationTarget: '',
}

export function parseBoardFilterUrl(
  input: URLSearchParams | string
): BoardCurrentFilters {
  const params = toSearchParams(input)
  const rawTags: string[] = []
  for (const [key, value] of params) {
    if (key === 'tags' || key === 'tag') rawTags.push(value)
  }
  const tags = dedupeTags(rawTags)

  return {
    q: normalizeString(params.get('q')),
    tags,
    tagMatch: parseTagMatch(params.get('tagMatch')),
    includeArchived: params.get('includeArchived') === 'true',
    assignee: normalizeString(params.get('assignee')),
    assetId: normalizeString(params.get('assetId')),
    relationTarget: normalizeString(params.get('relationTarget')),
  }
}

export function serializeBoardFilterUrl(
  filters: BoardCurrentFilters | BoardCurrentQuery
): URLSearchParams {
  const normalized = normalizeBoardFilterUrl(filters)
  const params = new URLSearchParams()

  if (normalized.q) params.set('q', normalized.q)
  for (const tag of normalized.tags) params.append('tags', tag)
  if (normalized.tagMatch === 'any') params.set('tagMatch', 'any')
  if (normalized.includeArchived) params.set('includeArchived', 'true')
  if (normalized.assignee) params.set('assignee', normalized.assignee)
  if (normalized.assetId) params.set('assetId', normalized.assetId)
  if (normalized.relationTarget) {
    params.set('relationTarget', normalized.relationTarget)
  }

  return params
}

export function normalizeBoardFilterUrl(
  filters: BoardCurrentFilters | BoardCurrentQuery
): BoardCurrentFilters {
  return {
    q: normalizeString(filters.q),
    tags: dedupeTags(filters.tags ?? []),
    tagMatch: filters.tagMatch === 'any' ? 'any' : 'all',
    includeArchived: filters.includeArchived === true,
    assignee: normalizeString(filters.assignee),
    assetId: normalizeString(filters.assetId),
    relationTarget: normalizeString(filters.relationTarget),
  }
}

export function boardFilterUrlQuery(filters: BoardCurrentFilters): string {
  return serializeBoardFilterUrl(filters).toString()
}

export function appendBoardFilterUrlParams(
  params: URLSearchParams,
  filters: BoardCurrentQuery | undefined
): void {
  if (!filters) return
  for (const [key, value] of serializeBoardFilterUrl(filters)) {
    params.append(key, value)
  }
}

export function boardFilterSearchToQuery(search: string): string {
  return serializeBoardFilterUrl(parseBoardFilterUrl(search)).toString()
}

export function rawBoardFilterSearchQuery(search: string): string {
  return search.startsWith('?') ? search.slice(1) : search
}

export function shouldReplaceBoardFilterUrl(
  search: string,
  nextQuery: string
): boolean {
  return rawBoardFilterSearchQuery(search) !== nextQuery
}

export function areBoardFiltersEqual(
  left: BoardCurrentFilters,
  right: BoardCurrentFilters
): boolean {
  return boardFilterUrlQuery(left) === boardFilterUrlQuery(right)
}

function toSearchParams(input: URLSearchParams | string): URLSearchParams {
  if (input instanceof URLSearchParams) return input
  return new URLSearchParams(input.startsWith('?') ? input.slice(1) : input)
}

function parseTagMatch(value: string | null): BoardCurrentTagMatch {
  return value === 'any' ? 'any' : 'all'
}

function normalizeString(value: string | null | undefined): string {
  return value?.trim() ?? ''
}

function dedupeTags(values: readonly string[]): Tag[] {
  const seen = new Set<string>()
  const tags: Tag[] = []

  for (const value of values) {
    const tag = value.trim()
    if (!tag || seen.has(tag)) continue
    seen.add(tag)
    tags.push(tag as Tag)
  }

  return tags
}
