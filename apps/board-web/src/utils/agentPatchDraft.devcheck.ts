/**
 * agentPatchDraft.devcheck – Dev-time verification for agent patch draft utilities.
 *
 * Run with:
 *   pnpm --filter @labour-board/api exec tsx ../board-web/src/utils/agentPatchDraft.devcheck.ts
 */
import {
  buildPatchDraftDescription,
  buildPatchDraftSummaryLine,
  canCreatePatchDraft,
  extractPidCandidates,
  patchDraftHasContentChanges,
} from './agentPatchDraft'
import type { AgentSuggestionDetail } from '@labour-board/shared'

let passed = 0
let failed = 0

function assert(condition: boolean, label: string) {
  if (condition) {
    console.log(`  ✓ ${label}`)
    passed++
  } else {
    console.error(`  ✗ ${label}`)
    failed++
  }
}

function assertEq<T>(actual: T, expected: T, label: string) {
  assert(JSON.stringify(actual) === JSON.stringify(expected), `${label} → ${JSON.stringify(actual)}`)
}

// ─── buildPatchDraftDescription ───
console.log('\nbuildPatchDraftDescription')
assert(
  buildPatchDraftDescription('8f045dd0-something', 'DeepSeek test suggestion').startsWith(
    'Human patch drafted from AI suggestion 8f045dd0',
  ),
  'starts with correct prefix',
)
assert(
  buildPatchDraftDescription('8f045dd0-something', 'DeepSeek test suggestion').includes(
    'DeepSeek test suggestion',
  ),
  'includes suggestion title',
)
assert(
  buildPatchDraftDescription('8f045dd0-something', 'DeepSeek test suggestion').includes(
    'Reviewed and submitted manually',
  ),
  'includes manual submission marker',
)
assert(
  buildPatchDraftDescription('abc', '  ').includes('Untitled AI suggestion'),
  'falls back to untitled for whitespace title',
)
// Must NOT contain full markdown, prompt, raw response
const desc = buildPatchDraftDescription('test-id', 'Test')
assert(!desc.includes('```json'), 'does not contain markdown fence')

// ─── buildPatchDraftSummaryLine ───
console.log('\nbuildPatchDraftSummaryLine')
assertEq(
  buildPatchDraftSummaryLine('abcdef123456', 'Test suggestion'),
  'AI suggestion abcdef12: Test suggestion',
  'constructs summary line',
)

// ─── extractPidCandidates ───
console.log('\nextractPidCandidates')
assertEq(extractPidCandidates(''), [], 'empty string → empty')
assertEq(extractPidCandidates('CARD-5 needs work'), ['CARD-5'], 'extracts CARD-5')
assertEq(
  extractPidCandidates('See TASK/42 and TASK/43'),
  ['TASK/42', 'TASK/43'],
  'extracts multiple TASK/ pids',
)
assertEq(
  extractPidCandidates('SYS/001 is the system record, CARD-5 is the card'),
  ['SYS/001', 'CARD-5'],
  'extracts mixed pid formats',
)
assertEq(
  extractPidCandidates('CARD-5 CARD-5 again'),
  ['CARD-5'],
  'deduplicates repeated pids',
)
assertEq(
  extractPidCandidates('no pids here just text'),
  [],
  'no pids → empty',
)
assertEq(
  extractPidCandidates('ASSET-abc-def and ASSET/xyz'),
  ['ASSET-abc-def', 'ASSET/xyz'],
  'extracts ASSET- and ASSET/ patterns',
)

// ─── canCreatePatchDraft ───
console.log('\ncanCreatePatchDraft')
assert(!canCreatePatchDraft(null), 'null → false')
assert(
  canCreatePatchDraft({
    id: 'id',
    draftId: 'draft',
    title: 'Test',
    markdown: 'some markdown',
  } as unknown as AgentSuggestionDetail),
  'with title+markdown → true',
)
assert(
  canCreatePatchDraft({
    id: 'id',
    draftId: 'draft',
    title: '',
    markdown: 'some markdown',
  } as unknown as AgentSuggestionDetail),
  'no title but has markdown → true',
)
assert(
  !canCreatePatchDraft({
    id: 'id',
    draftId: 'draft',
    title: '',
    markdown: '',
  } as unknown as AgentSuggestionDetail),
  'empty title and markdown → false',
)

// ─── patchDraftHasContentChanges ───
console.log('\npatchDraftHasContentChanges')
assert(
  !patchDraftHasContentChanges({}),
  'empty payload → false',
)
assert(
  patchDraftHasContentChanges({ body: { title: 'new' } }),
  'body present → true',
)
assert(
  patchDraftHasContentChanges({ tagChanges: { add: [], remove: [] } }),
  'tagChanges present → true',
)
assert(
  patchDraftHasContentChanges({ assignee: 'pk1' }),
  'assignee present → true',
)
assert(
  patchDraftHasContentChanges({ assets: ['a'] }),
  'assets present → true',
)
assert(
  patchDraftHasContentChanges({ relations: [] }),
  'relations present → true',
)
assert(
  !patchDraftHasContentChanges({ assignee: undefined }),
  'assignee undefined → false',
)

// ─── Summary ───
console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
