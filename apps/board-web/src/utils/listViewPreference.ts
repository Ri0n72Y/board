/**
 * Persistence for list view column order (localStorage).
 * Kept separate from board column preferences (boardViewColumns.ts) because
 * the list view columns are the record attributes, not the status columns.
 */

const LIST_VIEW_PREFERENCE_STORAGE_KEY = 'board:listViewPreference'

export interface ListViewPreference {
  columnOrder: string[]
}

function getLocalStorage(): Pick<Storage, 'getItem'> | undefined {
  try {
    if (typeof window === 'undefined') return undefined
    return window.localStorage
  } catch {
    return undefined
  }
}

function uniqueStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of value) {
    if (typeof item === 'string' && !seen.has(item)) {
      seen.add(item)
      out.push(item)
    }
  }
  return out
}

export function readListViewColumnOrder(
  storage: Pick<Storage, 'getItem'> | undefined = getLocalStorage()
): string[] | null {
  if (!storage) return null
  try {
    const raw = storage.getItem(LIST_VIEW_PREFERENCE_STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    const order = uniqueStrings((parsed as { columnOrder?: unknown }).columnOrder)
    return order.length > 0 ? order : null
  } catch {
    return null
  }
}

export function writeListViewColumnOrder(
  columnOrder: readonly string[],
  storage: Pick<Storage, 'setItem'> | undefined = getLocalStorage() as Pick<
    Storage,
    'setItem'
  > | undefined
): void {
  if (!storage) return
  try {
    const preference: ListViewPreference = { columnOrder: [...columnOrder] }
    storage.setItem(LIST_VIEW_PREFERENCE_STORAGE_KEY, JSON.stringify(preference))
  } catch {
    // localStorage unavailable
  }
}

/**
 * Merge a persisted order with the full set of known columns. Unknown ids are
 * dropped, missing columns are appended in their default position.
 */
export function resolveListViewColumnOrder(
  knownColumnIds: readonly string[],
  persistedOrder: readonly string[] | null | undefined
): string[] {
  if (!persistedOrder || persistedOrder.length === 0) return [...knownColumnIds]
  const known = new Set(knownColumnIds)
  const seen = new Set<string>()
  const ordered: string[] = []
  for (const id of persistedOrder) {
    if (known.has(id) && !seen.has(id)) {
      seen.add(id)
      ordered.push(id)
    }
  }
  const missing = knownColumnIds.filter((id) => !seen.has(id))
  return [...ordered, ...missing]
}

export function moveListViewColumn(
  columnOrder: readonly string[],
  sourceId: string,
  targetId: string
): string[] {
  const sourceIndex = columnOrder.indexOf(sourceId)
  const targetIndex = columnOrder.indexOf(targetId)
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex)
    return [...columnOrder]
  const next = [...columnOrder]
  const [moved] = next.splice(sourceIndex, 1)
  next.splice(targetIndex, 0, moved)
  return next
}

export function moveListViewColumnByOffset(
  columnOrder: readonly string[],
  columnId: string,
  offset: number
): string[] {
  const index = columnOrder.indexOf(columnId)
  if (index < 0) return [...columnOrder]
  const targetIndex = Math.min(
    Math.max(index + offset, 0),
    columnOrder.length - 1
  )
  if (targetIndex === index) return [...columnOrder]
  const next = [...columnOrder]
  const [moved] = next.splice(index, 1)
  next.splice(targetIndex, 0, moved)
  return next
}
