/**
 * Run with:
 * pnpm --filter @labour-board/api exec tsx ../board-web/src/utils/historySummary.devcheck.ts
 */

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
  tagAdded: 'Added tags',
  tagRemoved: 'Removed tags',
  noVisibleChanges: 'No visible field changes',
  nullValue: 'None',
  assignee: 'Assignee',
  unassigned: 'Unassigned',
  body: 'Body',
  assets: 'Assets',
  assetListEmpty: 'No assets',
  relations: 'Relations',
  modified: 'Modified',
  itemCount: (count) => `${count} items`,
  fieldLabel: (namespace) =>
    ({
      status: 'Status',
      priority: 'Priority',
      scope: 'Scope',
    })[namespace] ?? namespace,
  bodyFieldLabel: (field) =>
    ({
      title: 'Title',
      description: 'Summary',
      content: 'Details',
    })[field] ?? field,
  relationConstraintLabel: (constraint) =>
    ({
      dependsOn: 'Depends on',
      blocks: 'Blocks',
      blockedBy: 'Blocked by',
    })[constraint] ?? constraint,
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

function eq<T>(actual: T, expected: T, label: string) {
  assert(Object.is(actual, expected), `${label} expected "${expected}" got "${actual}"`)
}

function patch(
  id: string,
  body: Partial<PatchItem<DeepPartial<RecordBody>>>,
  createdAt = `2026-06-13T09:3${id}:00.000Z`,
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
  { language: 'en-US', copy },
)
eq(statusLines[0]?.label, 'Status', 'status label')
eq(statusLines[0]?.value, 'Todo \u2192 Doing', 'status summary')

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
  { language: 'en-US', copy },
)
eq(priorityLines[0]?.label, 'Priority', 'priority label')
assert(
  !priorityLines.some((line) => line.value.includes('parent-1')),
  'summary does not show parentId',
)
assert(
  !priorityLines.some((line) => line.value.includes('hidden by summary')),
  'summary does not show description',
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
  { language: 'en-US', copy },
)
eq(addRemoveLines[0]?.label, 'Added tags', 'add label')
eq(addRemoveLines[1]?.label, 'Removed tags', 'remove label')

const bodyDescriptionLines = summarizePatch(
  {
    id: 'p-body-description',
    pid: 'CARD-5',
    schema: 'CardBody',
    targetId: 'record-1',
    parentId: null,
    body: { description: 'x' },
  },
  { language: 'en-US', copy },
)
eq(bodyDescriptionLines[0]?.label, 'Body', 'body description label')
assert(
  bodyDescriptionLines[0]?.value.includes('Summary') === true,
  'body description summary is localized',
)
assert(
  bodyDescriptionLines[0]?.value.includes('description') === false,
  'body description summary does not show raw key',
)

const emptyLines = summarizePatch(
  {
    id: 'p-empty',
    pid: 'CARD-5',
    schema: 'CardBody',
    targetId: 'record-1',
    parentId: null,
  },
  { language: 'en-US', copy },
)
eq(emptyLines[0]?.value, 'No visible field changes', 'unmodified fields are hidden')
eq(debugInitiallyOpen(), false, 'raw JSON is collapsed by default')

const assetOptions = [
  {
    value: 'asset-1',
    label: 'ASSET-1 - Battle scene',
    meta: 'asset-1',
    referenceState: 'resolved' as const,
  },
]

const assetLines = summarizePatch(
  {
    id: 'p-assets',
    pid: 'CARD-5',
    schema: 'CardBody',
    targetId: 'record-1',
    parentId: null,
    assets: ['asset-1'],
  },
  { language: 'en-US', copy, assetOptions },
)
eq(assetLines[0]?.label, 'Assets', 'asset summary label')
eq(
  assetLines[0]?.value,
  'ASSET-1 - Battle scene',
  'patch.assets displays readable label',
)

const unknownAssetLines = summarizePatch(
  {
    id: 'p-assets-unknown',
    pid: 'CARD-5',
    schema: 'CardBody',
    targetId: 'record-1',
    parentId: null,
    assets: ['unknown-asset-reference-1234567890'],
  },
  { language: 'en-US', copy, assetOptions },
)
eq(
  unknownAssetLines[0]?.value,
  'unknown-...7890',
  'patch.assets unknown fallback short id',
)

const emptyAssetLines = summarizePatch(
  {
    id: 'p-assets-empty',
    pid: 'CARD-5',
    schema: 'CardBody',
    targetId: 'record-1',
    parentId: null,
    assets: [],
  },
  { language: 'en-US', copy, assetOptions },
)
eq(emptyAssetLines[0]?.value, 'No assets', 'patch.assets empty uses copy')

const references = {
  'target-1': { pid: 'CARD-4', title: 'Enter battle', schema: 'CardBody' },
}
eq(
  formatRelationTarget('target-1', references),
  'CARD-4 - Enter battle',
  'relation target uses pid and title',
)
eq(
  formatRelationTarget('9332aaaabbbbccccdddd5000d', undefined),
  '9332aaaa...000d',
  'unknown relation target uses short id',
)
eq(
  formatRelations(
    [{ constraint: 'dependsOn', target: 'target-1' }],
    references,
    (key, fallback) => (key === 'relations.constraint.dependsOn' ? 'Depends on' : fallback),
    ': ',
  )[0],
  'Depends on: CARD-4 - Enter battle',
  'relation constraint is translated',
)

const relationLines = summarizePatch(
  {
    id: 'p-relations',
    pid: 'CARD-5',
    schema: 'CardBody',
    targetId: 'record-1',
    parentId: null,
    relations: [
      { constraint: 'dependsOn', target: 'target-1' },
      { constraint: 'blocks', target: 'unknown-target-1234567890', description: 'note' },
    ],
  },
  { language: 'en-US', copy, references },
)
eq(relationLines[0]?.label, 'Relations', 'relation summary label')
eq(
  relationLines[0]?.value,
  'Depends on CARD-4 - Enter battle; Blocks unknown-...7890 (note)',
  'relation summary displays constraint label + PID title',
)

const timeline = buildPatchTimeline(
  [
    patch('1', { tagChanges: { change: [{ namespace: 'status', from: 'status:todo', to: 'status:doing' }] } }),
    patch('2', { tagChanges: { change: [{ namespace: 'status', from: 'status:doing', to: 'status:done' }] } }),
  ],
  { language: 'en-US', copy },
)
eq(timeline[0]?.ordinal, 2, 'newest patch displays first')
eq(timeline[0]?.patch.body.id, 'patch-2', 'timeline order is newest first')

console.log(`\n${failures === 0 ? 'historySummary devcheck passed' : `${failures} failures`}`)
if (failures > 0) throw new Error(`${failures} assertions failed`)
