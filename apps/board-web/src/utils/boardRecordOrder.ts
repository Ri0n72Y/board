import type {
  RecordBody,
  RecordItem,
  RecordResponse,
} from '@labour-board/shared'

/**
 * Record order is a View Preference (mvp-scope section 10/12): it does NOT
 * enter Patch / Record History / Snapshot. Stored in localStorage, last write
 * wins. Only columns the user actually reordered carry an entry; records not
 * listed keep their natural order after the ordered ones.
 */
export const BOARD_RECORD_ORDER_STORAGE_KEY =
  'labourboard.boardView.recordOrder'

export interface BoardRecordOrderPreference {
  columns: {
    columnId: string
    recordOrder: string[]
  }[]
}

export function readBoardRecordOrder(
  storage: Pick<Storage, 'getItem'> | undefined = getLocalStorage()
): BoardRecordOrderPreference | null {
  if (!storage) return null

  try {
    const raw = storage.getItem(BOARD_RECORD_ORDER_STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      return null

    const columns = (parsed as { columns?: unknown }).columns
    if (!Array.isArray(columns)) return null

    const normalizedColumns = columns
      .filter(
        (entry): entry is { columnId?: unknown; recordOrder?: unknown } =>
          !!entry && typeof entry === 'object' && !Array.isArray(entry)
      )
      .map((entry) => ({
        columnId: typeof entry.columnId === 'string' ? entry.columnId : '',
        recordOrder: uniqueStrings(entry.recordOrder),
      }))
      .filter((entry) => entry.columnId.length > 0)

    if (normalizedColumns.length === 0) return null
    return { columns: normalizedColumns }
  } catch {
    return null
  }
}

export function writeBoardRecordOrder(
  preference: BoardRecordOrderPreference,
  storage: Pick<Storage, 'setItem'> | undefined = getLocalStorage()
): void {
  if (!storage) return
  try {
    storage.setItem(BOARD_RECORD_ORDER_STORAGE_KEY, JSON.stringify(preference))
  } catch {
    // localStorage unavailable
  }
}

/** Ordered record ids for a column, empty when the column was never reordered. */
export function resolveRecordOrderForColumn(
  preference: BoardRecordOrderPreference | null,
  columnId: string
): string[] {
  if (!preference) return []
  const entry = preference.columns.find(
    (column) => column.columnId === columnId
  )
  return entry ? entry.recordOrder : []
}

/**
 * Sort records by the column's stored order. Records absent from the order
 * keep their original relative order, appended after the ordered ones.
 */
export function applyRecordOrder<
  T extends RecordResponse<RecordItem<RecordBody>>,
>(records: readonly T[], orderedIds: readonly string[]): T[] {
  if (orderedIds.length === 0) return [...records]

  const byId = new Map(records.map((record) => [record.body.id, record]))
  const ordered: T[] = []
  const seen = new Set<string>()

  for (const id of orderedIds) {
    const record = byId.get(id)
    if (!record || seen.has(id)) continue
    seen.add(id)
    ordered.push(record)
  }

  for (const record of records) {
    if (seen.has(record.body.id)) continue
    ordered.push(record)
  }

  return ordered
}

/**
 * Build a new preference after a record lands at `toIndex` inside the target
 * column. `targetColumnRecordIds` is the target column's current display order
 * (excluding the dragged record when it came from the same column).
 */
export function moveRecordInOrder(
  preference: BoardRecordOrderPreference | null,
  recordId: string,
  fromColumnId: string,
  toColumnId: string,
  toIndex: number,
  targetColumnRecordIds: readonly string[]
): BoardRecordOrderPreference {
  const columns = preference
    ? preference.columns.map((column) => ({ ...column }))
    : []

  const removeFrom = (columnId: string) => {
    const index = columns.findIndex((column) => column.columnId === columnId)
    if (index < 0) return
    const next = columns[index].recordOrder.filter((id) => id !== recordId)
    if (next.length === 0) {
      columns.splice(index, 1)
    } else {
      columns[index] = { ...columns[index], recordOrder: next }
    }
  }

  removeFrom(fromColumnId)
  if (toColumnId !== fromColumnId) removeFrom(toColumnId)

  // Rebuild the target column's full ordered list: existing order + dragged
  // record at the requested index. The entry is created even for an empty
  // target column so the first reorder establishes a stable order.
  const ordered = uniqueStrings(targetColumnRecordIds)
  const cleanIndex = Math.max(0, Math.min(toIndex, ordered.length))
  ordered.splice(cleanIndex, 0, recordId)

  const existing = columns.findIndex((column) => column.columnId === toColumnId)
  if (existing >= 0) {
    columns[existing] = { columnId: toColumnId, recordOrder: ordered }
  } else {
    columns.push({ columnId: toColumnId, recordOrder: ordered })
  }

  return { columns }
}

function uniqueStrings(values: unknown): string[] {
  if (!Array.isArray(values)) return []
  return [
    ...new Set(
      values.filter(
        (value): value is string =>
          typeof value === 'string' && value.length > 0
      )
    ),
  ]
}

function getLocalStorage(): Storage | undefined {
  if (typeof window === 'undefined') return undefined
  return window.localStorage
}
