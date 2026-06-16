/**
 * Run with:
 * pnpm --filter @labour-board/api exec tsx ../board-web/src/utils/recordReferenceOptions.devcheck.ts
 */

import type {
  RecordBody,
  RecordItem,
  RecordResponse,
} from '@labour-board/shared'
import {
  buildAssetReferenceOptions,
  buildRecordReferenceOptions,
  buildRelationTargetOptions,
  ensureReferenceOptions,
  getReferenceDisplayLabel,
  mergeReferenceOptions,
} from './recordReferenceOptions'

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

function record(
  id: string,
  pid: string,
  schema: string,
  body: Record<string, unknown>,
  extras: Partial<RecordItem<RecordBody>> = {},
): RecordResponse<RecordItem<RecordBody>> {
  return {
    createdBy: 'member',
    createdAt: '2026-06-16T00:00:00.000Z',
    body: {
      id,
      pid,
      schema,
      tags: [],
      body,
      ...extras,
    },
  }
}

const assetRecord = record('asset-alpha-id', 'ASSET-1', 'AssetBody', {
  title: 'Battle scene',
})
const cardWithRefs = record('card-alpha-id', 'CARD-1', 'CardBody', {
  title: 'Enter battle',
}, {
  assets: ['asset-alpha-id', 'asset-zeta-missing', 'asset-alpha-id'],
  relations: [
    { constraint: 'blocks', target: 'card-beta-id' },
    { constraint: 'mentions', target: 'record-missing-target' },
    { constraint: 'duplicates', target: 'card-beta-id' },
  ],
})
const cardWithoutTitle = record('card-beta-id', 'CARD-2', 'CardBody', {})
const cardWithoutPid = record(
  'record-without-pid-1234567890',
  '',
  'CardBody',
  { title: 'Hidden title' },
)

const records = [cardWithRefs, assetRecord, cardWithoutTitle, cardWithoutPid]

const recordOptions = buildRecordReferenceOptions(records)
eq(
  recordOptions.find((option) => option.value === 'card-alpha-id')?.label,
  'CARD-1 - Enter battle',
  'record option label uses PID + title',
)
eq(
  recordOptions.find((option) => option.value === 'card-beta-id')?.label,
  'CARD-2',
  'record missing title falls back to PID',
)
eq(
  recordOptions.find((option) => option.value === 'record-without-pid-1234567890')?.label,
  'Hidden title',
  'record missing PID keeps title when title exists',
)

const pidlessNoTitle = record('pidless-and-titleless-1234567890', '', 'CardBody', {})
eq(
  buildRecordReferenceOptions([pidlessNoTitle])[0]?.label,
  'pidless-...7890',
  'record missing PID and title falls back to short id',
)

const assetOptions = buildAssetReferenceOptions(records)
eq(
  assetOptions.find((option) => option.value === 'asset-alpha-id')?.label,
  'ASSET-1 - Battle scene',
  'asset options include AssetBody records',
)
eq(
  assetOptions.some((option) => option.value === 'asset-zeta-missing'),
  true,
  'asset options include observed asset refs',
)
eq(
  assetOptions.find((option) => option.value === 'asset-alpha-id')?.label,
  'ASSET-1 - Battle scene',
  'observed asset ref resolves to PID + title when record exists',
)
eq(
  assetOptions.find((option) => option.value === 'asset-zeta-missing')?.description,
  'Unknown asset',
  'observed unknown asset ref gets unknown fallback',
)
eq(
  assetOptions.filter((option) => option.value === 'asset-alpha-id').length,
  1,
  'asset options dedupe same id',
)
eq(
  assetOptions.map((option) => option.value).join(','),
  'asset-alpha-id,asset-zeta-missing',
  'asset option sorting is stable with resolved first then unknown raw id',
)

const relationOptions = buildRelationTargetOptions(records)
eq(
  relationOptions.some((option) => option.value === 'card-alpha-id'),
  true,
  'relation target options include current records',
)
eq(
  relationOptions.some((option) => option.value === 'record-missing-target'),
  true,
  'relation target options include observed relation targets',
)
eq(
  relationOptions.find((option) => option.value === 'record-missing-target')?.description,
  'Unknown record',
  'unknown relation target gets fallback',
)
eq(
  relationOptions.filter((option) => option.value === 'card-beta-id').length,
  1,
  'relation target options dedupe same id',
)
eq(
  assetOptions.find((option) => option.value === 'asset-alpha-id')?.value,
  'asset-alpha-id',
  'raw id value is not replaced by label',
)
eq(
  ensureReferenceOptions(assetOptions, ['legacy-asset-id'], 'asset').find(
    (option) => option.value === 'legacy-asset-id',
  )?.description,
  'Unknown asset',
  'selected unknown asset fallback option can be preserved',
)
eq(
  getReferenceDisplayLabel(assetOptions, 'asset-alpha-id'),
  'ASSET-1 - Battle scene',
  'active summary label resolves raw id to PID + title',
)
eq(
  mergeReferenceOptions(
    relationOptions,
    [{ value: 'card-beta-id', label: 'card-bet...a-id', description: 'Unknown record', meta: 'card-beta-id' }],
  ).find((option) => option.value === 'card-beta-id')?.label,
  'CARD-2',
  'resolved option is not replaced by later unknown fallback',
)

console.log(`\n${failures === 0 ? 'recordReferenceOptions devcheck passed' : `${failures} failures`}`)
if (failures > 0) throw new Error(`${failures} assertions failed`)
