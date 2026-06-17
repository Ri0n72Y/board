/**
 * Run with:
 * pnpm --filter @labour-board/api exec tsx ../board-web/src/utils/relationDisplay.devcheck.ts
 */

import type {
  BoardConfig,
  RecordBody,
  RecordItem,
  RecordResponse,
} from '@labour-board/shared'
import {
  buildRelationConstraintOptions,
  dedupeRelations,
  formatRelationConstraint,
  formatRelationLine,
  formatRelationTarget,
  hasSelfRelation,
  normalizeRelationDrafts,
  sameRelations,
} from './relationDisplay'
import type { RecordReferenceOption } from './recordReferenceOptions'

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

const t = (key: string, options?: { defaultValue?: string }) =>
  ({
    'relations.constraint.dependsOn': 'Depends on',
    'relations.constraint.blocks': 'Blocks',
    'relations.constraint.blockedBy': 'Blocked by',
  })[key] ?? options?.defaultValue ?? key

function record(
  id: string,
  pid: string,
  title: string,
  relations: RecordItem<RecordBody>['relations'] = [],
): RecordResponse<RecordItem<RecordBody>> {
  return {
    createdBy: 'member',
    createdAt: '2026-06-17T00:00:00.000Z',
    body: {
      id,
      pid,
      schema: 'CardBody',
      tags: [],
      body: { title },
      relations,
    },
  }
}

const config = {
  relations: { constraints: ['blocks', 'customConfigRelation'] },
} as BoardConfig

const records = [
  record('record-a', 'CARD-1', 'Alpha', [
    { constraint: 'customObservedRelation', target: 'record-b' },
  ]),
  record('record-b', 'CARD-2', 'Beta'),
]

const targetOptions: RecordReferenceOption[] = [
  {
    value: 'record-b',
    label: 'CARD-2 - Beta',
    meta: 'record-b',
    referenceState: 'resolved',
  },
]

eq(formatRelationConstraint('dependsOn', t), 'Depends on', 'known constraint i18n')
eq(
  formatRelationConstraint('unknownConstraint', t),
  'unknownConstraint',
  'unknown constraint fallback raw',
)
eq(
  formatRelationTarget('record-b', targetOptions),
  'CARD-2 - Beta',
  'target id resolves to PID + title',
)
eq(
  formatRelationTarget('1234567890abcdef', targetOptions),
  '12345678...cdef',
  'unknown target fallback short id',
)
eq(
  dedupeRelations([
    { constraint: 'dependsOn', target: 'record-b', description: 'same' },
    { constraint: 'dependsOn', target: 'record-b', description: 'same' },
  ]).length,
  1,
  'duplicate relation dedupe',
)
eq(
  normalizeRelationDrafts([
    { constraint: '', target: 'record-b' },
    { constraint: 'dependsOn', target: '' },
    { constraint: 'dependsOn', target: 'record-b' },
  ]).length,
  1,
  'empty relation row removed',
)
eq(
  normalizeRelationDrafts([
    { constraint: 'dependsOn', target: 'record-b', description: '  note  ' },
  ])[0]?.description,
  'note',
  'description trim',
)
assert(
  sameRelations(
    [{ constraint: 'dependsOn', target: 'record-b', description: ' note ' }],
    [{ constraint: 'dependsOn', target: 'record-b', description: 'note' }],
  ),
  'sameRelations detects no change',
)
assert(
  !sameRelations([], [{ constraint: 'dependsOn', target: 'record-b' }]),
  'sameRelations detects added relation',
)
assert(
  !sameRelations([{ constraint: 'dependsOn', target: 'record-b' }], []),
  'sameRelations detects removed relation',
)
assert(
  !sameRelations(
    [{ constraint: 'dependsOn', target: 'record-b', description: 'old' }],
    [{ constraint: 'dependsOn', target: 'record-b', description: 'new' }],
  ),
  'sameRelations detects changed description',
)
assert(
  hasSelfRelation([{ constraint: 'dependsOn', target: 'record-a' }], 'record-a'),
  'self relation warning detection',
)
eq(
  formatRelationLine({ constraint: 'dependsOn', target: 'record-b' }, targetOptions, t),
  'Depends on CARD-2 - Beta',
  'history relation summary displays constraint label + PID title',
)
assert(
  buildRelationConstraintOptions(records, t, config).some(
    (option) => option.value === 'customConfigRelation',
  ),
  'constraint options include configured constraints',
)
assert(
  buildRelationConstraintOptions(records, t, config).some(
    (option) => option.value === 'customObservedRelation',
  ),
  'constraint options include observed constraints',
)

console.log(`\n${failures === 0 ? 'relationDisplay devcheck passed' : `${failures} failures`}`)
if (failures > 0) throw new Error(`${failures} assertions failed`)
