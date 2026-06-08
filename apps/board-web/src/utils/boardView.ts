import type {
  BoardConfig,
  RecordBody,
  RecordItem,
  RecordResponse,
  Tag,
  TagDefinition,
} from '@labour-board/shared'

export const UNCATEGORIZED_STATUS_ID = '__uncategorized__'

export interface BoardStatusColumn {
  id: string
  label: string
  tag: Tag | null
  records: RecordResponse<RecordItem<RecordBody>>[]
}

interface StatusColumnSeed {
  id: string
  label: string
  tag: Tag | null
}

/**
 * A function that converts a raw tag string into a display label.
 * When provided, it overrides the built-in fallback formatter.
 */
export type TagLabelFormatter = (tag: string) => string

function defaultTagLabel(tag: string): string {
  if (tag === UNCATEGORIZED_STATUS_ID) return 'Uncategorized'
  const value = tag.startsWith('status:') ? tag.slice('status:'.length) : tag
  return value
    .split(/[-_:]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function getRecordStatusTag(
  record: RecordResponse<RecordItem<RecordBody>>,
): Tag | null {
  return record.body.tags.find((tag) => tag.startsWith('status:')) ?? null
}

/**
 * Build status columns from config + records.
 *
 * @param formatTag  Optional i18n-aware tag formatter. When provided, column labels
 *                   will use it for display names. Falls back to English capitalization.
 */
export function getStatusColumns(
  config: BoardConfig | null,
  records: RecordResponse<RecordItem<RecordBody>>[],
  formatTag?: TagLabelFormatter,
): BoardStatusColumn[] {
  const labeler = formatTag ?? defaultTagLabel
  const seeds = new Map<string, StatusColumnSeed>()

  if (config) {
    addConfigStatusDefinitions(seeds, config.tags.status.required, labeler)
    addConfigStatusDefinitions(seeds, config.tags.status.custom, labeler)
  }

  for (const record of records) {
    const statusTag = getRecordStatusTag(record)
    if (statusTag && !seeds.has(statusTag)) {
      seeds.set(statusTag, {
        id: statusTag,
        label: labeler(statusTag),
        tag: statusTag,
      })
    }
  }

  // Always keep uncategorized at the end
  if (!seeds.has(UNCATEGORIZED_STATUS_ID)) {
    seeds.set(UNCATEGORIZED_STATUS_ID, {
      id: UNCATEGORIZED_STATUS_ID,
      label: labeler(UNCATEGORIZED_STATUS_ID),
      tag: null,
    })
  }

  return [...seeds.values()].map((seed) => ({ ...seed, records: [] }))
}

export function groupRecordsByStatus(
  records: RecordResponse<RecordItem<RecordBody>>[],
  statusColumns: BoardStatusColumn[],
): BoardStatusColumn[] {
  const grouped =
    statusColumns.length > 0
      ? statusColumns.map((column) => ({ ...column, records: [] }))
      : getStatusColumns(null, [])
  const byTag = new Map<string, BoardStatusColumn>()
  const uncategorized = grouped.find((column) => column.tag === null)

  for (const column of grouped) {
    if (column.tag) byTag.set(column.tag, column)
  }

  for (const record of records) {
    const statusTag = getRecordStatusTag(record)
    const column = statusTag ? byTag.get(statusTag) : null
    if (column) {
      column.records.push(record)
    } else {
      uncategorized?.records.push(record)
    }
  }

  return grouped
}

function addConfigStatusDefinitions(
  seeds: Map<string, StatusColumnSeed>,
  definitions: TagDefinition[],
  formatTag: TagLabelFormatter,
) {
  for (const definition of definitions) {
    if (seeds.has(definition.id)) continue
    seeds.set(definition.id, {
      id: definition.id,
      label: formatTag(definition.id),
      tag: definition.id,
    })
  }
}
