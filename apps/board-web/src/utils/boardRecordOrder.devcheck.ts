/**
 * Run with:
 * pnpm --filter @labour-board/api exec tsx ../board-web/src/utils/boardRecordOrder.devcheck.ts
 */

import type {
  RecordBody,
  RecordItem,
  RecordResponse,
} from '@labour-board/shared'
import {
  applyRecordOrder,
  BOARD_RECORD_ORDER_STORAGE_KEY,
  moveRecordInOrder,
  readBoardRecordOrder,
  resolveRecordOrderForColumn,
  writeBoardRecordOrder,
  type BoardRecordOrderPreference,
} from './boardRecordOrder'

class MemoryStorage implements Pick<Storage, 'getItem' | 'setItem'> {
  private values = new Map<string, string>()

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }
}

type Record = RecordResponse<RecordItem<RecordBody>>

function makeRecord(id: string, status: string): Record {
  return {
    body: { id, tags: [`status:${status}`] },
  } as unknown as Record
}

function makeRecords(...ids: string[]): Record[] {
  return ids.map((id) => makeRecord(id, 'todo'))
}

function assertEqual(actual: unknown, expected: unknown, label: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${label}\nexpected: ${JSON.stringify(expected)}\nactual: ${JSON.stringify(actual)}`
    )
  }
}

function ok(value: unknown, label: string) {
  if (!value) throw new Error(label)
}

// --- readBoardRecordOrder ---
{
  const storage = new MemoryStorage()
  assertEqual(readBoardRecordOrder(storage), null, 'empty storage returns null')

  storage.setItem(BOARD_RECORD_ORDER_STORAGE_KEY, 'not-json')
  assertEqual(readBoardRecordOrder(storage), null, 'bad JSON returns null')

  storage.setItem(BOARD_RECORD_ORDER_STORAGE_KEY, '{"columns":[]}')
  assertEqual(readBoardRecordOrder(storage), null, 'empty columns returns null')

  storage.setItem(
    BOARD_RECORD_ORDER_STORAGE_KEY,
    JSON.stringify({
      columns: [{ columnId: 'status:todo', recordOrder: ['C-1', 'C-2', 'C-1'] }],
    })
  )
  const parsed = readBoardRecordOrder(storage)
  ok(parsed, 'valid storage parses')
  assertEqual(
    parsed?.columns[0].recordOrder,
    ['C-1', 'C-2'],
    'duplicate ids are deduplicated'
  )

  storage.setItem(
    BOARD_RECORD_ORDER_STORAGE_KEY,
    JSON.stringify({
      columns: [
        { columnId: 'status:todo', recordOrder: ['C-1'] },
        { columnId: '', recordOrder: ['C-9'] },
      ],
    })
  )
  assertEqual(
    readBoardRecordOrder(storage)?.columns.length,
    1,
    'entries with empty columnId are dropped'
  )
}

// --- resolveRecordOrderForColumn ---
{
  const pref: BoardRecordOrderPreference = {
    columns: [{ columnId: 'status:todo', recordOrder: ['C-1', 'C-2'] }],
  }
  assertEqual(
    resolveRecordOrderForColumn(pref, 'status:todo'),
    ['C-1', 'C-2'],
    'returns stored order for existing column'
  )
  assertEqual(
    resolveRecordOrderForColumn(pref, 'status:done'),
    [],
    'unknown column returns empty'
  )
  assertEqual(
    resolveRecordOrderForColumn(null, 'status:todo'),
    [],
    'null preference returns empty'
  )
}

// --- applyRecordOrder ---
{
  const records = makeRecords('C-1', 'C-2', 'C-3', 'C-4')
  assertEqual(
    applyRecordOrder(records, []).map((r) => r.body.id),
    ['C-1', 'C-2', 'C-3', 'C-4'],
    'empty order keeps natural order'
  )
  assertEqual(
    applyRecordOrder(records, ['C-3', 'C-1']).map((r) => r.body.id),
    ['C-3', 'C-1', 'C-2', 'C-4'],
    'ordered ids first, rest keep relative order'
  )
  assertEqual(
    applyRecordOrder(records, ['C-9']).map((r) => r.body.id),
    ['C-1', 'C-2', 'C-3', 'C-4'],
    'unknown ids are ignored'
  )
  assertEqual(
    applyRecordOrder(records, ['C-2', 'C-2', 'C-1']).map((r) => r.body.id),
    ['C-2', 'C-1', 'C-3', 'C-4'],
    'duplicate ordered ids collapse'
  )
}

// --- moveRecordInOrder: same-column reorder ---
{
  const pref: BoardRecordOrderPreference = {
    columns: [{ columnId: 'status:todo', recordOrder: ['C-1', 'C-2', 'C-3', 'C-4'] }],
  }
  const next = moveRecordInOrder(
    pref,
    'C-1',
    'status:todo',
    'status:todo',
    2,
    ['C-2', 'C-3', 'C-4']
  )
  assertEqual(
    resolveRecordOrderForColumn(next, 'status:todo'),
    ['C-2', 'C-3', 'C-1', 'C-4'],
    'same-column move places record at target index'
  )
}

// --- moveRecordInOrder: same-column to top / bottom ---
{
  const pref: BoardRecordOrderPreference = {
    columns: [{ columnId: 'status:todo', recordOrder: ['C-1', 'C-2', 'C-3'] }],
  }
  const toTop = moveRecordInOrder(pref, 'C-3', 'status:todo', 'status:todo', 0, [
    'C-1',
    'C-2',
  ])
  assertEqual(
    resolveRecordOrderForColumn(toTop, 'status:todo'),
    ['C-3', 'C-1', 'C-2'],
    'same-column move to index 0'
  )

  const toBottom = moveRecordInOrder(
    pref,
    'C-1',
    'status:todo',
    'status:todo',
    99,
    ['C-2', 'C-3']
  )
  assertEqual(
    resolveRecordOrderForColumn(toBottom, 'status:todo'),
    ['C-2', 'C-3', 'C-1'],
    'out-of-range index clamps to end'
  )
}

// --- moveRecordInOrder: cross-column ---
{
  const pref: BoardRecordOrderPreference = {
    columns: [
      { columnId: 'status:todo', recordOrder: ['C-1', 'C-2'] },
      { columnId: 'status:done', recordOrder: ['D-1', 'D-2'] },
    ],
  }
  const next = moveRecordInOrder(
    pref,
    'C-1',
    'status:todo',
    'status:done',
    1,
    ['D-1', 'D-2']
  )
  assertEqual(
    resolveRecordOrderForColumn(next, 'status:todo'),
    ['C-2'],
    'source column removes moved record'
  )
  assertEqual(
    resolveRecordOrderForColumn(next, 'status:done'),
    ['D-1', 'C-1', 'D-2'],
    'target column inserts at index'
  )
}

// --- moveRecordInOrder: cross-column into empty target ---
{
  const pref: BoardRecordOrderPreference | null = null
  const next = moveRecordInOrder(pref, 'C-1', '', 'status:todo', 0, [])
  assertEqual(
    resolveRecordOrderForColumn(next, 'status:todo'),
    ['C-1'],
    'drop into empty column creates entry'
  )
}

// --- moveRecordInOrder: cross-column drains source entry ---
{
  const pref: BoardRecordOrderPreference = {
    columns: [
      { columnId: 'status:todo', recordOrder: ['C-1'] },
      { columnId: 'status:done', recordOrder: ['D-1'] },
    ],
  }
  const next = moveRecordInOrder(pref, 'C-1', 'status:todo', 'status:done', 1, [
    'D-1',
  ])
  assertEqual(
    next.columns.filter((c) => c.columnId === 'status:todo').length,
    0,
    'source entry removed when emptied'
  )
}

// --- writeBoardRecordOrder round-trip ---
{
  const storage = new MemoryStorage()
  const pref: BoardRecordOrderPreference = {
    columns: [{ columnId: 'status:todo', recordOrder: ['C-1'] }],
  }
  writeBoardRecordOrder(pref, storage)
  assertEqual(
    readBoardRecordOrder(storage)?.columns[0].recordOrder,
    ['C-1'],
    'write then read round-trips'
  )
}

console.log('boardRecordOrder.devcheck: all checks passed')
