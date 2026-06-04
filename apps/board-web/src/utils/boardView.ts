import type {
  BoardConfig,
  RecordBody,
  RecordItem,
  RecordResponse,
  Tag,
  TagDefinition,
} from '@labour-board/shared'

export const UNCATEGORIZED_STATUS_ID = '__uncategorized__'
export const UNCATEGORIZED_STATUS_LABEL = 'Uncategorized'

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

export function getRecordStatusTag(
  record: RecordResponse<RecordItem<RecordBody>>,
): Tag | null {
  return record.body.tags.find((tag) => tag.startsWith('status:')) ?? null
}

export function getStatusColumns(
  config: BoardConfig | null,
  records: RecordResponse<RecordItem<RecordBody>>[],
): BoardStatusColumn[] {
  const seeds = new Map<string, StatusColumnSeed>()

  if (config) {
    addConfigStatusDefinitions(seeds, config.tags.status.required)
    addConfigStatusDefinitions(seeds, config.tags.status.custom)
  }

  for (const record of records) {
    const statusTag = getRecordStatusTag(record)
    if (statusTag && !seeds.has(statusTag)) {
      seeds.set(statusTag, {
        id: statusTag,
        label: formatStatusLabel(statusTag),
        tag: statusTag,
      })
    }
  }

  if (!seeds.has(UNCATEGORIZED_STATUS_ID)) {
    seeds.set(UNCATEGORIZED_STATUS_ID, {
      id: UNCATEGORIZED_STATUS_ID,
      label: UNCATEGORIZED_STATUS_LABEL,
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
) {
  for (const definition of definitions) {
    if (seeds.has(definition.id)) continue
    seeds.set(definition.id, {
      id: definition.id,
      label: definition.displayName || formatStatusLabel(definition.id),
      tag: definition.id,
    })
  }
}

function formatStatusLabel(tag: Tag): string {
  const value = tag.startsWith('status:') ? tag.slice('status:'.length) : tag
  return value
    .split(/[-_:]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}
