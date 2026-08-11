/**
 * Dev-time assertions for columnDensity.
 * Run with: npx tsx src/utils/columnDensity.devcheck.ts
 */

import type {
  RecordBody,
  RecordItem,
  RecordResponse,
} from '@labour-board/shared'
import { buildColumnDensity, priorityLevel } from './columnDensity'

let failures = 0

function assert(expr: boolean, msg: string) {
  if (!expr) {
    console.error(`FAIL: ${msg}`)
    failures++
  } else {
    console.log(`  OK: ${msg}`)
  }
}

function record(
  id: string,
  tags: string[],
  assignee?: string | null
): RecordResponse<RecordItem<RecordBody>> {
  return {
    createdBy: 'creator',
    createdAt: '2026-08-11T00:00:00.000Z',
    body: {
      id,
      pid: id,
      schema: 'card',
      tags,
      assignee,
      body: { title: `record-${id}` },
    },
  }
}

console.log('columnDensity devcheck')

// priorityLevel
assert(
  priorityLevel(record('r1', ['priority:p0'])) === 'p0',
  'priority:p0 -> p0'
)
assert(
  priorityLevel(record('r2', ['priority:P1'])) === 'p1',
  'priority:P1 (uppercase) -> p1'
)
assert(
  priorityLevel(record('r3', ['status:todo'])) === null,
  'non-priority tag -> null'
)
assert(
  priorityLevel(record('r4', ['priority:p9'])) === null,
  'unknown priority level -> null'
)
assert(
  priorityLevel(record('r5', ['priority:'])) === null,
  'empty priority -> null'
)
assert(
  priorityLevel(record('r6', [])) === null,
  'no tags -> null'
)

// buildColumnDensity
const density = buildColumnDensity([
  record('a', ['priority:p0'], 'pkA'),
  record('b', ['priority:p1'], 'pkB'),
  record('c', ['priority:p1'], 'pkA'),
  record('d', ['status:todo'], null),
])
assert(
  density.priorityCounts.get('p0') === 1 &&
    density.priorityCounts.get('p1') === 2,
  'priority counts (p0=1, p1=2)'
)
assert(
  density.priorityCounts.get('p2') === undefined,
  'absent priority level is undefined'
)
assert(
  density.assignees.join(',') === 'pkA,pkB',
  'assignees sorted by frequency (pkA=2 first)'
)
assert(density.totalAssignees === 2, 'total assignees = 2')
assert(
  buildColumnDensity([]).totalAssignees === 0 &&
    buildColumnDensity([]).assignees.length === 0,
  'empty records -> empty density'
)

if (failures > 0) {
  console.error(`columnDensity devcheck: ${failures} failure(s)`)
  process.exit(1)
}
console.log('columnDensity devcheck: all passed')
