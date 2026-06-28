/**
 * agentSuggestionDisplay.devcheck.ts
 *
 * Dev check for Agent Suggestion display utilities.
 * Run via: pnpm --filter @labour-board/api exec tsx ../board-web/src/utils/agentSuggestionDisplay.devcheck.ts
 *
 * Imports from agentSuggestionDisplay.ts — tests actual production utils.
 */

import {
  trimSuggestionSummary,
  limitSuggestionHighlights,
  toSuggestionCardViewModel,
  toSuggestionDetailViewModel,
  formatSuggestionStatus,
  formatSkillSnapshotLabel,
} from './agentSuggestionDisplay.js'

interface CheckCase {
  name: string
  fn: () => void
}

const checks: CheckCase[] = []

function check(name: string, fn: () => void): void {
  checks.push({ name, fn })
}

// ─── 1. Summary truncation ───

check('trimSuggestionSummary truncates to 600 characters', () => {
  const longText = 'x'.repeat(700)
  const result = trimSuggestionSummary(longText)
  if (result.length !== 600) {
    throw new Error(`Expected 600 chars, got ${result.length}`)
  }
  if (!result.endsWith('...')) {
    throw new Error('Expected truncated text to end with ...')
  }
})

check('trimSuggestionSummary returns as-is if within limit', () => {
  const shortText = 'Short summary'
  const result = trimSuggestionSummary(shortText)
  if (result !== 'Short summary') {
    throw new Error(`Expected unchanged text, got: ${result}`)
  }
})

// ─── 2. Highlights max count ───

check('limitSuggestionHighlights caps at 5', () => {
  const highlights = ['a', 'b', 'c', 'd', 'e', 'f', 'g']
  const result = limitSuggestionHighlights(highlights)
  if (result.length !== 5) {
    throw new Error(`Expected 5 highlights, got ${result.length}`)
  }
})

check('limitSuggestionHighlights preserves fewer than 5', () => {
  const highlights = ['a', 'b']
  const result = limitSuggestionHighlights(highlights)
  if (result.length !== 2) {
    throw new Error(`Expected 2 highlights, got ${result.length}`)
  }
})

// ─── 3. Card view model excludes markdown ───

check('toSuggestionCardViewModel excludes markdown', () => {
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
  const vm = toSuggestionCardViewModel(summary)
  if ('markdown' in vm) {
    throw new Error('Card view model should not include markdown')
  }
  if ('skillSnapshots' in vm) {
    throw new Error('Card view model should not include skillSnapshots')
  }
})

// ─── 4. Detail view model includes markdown ───

check('toSuggestionDetailViewModel includes markdown', () => {
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
  const vm = toSuggestionDetailViewModel(detail)
  if (!('markdown' in vm)) {
    throw new Error('Detail view model should include markdown')
  }
  if (typeof vm.markdown !== 'string') {
    throw new Error('markdown must be a string in detail view model')
  }
})

// ─── 5. Status badge mapping ───

check('formatSuggestionStatus covers all statuses', () => {
  const expectedStatuses = ['generated', 'reviewed', 'discarded']
  for (const s of expectedStatuses) {
    const label = formatSuggestionStatus(s)
    if (typeof label !== 'string' || label.length === 0) {
      throw new Error(`Missing status label for: ${s}`)
    }
  }
})

check('formatSuggestionStatus falls back for unknown status', () => {
  const result = formatSuggestionStatus('nonexistent')
  if (result !== 'nonexistent') {
    throw new Error(`Expected fallback to raw status, got: ${result}`)
  }
})

// ─── 6. Skill snapshot label formatting ───

check('formatSkillSnapshotLabel returns correct structure', () => {
  const snapshot = {
    name: 'LabourBoard Advisor',
    source: 'built-in',
    contentHash:
      'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
  }
  const label = formatSkillSnapshotLabel(snapshot)
  if (label.name !== 'LabourBoard Advisor') {
    throw new Error(`Expected name, got: ${label.name}`)
  }
  if (label.source !== 'built-in') {
    throw new Error(`Expected source 'built-in', got: ${label.source}`)
  }
  if (label.hashShort !== 'abcdef12') {
    throw new Error(`Expected hashShort 'abcdef12', got: ${label.hashShort}`)
  }
})

// ─── 7. Card view model does not include full skill markdown ───

check('toSuggestionCardViewModel has no skill markdown', () => {
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
  const vm = toSuggestionCardViewModel(summary)
  // Verify all keys are present except markdown/skillSnapshots
  const keys = Object.keys(vm)
  if (keys.includes('markdown'))
    throw new Error('card vm must not have markdown')
  if (keys.includes('skillSnapshots'))
    throw new Error('card vm must not have skillSnapshots')
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
