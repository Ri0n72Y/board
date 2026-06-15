/**
 * Run with:
 * pnpm --filter @labour-board/api exec tsx ../board-web/src/utils/boardViewColumns.devcheck.ts
 */

import type {
  BoardConfig,
  RecordBody,
  RecordItem,
  RecordResponse,
  Tag,
} from '@labour-board/shared'
import { DEFAULT_BOARD_CONFIG } from '@labour-board/shared'
import {
  getStatusColumns,
  groupRecordsByStatus,
  UNCATEGORIZED_STATUS_ID,
} from './boardView'
import {
  BOARD_VISIBLE_COLUMNS_STORAGE_KEY,
  getDefaultVisibleColumnIds,
  getUncategorizedColumnLabel,
  readVisibleColumnPreference,
  resolveVisibleColumnIds,
  summarizeHiddenColumns,
  writeVisibleColumnPreference,
} from './boardViewColumns'

class MemoryStorage implements Pick<Storage, 'getItem' | 'setItem'> {
  private values = new Map<string, string>()

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }
}

const configWithDoing: BoardConfig = {
  ...DEFAULT_BOARD_CONFIG,
  tags: {
    ...DEFAULT_BOARD_CONFIG.tags,
    status: {
      required: [
        { id: 'status:backlog', displayName: 'backlog', locked: true },
        { id: 'status:todo', displayName: 'todo', locked: true },
        { id: 'status:doing', displayName: 'doing', locked: true },
        { id: 'status:wip', displayName: 'wip', locked: true },
        { id: 'status:review', displayName: 'review', locked: true },
        { id: 'status:done', displayName: 'done', locked: true },
        { id: 'status:blocked', displayName: 'blocked', locked: true },
        { id: 'status:archived', displayName: 'archived', locked: true },
      ],
      custom: [],
    },
  },
}

const columns = getStatusColumns(configWithDoing, [], (tag) => tag, {
  uncategorizedLabel: getUncategorizedColumnLabel('en-US'),
})
const columnIds = columns.map((column) => column.id)

eq(
  getDefaultVisibleColumnIds(columnIds),
  ['status:todo', 'status:doing', 'status:done'],
  'default columns use todo / doing / done',
)
notIncludes(
  getDefaultVisibleColumnIds(columnIds),
  'status:wip',
  'doing and wip present defaults to doing only',
)
eq(
  resolveVisibleColumnIds(columnIds, [
    'status:done',
    'status:todo',
    'status:review',
  ]),
  ['status:todo', 'status:review', 'status:done'],
  'selected columns are sorted by config order',
)
eq(
  resolveVisibleColumnIds(columnIds, []),
  ['status:todo', 'status:doing', 'status:done'],
  'empty selection falls back to defaults',
)
for (const hiddenByDefault of [
  'status:backlog',
  'status:review',
  'status:blocked',
  'status:archived',
  UNCATEGORIZED_STATUS_ID,
]) {
  notIncludes(
    getDefaultVisibleColumnIds(columnIds),
    hiddenByDefault,
    `${hiddenByDefault} is hidden by default`,
  )
}

eq(
  getDefaultVisibleColumnIds(
    getStatusColumns(DEFAULT_BOARD_CONFIG, [], (tag) => tag).map(
      (column) => column.id,
    ),
  ),
  ['status:todo', 'status:wip', 'status:done'],
  'wip is used when doing is not present',
)

const groupedColumns = groupRecordsByStatus(
  [
    record('todo-1', ['status:todo']),
    record('review-1', ['status:review']),
    record('review-2', ['status:review']),
    record('missing-status', []),
  ],
  columns,
)
eq(
  summarizeHiddenColumns(groupedColumns, [
    'status:todo',
    'status:doing',
    'status:done',
  ]),
  {
    hiddenColumnCount: 2,
    hiddenRecordCount: 3,
    hiddenUncategorizedRecordCount: 1,
  },
  'hidden column summary counts status and uncategorized records',
)

const uncategorizedColumn = columns.find(
  (column) => column.id === UNCATEGORIZED_STATUS_ID,
)
ok(uncategorizedColumn, 'uncategorized column exists')
eq(
  uncategorizedColumn?.label,
  'Uncategorized',
  'uncategorized label does not expose raw id',
)
eq(
  getUncategorizedColumnLabel('zh-CN'),
  '未分类',
  'zh-CN uncategorized label',
)

const storage = new MemoryStorage()
writeVisibleColumnPreference(columnIds, ['status:review'], storage)
eq(
  readVisibleColumnPreference(storage),
  ['status:review'],
  'localStorage write/read roundtrip',
)
writeVisibleColumnPreference(columnIds, [], storage)
eq(
  JSON.parse(storage.getItem(BOARD_VISIBLE_COLUMNS_STORAGE_KEY) ?? '[]'),
  ['status:todo', 'status:doing', 'status:done'],
  'localStorage empty write falls back to default columns',
)

console.log('boardViewColumns devcheck passed')

function record(
  id: string,
  tags: Tag[],
): RecordResponse<RecordItem<RecordBody>> {
  return {
    createdAt: '2026-06-13T00:00:00.000Z',
    createdBy: 'devcheck',
    body: {
      id,
      pid: id,
      schema: 'CardBody',
      tags,
      body: { title: id },
      relations: [],
    },
  }
}

function eq<T>(actual: T, expected: T, label: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${label}\nexpected: ${JSON.stringify(expected)}\nactual: ${JSON.stringify(actual)}`,
    )
  }
}

function notIncludes(values: readonly string[], value: string, label: string) {
  if (values.includes(value)) {
    throw new Error(`${label}\nunexpected value: ${value}`)
  }
}

function ok(value: unknown, label: string) {
  if (!value) throw new Error(label)
}
