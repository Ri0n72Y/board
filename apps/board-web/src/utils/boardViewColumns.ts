import type { BoardStatusColumn } from './boardView'
import { UNCATEGORIZED_STATUS_ID } from './boardView'

export const BOARD_VISIBLE_COLUMNS_STORAGE_KEY =
  'labourboard.boardView.visibleColumns'

const DEFAULT_TODO_STATUS = 'status:todo'
const DEFAULT_DONE_STATUS = 'status:done'
const DEFAULT_DOING_STATUS = 'status:doing'
const DEFAULT_WIP_STATUS = 'status:wip'

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

export function resolveVisibleColumnIds(
  columnIds: readonly string[],
  storedColumnIds: readonly string[] | null | undefined
): string[] {
  const available = new Set(columnIds)
  const selected = (storedColumnIds ?? []).filter((id) => available.has(id))

  if (selected.length > 0)
    return sortColumnIdsByConfigOrder(columnIds, selected)

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

export function readVisibleColumnPreference(
  storage: Pick<Storage, 'getItem'> | undefined = getLocalStorage()
): string[] | null {
  if (!storage) return null

  try {
    const raw = storage.getItem(BOARD_VISIBLE_COLUMNS_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return null

    const values = parsed.filter(
      (value): value is string => typeof value === 'string' && value.length > 0
    )
    return values.length > 0 ? [...new Set(values)] : null
  } catch {
    return null
  }
}

export function writeVisibleColumnPreference(
  columnIds: readonly string[],
  selectedColumnIds: readonly string[],
  storage: Pick<Storage, 'setItem'> | undefined = getLocalStorage()
): string[] {
  const normalized = normalizeColumnSelectionForSave(
    columnIds,
    selectedColumnIds
  )
  if (!storage) return normalized

  try {
    storage.setItem(
      BOARD_VISIBLE_COLUMNS_STORAGE_KEY,
      JSON.stringify(normalized)
    )
  } catch {
    // localStorage unavailable
  }

  return normalized
}

export function getUncategorizedColumnLabel(
  language: string | undefined
): string {
  return language === 'zh-CN' ? '未分类' : 'Uncategorized'
}

function sortColumnIdsByConfigOrder(
  columnIds: readonly string[],
  selectedColumnIds: readonly string[]
): string[] {
  const selected = new Set(selectedColumnIds)
  return columnIds.filter((id) => selected.has(id))
}

function getLocalStorage(): Storage | undefined {
  if (typeof window === 'undefined') return undefined
  return window.localStorage
}
