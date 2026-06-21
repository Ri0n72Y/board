/**
 * profileDisplay.devcheck.ts
 * Quick deterministic checks for profile display utilities.
 * Run with: pnpm --filter @labour-board/api exec tsx ../board-web/src/utils/profileDisplay.devcheck.ts
 */
import {
  profileInitials,
  shortPublicKey,
  avatarColor,
  profileToOption,
  formatAssigneeDisplay,
  profileOptionLabel,
  buildProfileOptions,
} from './profileDisplay'

let failures = 0
let passed = 0

function check(description: string, actual: unknown, expected: unknown) {
  const actualStr = JSON.stringify(actual)
  const expectedStr = JSON.stringify(expected)
  if (actualStr === expectedStr) {
    passed++
    console.log(`  ✓ ${description}`)
  } else {
    failures++
    console.error(`  ✗ ${description}`)
    console.error(`    expected: ${expectedStr}`)
    console.error(`    actual:   ${actualStr}`)
  }
}

console.log('\nprofileInitials')
check('two words', profileInitials('Ada Lovelace', null), 'AL')
check('one word', profileInitials('Marx', null), 'M')
check('trimmed lowercase', profileInitials('  li dazhao  ', null), 'LD')
check('fallback from pk', profileInitials('', 'abc123'), 'AB')
check('fallback from pk null name', profileInitials(null, 'xyz789'), 'XY')
check('no name no pk', profileInitials(null, null), '??')
check('single char pk fallback', profileInitials('', 'x'), 'X')

console.log('\nshortPublicKey')
check('long key', shortPublicKey('abcdef1234567890'), 'abcdef...7890')
check('short key', shortPublicKey('abc'), 'abc')
check('null key', shortPublicKey(null), '')
check('empty key', shortPublicKey(''), '')

console.log('\navatarColor')
const color1 = avatarColor('pk-abc')
const color2 = avatarColor('pk-abc')
const color3 = avatarColor('pk-xyz')
check('same pk same color', color1, color2)
check('different pk different color (likely)', color1 !== color3, true)
check('empty pk produces valid color', avatarColor(null).startsWith('hsl('), true)

console.log('\nprofileToOption')
const profile = { pk: 'pk-alice', name: 'Alice Example', avatarUrl: null }
const option = profileToOption(profile)
check('profile option label', option.label, 'Alice Example')
check('profile option value', option.value, 'pk-alice')
check('profile option has description', typeof option.description, 'string')
check('profile option has meta', option.meta, 'pk-alice')

console.log('\nformatAssigneeDisplay')
check('known profile', formatAssigneeDisplay('pk-alice', profile, 'Unassigned', 'Unknown member'), 'Alice Example (pk-alice)')
check('unknown pk', formatAssigneeDisplay('pk-unknown', null, 'Unassigned', 'Unknown member'), 'Unknown member (pk-unknown)')
check('empty pk', formatAssigneeDisplay('', profile, 'Unassigned', 'Unknown member'), 'Unassigned')
check('null pk', formatAssigneeDisplay(null, profile, 'Unassigned', 'Unknown member'), 'Unassigned')

console.log('\nprofileOptionLabel')
check('found profile', profileOptionLabel('pk-alice', [profile]), 'Alice Example')
check('unknown pk', profileOptionLabel('pk-bob', [profile]), 'Unknown member')

console.log('\nbuildProfileOptions')
const options = buildProfileOptions([profile])
check('one option built', options.length, 1)
check('null profiles', buildProfileOptions(null), [])

console.log(`\n${passed} passed, ${failures} failed${failures > 0 ? ' ❌' : ' ✓'}`)
process.exit(failures > 0 ? 1 : 0)
