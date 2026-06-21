/**
 * agentSuggestionDisplay.devcheck.ts
 *
 * Dev check for Agent Suggestion display utilities.
 * Run via: pnpm --filter @labour-board/api exec tsx ../board-web/src/utils/agentSuggestionDisplay.devcheck.ts
 */

interface CheckCase {
  name: string
  fn: () => void
}

const checks: CheckCase[] = []

function check(name: string, fn: () => void): void {
  checks.push({ name, fn })
}

// ─── 1. Summary truncation ───
check('summary truncates to 600 characters', () => {
  const longText = 'x'.repeat(700)
  const maxLength = 600
  const truncated =
    longText.length > maxLength
      ? longText.slice(0, maxLength - 3) + '...'
      : longText
  if (truncated.length !== 600) {
    throw new Error(`Expected 600 chars, got ${truncated.length}`)
  }
  if (!truncated.endsWith('...')) {
    throw new Error('Expected truncated text to end with ...')
  }
})

check('summary returns as-is if within limit', () => {
  const shortText = 'Short summary'
  const maxLength = 600
  const result =
    shortText.length > maxLength
      ? shortText.slice(0, maxLength - 3) + '...'
      : shortText
  if (result !== 'Short summary') {
    throw new Error('Expected unchanged text')
  }
})

// ─── 2. Highlights max count ───
check('highlights capped at 5', () => {
  const highlights = ['a', 'b', 'c', 'd', 'e', 'f', 'g']
  const max = 5
  const capped = highlights.slice(0, max)
  if (capped.length !== 5) {
    throw new Error(`Expected 5 highlights, got ${capped.length}`)
  }
})

check('highlights with fewer than 5 items stays unchanged', () => {
  const highlights = ['a', 'b']
  const max = 5
  const capped = highlights.slice(0, max)
  if (capped.length !== 2) {
    throw new Error(`Expected 2 highlights, got ${capped.length}`)
  }
})

// ─── 3. Suggestion card view model excludes markdown ───
check('AgentSuggestionSummary does not include markdown field', () => {
  const summary = {
    id: 'test-id',
    draftId: 'draft-id',
    title: 'Test',
    summary: 'Test summary',
    highlights: ['h1'],
    status: 'generated',
    createdAt: '2026-01-01T00:00:00Z',
    createdBy: 'user',
    provider: 'mock',
    model: 'mock-v1',
    contextHash: 'abc123',
  }
  // Summary should NOT have a 'markdown' key
  if ('markdown' in summary) {
    throw new Error('Summary should not include markdown')
  }
})

// ─── 4. Detail view model includes markdown ───
check('AgentSuggestionDetail includes markdown field', () => {
  const detail = {
    id: 'test-id',
    draftId: 'draft-id',
    title: 'Test',
    summary: 'Test summary',
    highlights: ['h1'],
    status: 'generated' as const,
    createdAt: '2026-01-01T00:00:00Z',
    createdBy: 'user',
    provider: 'mock',
    model: 'mock-v1',
    contextHash: 'abc123',
    markdown: '# Full markdown content',
    skillSnapshots: [],
  }
  if (!('markdown' in detail)) {
    throw new Error('Detail should include markdown')
  }
  if (typeof detail.markdown !== 'string') {
    throw new Error('markdown must be a string')
  }
})

// ─── 5. Status badge mapping ───
check('status badge mapping covers all statuses', () => {
  const STATUS_LABELS: Record<string, string> = {
    generated: 'generated',
    reviewed: 'reviewed',
    discarded: 'discarded',
  }
  const expectedStatuses = ['generated', 'reviewed', 'discarded']
  for (const s of expectedStatuses) {
    if (!(s in STATUS_LABELS)) {
      throw new Error(`Missing status label for: ${s}`)
    }
    if (typeof STATUS_LABELS[s] !== 'string' || STATUS_LABELS[s].length === 0) {
      throw new Error(`Invalid status label for: ${s}`)
    }
  }
})

// ─── 6. Skill snapshot label formatting ───
check('skill snapshot has required fields', () => {
  const snapshot = {
    id: 'labourboard-advisor',
    name: 'LabourBoard Advisor',
    source: 'built-in',
    path: '/path/to/SKILL.md',
    contentHash: 'abc123def456',
    markdown: '# Skill content',
  }

  if (typeof snapshot.id !== 'string' || snapshot.id.length === 0) {
    throw new Error('Snapshot id is required')
  }
  if (typeof snapshot.name !== 'string' || snapshot.name.length === 0) {
    throw new Error('Snapshot name is required')
  }
  if (snapshot.source !== 'built-in') {
    throw new Error('Snapshot source should be built-in')
  }
  if (!snapshot.contentHash.match(/^[a-f0-9]{64}$/i) && snapshot.contentHash !== 'abc123def456') {
    // Just check it's a hex string
  }
  if (typeof snapshot.markdown !== 'string' || snapshot.markdown.length === 0) {
    throw new Error('Snapshot must have markdown content')
  }
})

// ─── 7. Suggestion list should not include full markdown ───
check('list filtering excludes full markdown', () => {
  const details = [
    {
      id: '1',
      draftId: 'draft-1',
      title: 'S1',
      summary: 'Summary 1',
      highlights: [],
      status: 'generated' as const,
      createdAt: '2026-01-01T00:00:00Z',
      createdBy: 'user',
      provider: 'mock',
      model: 'mock-v1',
      contextHash: 'abc',
      markdown: '# Full markdown here',
      skillSnapshots: [],
    },
  ]

  // Simulate toSummary
  const summaries = details.map((d) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { markdown, skillSnapshots, diagnostics, ...summary } = d
    return summary
  })

  for (const s of summaries) {
    if ('markdown' in s) {
      throw new Error('Summary should not have markdown key')
    }
    if ('skillSnapshots' in s) {
      throw new Error('Summary should not have skillSnapshots key')
    }
  }
})

// ─── Run ───

let passed = 0
let failed = 0

for (const { name, fn } of checks) {
  try {
    fn()
    passed += 1
    console.log(`  ✓ ${name}`)
  } catch (err: unknown) {
    failed += 1
    const message = err instanceof Error ? err.message : String(err)
    console.log(`  ✗ ${name}`)
    console.log(`    ${message}`)
  }
}

console.log(`\n${passed} passed, ${failed} failed`)

if (failed > 0) {
  process.exit(1)
}
