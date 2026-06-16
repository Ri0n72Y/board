/**
 * Run with:
 * pnpm --filter @labour-board/api exec tsx ../board-web/src/utils/searchSelect.devcheck.ts
 */

import {
  addSearchSelectValue,
  canSelectSearchSelectChoice,
  filterSearchSelectOptions,
  removeSearchSelectValue,
  type SearchSelectOption,
} from './searchSelect'

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

function values(options: SearchSelectOption[]) {
  return options.map((option) => option.value)
}

const options: SearchSelectOption[] = [
  {
    value: 'rec-1',
    label: 'Combat card',
    description: 'Build the loop',
    meta: 'CardBody todo',
  },
  {
    value: 'rec-2',
    label: 'Map flow',
    description: 'Connect rooms',
    meta: 'AssetBody sprint:1',
  },
  {
    value: 'rec-disabled',
    label: 'Disabled',
    disabled: true,
  },
]

eq(
  filterSearchSelectOptions({ mode: 'option', query: 'combat', options })[0]?.value,
  'rec-1',
  'option search matches label',
)
eq(
  filterSearchSelectOptions({ mode: 'option', query: 'rec-2', options })[0]?.value,
  'rec-2',
  'option search matches value',
)
eq(
  filterSearchSelectOptions({ mode: 'option', query: 'rooms', options })[0]?.value,
  'rec-2',
  'option search matches description',
)
eq(
  filterSearchSelectOptions({ mode: 'option', query: 'CardBody', options })[0]?.value,
  'rec-1',
  'option search matches meta',
)

const tagOptions: SearchSelectOption[] = [
  { value: 'epic:1', label: 'epic:1' },
  { value: 'sprint:1', label: 'sprint:1' },
]

eq(
  filterSearchSelectOptions({
    mode: 'tag',
    query: 'epic:1',
    options: tagOptions,
    language: 'en-US',
  })[0]?.value,
  'epic:1',
  'tag search matches raw tag',
)
eq(
  filterSearchSelectOptions({
    mode: 'tag',
    query: 'Sprint 1',
    options: tagOptions,
    language: 'en-US',
  })[0]?.value,
  'sprint:1',
  'tag search matches localized label',
)

const added = addSearchSelectValue(['rec-1'], 'rec-2')
eq(added.join(','), 'rec-1,rec-2', 'multi select add appends in selected order')
eq(addSearchSelectValue(added, 'rec-2').join(','), 'rec-1,rec-2', 'multi select add dedupes')
eq(removeSearchSelectValue(added, 'rec-1').join(','), 'rec-2', 'multi select remove')

const customAllowed = filterSearchSelectOptions({
  mode: 'option',
  query: 'new-public-key',
  options,
  allowCustomValue: true,
})
eq(customAllowed[0]?.value, 'new-public-key', 'allowCustomValue=true generates custom option')
eq(Boolean(customAllowed[0]?.custom), true, 'generated custom option is marked custom')

const customBlocked = filterSearchSelectOptions({
  mode: 'option',
  query: 'new-public-key',
  options,
  allowCustomValue: false,
})
eq(customBlocked.length, 0, 'allowCustomValue=false does not generate custom option')

eq(
  values(filterSearchSelectOptions({ mode: 'option', query: '', options })).join(','),
  'rec-1,rec-2,rec-disabled',
  'empty query returns all options in input order',
)
eq(
  canSelectSearchSelectChoice(options[2]),
  false,
  'disabled options are not selectable',
)

console.log(`\n${failures === 0 ? 'searchSelect devcheck passed' : `${failures} failures`}`)
if (failures > 0) throw new Error(`${failures} assertions failed`)
