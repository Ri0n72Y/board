import type { BoardStatusColumn } from './boardView'
import { UNCATEGORIZED_STATUS_ID } from './boardView'

export const BOARD_COLUMN_PREFERENCE_STORAGE_KEY =
  'labourboard.boardView.columnPreference'

const DEFAULT_TODO_STATUS = 'status:todo'
const DEFAULT_DONE_STATUS = 'status:done'
const DEFAULT_DOING_STATUS = 'status:doing'
const DEFAULT_WIP_STATUS = 'status:wip'

export interface BoardColumnPreference {
  visibleColumnIds: string[]
  columnOrderIds: string[]
}

export interface HiddenColumnSummary {
  hiddenColumnCount: number
  hiddenRecordCount: number
  hiddenUncategorizedRecordCount: number
}

export function getDefaultVisibleColumnIds(
  columnIds: readonly string[]
): string[] {
  const available = new Set(columnIds)
  const desired = [
    DEFAULT_TODO_STATUS,
    available.has(DEFAULT_DOING_STATUS)
      ? DEFAULT_DOING_STATUS
      : DEFAULT_WIP_STATUS,
    DEFAULT_DONE_STATUS,
  ]

  return columnIds.filter((id) => desired.includes(id))
}

export function resolveColumnOrderIds(
  columnIds: readonly string[],
  storedOrderIds: readonly string[] | null | undefined
): string[] {
  const available = new Set(columnIds)
  const ordered = uniqueStrings(storedOrderIds ?? []).filter((id) =>
    available.has(id)
  )
  const orderedSet = new Set(ordered)
  const missing = columnIds.filter((id) => !orderedSet.has(id))
  return [...ordered, ...missing]
}

export function resolveVisibleColumnIds(
  columnIds: readonly string[],
  storedColumnIds: readonly string[] | null | undefined
): string[] {
  const available = new Set(columnIds)
  const selected = uniqueStrings(storedColumnIds ?? []).filter((id) =>
    available.has(id)
  )

  if (selected.length > 0) return selected

  const defaults = getDefaultVisibleColumnIds(columnIds)
  if (defaults.length > 0) return defaults

  return columnIds.filter((id) => id !== UNCATEGORIZED_STATUS_ID).slice(0, 1)
}

export function normalizeColumnSelectionForSave(
  columnIds: readonly string[],
  nextColumnIds: readonly string[]
): string[] {
  return resolveVisibleColumnIds(columnIds, nextColumnIds)
}

export function normalizeBoardColumnPreference(
  columnIds: readonly string[],
  visibleColumnIds: readonly string[] | null | undefined,
  columnOrderIds: readonly string[] | null | undefined
): BoardColumnPreference {
  const columnOrder = resolveColumnOrderIds(columnIds, columnOrderIds)
  const visibleColumns = resolveVisibleColumnIds(columnOrder, visibleColumnIds)
  return {
    visibleColumnIds: visibleColumns,
    columnOrderIds: columnOrder,
  }
}

export function orderColumns<T extends { id: string }>(
  columns: readonly T[],
  columnOrderIds: readonly string[] | null | undefined
): T[] {
  const byId = new Map(columns.map((column) => [column.id, column]))
  const orderedIds = resolveColumnOrderIds(
    columns.map((column) => column.id),
    columnOrderIds
  )
  return orderedIds
    .map((id) => byId.get(id))
    .filter((column): column is T => column != null)
}

export function summarizeHiddenColumns(
  columns: readonly BoardStatusColumn[],
  visibleColumnIds: readonly string[]
): HiddenColumnSummary {
  const visible = new Set(visibleColumnIds)
  let hiddenColumnCount = 0
  let hiddenRecordCount = 0
  let hiddenUncategorizedRecordCount = 0

  for (const column of columns) {
    if (visible.has(column.id)) continue
    if (column.records.length === 0) continue

    hiddenColumnCount += 1
    hiddenRecordCount += column.records.length
    if (column.id === UNCATEGORIZED_STATUS_ID) {
      hiddenUncategorizedRecordCount += column.records.length
    }
  }

  return {
    hiddenColumnCount,
    hiddenRecordCount,
    hiddenUncategorizedRecordCount,
  }
}

export function readBoardColumnPreference(
  storage: Pick<Storage, 'getItem'> | undefined = getLocalStorage()
): BoardColumnPreference | null {
  if (!storage) return null

  try {
    const raw = storage.getItem(BOARD_COLUMN_PREFERENCE_STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null

    const visibleColumnIds = uniqueStrings(
      (parsed as { visibleColumnIds?: unknown }).visibleColumnIds
    )
    const columnOrderIds = uniqueStrings(
      (parsed as { columnOrderIds?: unknown }).columnOrderIds
    )

    if (visibleColumnIds.length === 0 && columnOrderIds.length === 0)
      return null

    return { visibleColumnIds, columnOrderIds }
  } catch {
    return null
  }
}

export function readVisibleColumnPreference(
  storage: Pick<Storage, 'getItem'> | undefined = getLocalStorage()
): string[] | null {
  return readBoardColumnPreference(storage)?.visibleColumnIds ?? null
}

export function writeBoardColumnPreference(
  columnIds: readonly string[],
  selectedColumnIds: readonly string[],
  columnOrderIds: readonly string[],
  storage: Pick<Storage, 'setItem'> | undefined = getLocalStorage()
): BoardColumnPreference {
  const normalized = normalizeBoardColumnPreference(
    columnIds,
    selectedColumnIds,
    columnOrderIds
  )
  if (!storage) return normalized

  try {
    storage.setItem(
      BOARD_COLUMN_PREFERENCE_STORAGE_KEY,
      JSON.stringify(normalized)
    )
  } catch {
    // localStorage unavailable
  }

  return normalized
}

export function writeVisibleColumnPreference(
  columnIds: readonly string[],
  selectedColumnIds: readonly string[],
  storage: Pick<Storage, 'setItem'> | undefined = getLocalStorage()
): string[] {
  const normalized = writeBoardColumnPreference(
    columnIds,
    selectedColumnIds,
    selectedColumnIds,
    storage
  )
  return normalized.visibleColumnIds
}

export function getUncategorizedColumnLabel(
  language: string | undefined
): string {
  return language === 'zh-CN' ? '未分类' : 'Uncategorized'
}

function uniqueStrings(values: unknown): string[] {
  if (!Array.isArray(values)) return []
  return [
    ...new Set(
      values.filter(
        (value): value is string => typeof value === 'string' && value.length > 0
      )
    ),
  ]
}

function getLocalStorage(): Storage | undefined {
  if (typeof window === 'undefined') return undefined
  return window.localStorage
}
