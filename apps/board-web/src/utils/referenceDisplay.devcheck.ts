/**
 * Run with:
 * pnpm --filter @labour-board/api exec tsx ../board-web/src/utils/referenceDisplay.devcheck.ts
 */

import type { RecordReferenceOption } from './recordReferenceOptions'
import {
  formatReferenceItem,
  formatReferenceLabel,
  formatReferenceList,
  summarizeReferenceList,
} from './referenceDisplay'
import { summarizePatch, type HistorySummaryCopy } from './historySummary'

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
  assert(
    Object.is(actual, expected),
    `${label} expected "${expected}" got "${actual}"`
  )
}

const options: RecordReferenceOption[] = [
  {
    value: 'asset-a',
    label: 'ASSET-1 - Battle scene',
    meta: 'asset-a',
    referenceState: 'resolved',
  },
  {
    value: 'asset-b',
    label: 'ASSET-2 - Card data',
    meta: 'asset-b',
    referenceState: 'resolved',
  },
]

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
  fieldLabel: (namespace) => namespace,
  bodyFieldLabel: (field) => field,
  relationConstraintLabel: (constraint) => constraint,
}

eq(
  formatReferenceLabel('asset-a', options),
  'ASSET-1 - Battle scene',
  'resolved reference displays PID + title'
)
eq(
  formatReferenceLabel('missing-reference-1234567890', options),
  'missing-...7890',
  'unknown reference displays short id'
)

const resolved = formatReferenceItem('asset-a', options)
eq(resolved.value, 'asset-a', 'raw id is retained as value')
eq(resolved.meta, 'asset-a', 'raw id is retained as meta')
eq(resolved.resolved, true, 'resolved marker is true for resolved option')

const unknown = formatReferenceItem('missing-reference-1234567890', options)
eq(
  unknown.value,
  'missing-reference-1234567890',
  'unknown raw id is retained as value'
)
eq(
  unknown.meta,
  'missing-reference-1234567890',
  'unknown raw id is retained as meta'
)
eq(unknown.resolved, false, 'resolved marker is false for unknown option')

eq(
  formatReferenceList(['asset-b', 'asset-a'], options)
    .map((item) => item.value)
    .join(','),
  'asset-b,asset-a',
  'formatReferenceList keeps input order'
)

const summary = summarizeReferenceList(
  ['asset-a', 'asset-b', 'asset-a'],
  options,
  2
)
eq(summary.visible.length, 2, 'summarizeReferenceList maxVisible is respected')
eq(summary.hiddenCount, 1, 'hiddenCount is correct')
eq(
  summary.visible.map((item) => item.value).join(','),
  'asset-a,asset-b',
  'visible references preserve order'
)
eq(
  summarizeReferenceList([], options, 2).visible.length,
  0,
  'empty values returns empty visible'
)
eq(
  formatReferenceList(['asset-a', 'asset-a'], options).length,
  2,
  'duplicate display entries are preserved'
)

const assetLines = summarizePatch(
  {
    id: 'p-assets',
    pid: 'CARD-1',
    schema: 'CardBody',
    targetId: 'record-1',
    parentId: null,
    assets: ['asset-a'],
  },
  { language: 'en-US', copy, assetOptions: options }
)
eq(
  assetLines[0]?.value,
  'ASSET-1 - Battle scene',
  'asset history summary displays asset label'
)

const unknownAssetLines = summarizePatch(
  {
    id: 'p-assets-unknown',
    pid: 'CARD-1',
    schema: 'CardBody',
    targetId: 'record-1',
    parentId: null,
    assets: ['unknown-asset-reference-1234567890'],
  },
  { language: 'en-US', copy, assetOptions: options }
)
eq(
  unknownAssetLines[0]?.value,
  'unknown-...7890',
  'asset history summary unknown fallback short id'
)

console.log(
  `\n${failures === 0 ? 'referenceDisplay devcheck passed' : `${failures} failures`}`
)
if (failures > 0) throw new Error(`${failures} assertions failed`)
