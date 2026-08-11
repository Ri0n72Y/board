/**
 * Dev-time assertions for listViewPreference.
 * Run with: npx tsx src/utils/listViewPreference.devcheck.ts
 */

import {
  moveListViewColumn,
  moveListViewColumnByOffset,
  readListViewColumnOrder,
  resolveListViewColumnOrder,
  writeListViewColumnOrder,
} from './listViewPreference'

let failures = 0

function assert(expr: boolean, msg: string) {
  if (!expr) {
    console.error(`FAIL: ${msg}`)
    failures++
  } else {
    console.log(`  OK: ${msg}`)
  }
}

function eq(actual: string[], expected: string[], label: string) {
  assert(
    actual.join(',') === expected.join(','),
    `${label} expected [${expected}] got [${actual}]`
  )
}

console.log('listViewPreference devcheck')

// resolveListViewColumnOrder
eq(
  resolveListViewColumnOrder(['a', 'b', 'c'], null),
  ['a', 'b', 'c'],
  'no persisted order -> known order'
)
eq(
  resolveListViewColumnOrder(['a', 'b', 'c'], ['c', 'a', 'b']),
  ['c', 'a', 'b'],
  'persisted order applied'
)
eq(
  resolveListViewColumnOrder(['a', 'b', 'c'], ['c', 'unknown', 'a']),
  ['c', 'a', 'b'],
  'unknown persisted id dropped, missing appended'
)
eq(
  resolveListViewColumnOrder(['a', 'b', 'c'], ['b']),
  ['b', 'a', 'c'],
  'partial persisted order -> missing appended'
)

// moveListViewColumn
eq(
  moveListViewColumn(['a', 'b', 'c'], 'a', 'c'),
  ['b', 'c', 'a'],
  'move a after c'
)
eq(
  moveListViewColumn(['a', 'b', 'c'], 'c', 'a'),
  ['c', 'a', 'b'],
  'move c before a'
)
eq(
  moveListViewColumn(['a', 'b', 'c'], 'a', 'a'),
  ['a', 'b', 'c'],
  'same source/target no-op'
)
eq(
  moveListViewColumn(['a', 'b', 'c'], 'x', 'b'),
  ['a', 'b', 'c'],
  'unknown source no-op'
)

// moveListViewColumnByOffset
eq(
  moveListViewColumnByOffset(['a', 'b', 'c'], 'a', 1),
  ['b', 'a', 'c'],
  'move a right by 1'
)
eq(
  moveListViewColumnByOffset(['a', 'b', 'c'], 'c', -2),
  ['c', 'a', 'b'],
  'move c left by 2'
)
eq(
  moveListViewColumnByOffset(['a', 'b', 'c'], 'a', -5),
  ['a', 'b', 'c'],
  'move a left beyond bounds clamps'
)
eq(
  moveListViewColumnByOffset(['a', 'b', 'c'], 'c', 5),
  ['a', 'b', 'c'],
  'move c right beyond bounds clamps'
)
eq(
  moveListViewColumnByOffset(['a', 'b', 'c'], 'x', 1),
  ['a', 'b', 'c'],
  'unknown id no-op'
)

// resolve dedupe
eq(
  resolveListViewColumnOrder(['a', 'b', 'c'], ['b', 'a', 'b', 'c', 'a']),
  ['b', 'a', 'c'],
  'duplicate persisted ids deduped'
)

// persistence boundaries with injected storage mock
{
  const store = new Map<string, string>()
  const storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value)
    },
  }

  writeListViewColumnOrder(['c', 'a', 'b'], storage)
  const written = readListViewColumnOrder(storage)
  assert(
    written?.join(',') === 'c,a,b',
    `write+read roundtrip, got [${written?.join(',')}]`
  )

  store.set('board:listViewPreference', 'not-json{{{')
  assert(
    readListViewColumnOrder(storage) === null,
    'corrupted JSON -> null'
  )

  store.set('board:listViewPreference', '{"columnOrder": "not-array"}')
  assert(
    readListViewColumnOrder(storage) === null,
    'non-array columnOrder -> null'
  )

  store.set('board:listViewPreference', '{"columnOrder": ["a", 42, null]}')
  assert(
    readListViewColumnOrder(storage)?.join(',') === 'a',
    'non-string ids filtered, got ['
      .concat(readListViewColumnOrder(storage)?.join(',') ?? '')
      .concat(']')
  )

  store.set('board:listViewPreference', '{}')
  assert(
    readListViewColumnOrder(storage) === null,
    'empty preference object -> null'
  )
}

if (failures > 0) {
  console.error(`listViewPreference devcheck: ${failures} failure(s)`)
  process.exit(1)
}
console.log('listViewPreference devcheck: all passed')
