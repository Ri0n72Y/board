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
  assert(
    Object.is(actual, expected),
    `${label} expected "${expected}" got "${actual}"`
  )
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

const customCandidates: SearchSelectOption[] = [
  {
    value: 'member-programmer',
    label: 'Programmer',
    description: 'Gameplay owner',
    meta: 'public-key-programmer',
  },
  {
    value: 'member-designer',
    label: 'Designer',
    description: 'Card design',
    meta: 'public-key-designer',
  },
]

eq(
  filterSearchSelectOptions({ mode: 'option', query: 'combat', options })[0]
    ?.value,
  'rec-1',
  'option search matches label'
)
eq(
  filterSearchSelectOptions({ mode: 'option', query: 'rec-2', options })[0]
    ?.value,
  'rec-2',
  'option search matches value'
)
eq(
  filterSearchSelectOptions({ mode: 'option', query: 'rooms', options })[0]
    ?.value,
  'rec-2',
  'option search matches description'
)
eq(
  filterSearchSelectOptions({ mode: 'option', query: 'CardBody', options })[0]
    ?.value,
  'rec-1',
  'option search matches meta'
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
  'tag search matches raw tag'
)
eq(
  filterSearchSelectOptions({
    mode: 'tag',
    query: 'Sprint 1',
    options: tagOptions,
    language: 'en-US',
  })[0]?.value,
  'sprint:1',
  'tag search matches localized label'
)

const added = addSearchSelectValue(['rec-1'], 'rec-2')
eq(added.join(','), 'rec-1,rec-2', 'multi select add appends in selected order')
eq(
  addSearchSelectValue(added, 'rec-2').join(','),
  'rec-1,rec-2',
  'multi select add dedupes'
)
eq(
  removeSearchSelectValue(added, 'rec-1').join(','),
  'rec-2',
  'multi select remove'
)

const customAllowed = filterSearchSelectOptions({
  mode: 'option',
  query: 'new-public-key',
  options,
  allowCustomValue: true,
})
eq(
  customAllowed[0]?.value,
  'new-public-key',
  'allowCustomValue=true generates custom option'
)
eq(
  Boolean(customAllowed[0]?.custom),
  true,
  'generated custom option is marked custom'
)

const labelMatchWithCustom = filterSearchSelectOptions({
  mode: 'option',
  query: 'Programmer',
  options: customCandidates,
  allowCustomValue: true,
})
eq(
  labelMatchWithCustom[0]?.value,
  'member-programmer',
  'query matches label with allowCustomValue keeps matched option first'
)
eq(
  Boolean(labelMatchWithCustom[0]?.custom),
  false,
  'query matches label with allowCustomValue does not prioritize custom option'
)

const metaMatchWithCustom = filterSearchSelectOptions({
  mode: 'option',
  query: 'public-key-designer',
  options: customCandidates,
  allowCustomValue: true,
})
eq(
  metaMatchWithCustom[0]?.value,
  'member-designer',
  'query matches meta with allowCustomValue keeps matched option first'
)

const descriptionMatchWithCustom = filterSearchSelectOptions({
  mode: 'option',
  query: 'Gameplay',
  options: customCandidates,
  allowCustomValue: true,
})
eq(
  descriptionMatchWithCustom[0]?.value,
  'member-programmer',
  'query matches description with allowCustomValue keeps matched option first'
)

const noMatchWithCustom = filterSearchSelectOptions({
  mode: 'option',
  query: 'custom-member-key',
  options: customCandidates,
  allowCustomValue: true,
})
eq(
  noMatchWithCustom[0]?.value,
  'custom-member-key',
  'no matches puts custom option first'
)
eq(
  Boolean(noMatchWithCustom[0]?.custom),
  true,
  'no matches custom option is marked custom'
)

const exactValueWithCustom = filterSearchSelectOptions({
  mode: 'option',
  query: 'member-programmer',
  options: customCandidates,
  allowCustomValue: true,
})
eq(
  exactValueWithCustom.some((option) => option.custom === true),
  false,
  'exact value does not generate custom option'
)

const exactLabelWithCustom = filterSearchSelectOptions({
  mode: 'option',
  query: 'Programmer',
  options: customCandidates,
  allowCustomValue: true,
})
eq(
  exactLabelWithCustom.some((option) => option.custom === true),
  false,
  'exact label does not generate custom option'
)

const customBlocked = filterSearchSelectOptions({
  mode: 'option',
  query: 'new-public-key',
  options,
  allowCustomValue: false,
})
eq(
  customBlocked.length,
  0,
  'allowCustomValue=false does not generate custom option'
)

eq(
  values(
    filterSearchSelectOptions({ mode: 'option', query: '', options })
  ).join(','),
  'rec-1,rec-2,rec-disabled',
  'empty query returns all options in input order'
)
eq(
  canSelectSearchSelectChoice(options[2]),
  false,
  'disabled options are not selectable'
)

console.log(
  `\n${failures === 0 ? 'searchSelect devcheck passed' : `${failures} failures`}`
)
if (failures > 0) throw new Error(`${failures} assertions failed`)
