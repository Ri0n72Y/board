import type { DeepPartial, PatchItem, RecordBody, RecordResponse } from '@labour-board/shared'
import {
  buildPatchTimeline,
  debugInitiallyOpen,
  formatRelationTarget,
  formatRelations,
  summarizePatch,
  type HistorySummaryCopy,
} from './historySummary'

const copy: HistorySummaryCopy = {
  tagAdded: '新增标签',
  tagRemoved: '删除标签',
  noVisibleChanges: '无可见字段修改',
  nullValue: '无',
  assignee: '负责人',
  unassigned: '未分配',
  body: '正文',
  assets: '资产',
  relations: '关联',
  modified: '已修改',
  itemCount: (count) => `${count} 项`,
  fieldLabel: (namespace) =>
    ({
      status: '状态',
      priority: '优先级',
      scope: '范围',
    })[namespace] ?? namespace,
  bodyFieldLabel: (field) =>
    ({
      title: '标题',
      description: '摘要',
      content: '详细内容',
    })[field] ?? field,
}

let failures = 0

function assert(expr: boolean, msg: string) {
  if (!expr) {
    console.error(`FAIL: ${msg}`)
    failures++
  } else {
    console.log(`  OK: ${msg}`)
  }
}

function eq(actual: unknown, expected: unknown, label: string) {
  assert(actual === expected, `${label} expected "${expected}" got "${actual}"`)
}

function patch(
  id: string,
  body: Partial<PatchItem<DeepPartial<RecordBody>>>,
  createdAt = `2026-06-13T09:3${id}:00.000Z`
): RecordResponse<PatchItem<DeepPartial<RecordBody>>> {
  return {
    createdBy: 'local',
    createdAt,
    body: {
      id: `patch-${id}`,
      pid: 'CARD-5',
      schema: 'CardBody',
      targetId: 'record-1',
      parentId: null,
      createdBy: 'local',
      createdAt,
      ...body,
    } as PatchItem<DeepPartial<RecordBody>>,
  }
}

const statusLines = summarizePatch(
  {
    id: 'p-status',
    pid: 'CARD-5',
    schema: 'CardBody',
    targetId: 'record-1',
    parentId: null,
    tagChanges: {
      change: [{ namespace: 'status', from: 'status:todo', to: 'status:doing' }],
    },
  },
  { language: 'zh-CN', copy }
)
eq(statusLines[0]?.label, '状态', 'status label')
eq(statusLines[0]?.value, '待办 → 进行中', 'status summary')

const priorityLines = summarizePatch(
  {
    id: 'p-priority',
    pid: 'CARD-5',
    schema: 'CardBody',
    targetId: 'record-1',
    parentId: 'parent-1',
    description: 'hidden by summary',
    tagChanges: {
      change: [{ namespace: 'priority', from: 'priority:p3', to: 'priority:p0' }],
    },
  },
  { language: 'zh-CN', copy }
)
eq(priorityLines[0]?.label, '优先级', 'priority label')
eq(priorityLines[0]?.value, 'P3：不紧急不重要 → P0：重要紧急', 'priority summary')
assert(
  !priorityLines.some((line) => line.value.includes('parent-1')),
  'summary does not show parentId'
)
assert(
  !priorityLines.some((line) => line.value.includes('hidden by summary')),
  'summary does not show description'
)

const addRemoveLines = summarizePatch(
  {
    id: 'p-tags',
    pid: 'CARD-5',
    schema: 'CardBody',
    targetId: 'record-1',
    parentId: null,
    tagChanges: {
      add: ['scope:combat', 'scope:ui'],
      remove: ['scope:shop'],
    },
  },
  { language: 'zh-CN', copy }
)
eq(addRemoveLines[0]?.label, '新增标签', 'add label')
eq(addRemoveLines[0]?.value, '战斗、界面', 'add summary')
eq(addRemoveLines[1]?.label, '删除标签', 'remove label')
eq(addRemoveLines[1]?.value, '商店', 'remove summary')

const bodyDescriptionLines = summarizePatch(
  {
    id: 'p-body-description',
    pid: 'CARD-5',
    schema: 'CardBody',
    targetId: 'record-1',
    parentId: null,
    body: { description: 'x' },
  },
  { language: 'zh-CN', copy }
)
eq(bodyDescriptionLines[0]?.label, '正文', 'body description label')
assert(
  bodyDescriptionLines[0]?.value.includes('摘要') === true,
  'body description summary is localized'
)
assert(
  bodyDescriptionLines[0]?.value.includes('description') === false,
  'body description summary does not show raw key'
)

const bodyTitleLines = summarizePatch(
  {
    id: 'p-body-title',
    pid: 'CARD-5',
    schema: 'CardBody',
    targetId: 'record-1',
    parentId: null,
    body: { title: 'x' },
  },
  { language: 'zh-CN', copy }
)
assert(bodyTitleLines[0]?.value.includes('标题') === true, 'body title summary is localized')
assert(bodyTitleLines[0]?.value.includes('title') === false, 'body title summary does not show raw key')

const bodyContentLines = summarizePatch(
  {
    id: 'p-body-content',
    pid: 'CARD-5',
    schema: 'CardBody',
    targetId: 'record-1',
    parentId: null,
    body: { content: 'x' },
  },
  { language: 'zh-CN', copy }
)
assert(
  bodyContentLines[0]?.value.includes('详细内容') === true,
  'body content summary is localized'
)
assert(
  bodyContentLines[0]?.value.includes('content') === false,
  'body content summary does not show raw key'
)

const emptyLines = summarizePatch(
  {
    id: 'p-empty',
    pid: 'CARD-5',
    schema: 'CardBody',
    targetId: 'record-1',
    parentId: null,
  },
  { language: 'zh-CN', copy }
)
eq(emptyLines[0]?.value, '无可见字段修改', 'unmodified fields are hidden')
eq(debugInitiallyOpen(), false, 'raw JSON is collapsed by default')

eq(
  formatRelationTarget('target-1', {
    'target-1': { pid: 'CARD-4', title: '地图加载', schema: 'CardBody' },
  }),
  'CARD-4 地图加载',
  'relation target uses pid and title'
)
eq(
  formatRelationTarget('9332aaaabbbbccccdddd5000d', undefined),
  '9332...5000d',
  'unknown relation target uses short id'
)
eq(
  formatRelations(
    [{ constraint: 'dependsOn', target: 'target-1' }],
    { 'target-1': { pid: 'CARD-4', title: '地图加载', schema: 'CardBody' } },
    (key, fallback) => (key === 'history.relation.dependsOn' ? '依赖' : fallback),
    '：'
  )[0],
  '依赖：CARD-4 地图加载',
  'relation constraint is translated'
)

const timeline = buildPatchTimeline(
  [
    patch('1', { tagChanges: { change: [{ namespace: 'status', from: 'status:todo', to: 'status:doing' }] } }),
    patch('2', { tagChanges: { change: [{ namespace: 'status', from: 'status:doing', to: 'status:done' }] } }),
  ],
  { language: 'zh-CN', copy }
)
eq(timeline[0]?.ordinal, 2, 'newest patch displays first')
eq(timeline[0]?.patch.body.id, 'patch-2', 'timeline order is newest first')

console.log(`\n${failures === 0 ? 'ALL PASSED' : `${failures} FAILURES`}`)
if (failures > 0) throw new Error(`${failures} assertions failed`)
