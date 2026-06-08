/**
 * Dev-time assertions for tagDisplay.
 * Run with: npx tsx src/utils/tagDisplay.devcheck.ts
 */

import { formatTagLabel, normalizeTagLanguage } from './tagDisplay'

let failures = 0

function assert(expr: boolean, msg: string) {
  if (!expr) {
    console.error(`FAIL: ${msg}`)
    failures++
  } else {
    console.log(`  OK: ${msg}`)
  }
}

function eq(actual: string, expected: string, label: string) {
  assert(actual === expected, `${label} expected "${expected}" got "${actual}"`)
}

function ne(actual: string, unexpected: string, label: string) {
  assert(actual !== unexpected, `${label} should NOT be "${unexpected}"`)
}

function contains(actual: string, substring: string, label: string) {
  assert(actual.includes(substring), `${label} should contain "${substring}" got "${actual}"`)
}

// ─── Language normalization ───
eq(normalizeTagLanguage('zh-CN'), 'zh-CN', 'normalize zh-CN')
eq(normalizeTagLanguage('en-US'), 'en-US', 'normalize en-US')
eq(normalizeTagLanguage(undefined), 'en-US', 'normalize undefined')
eq(normalizeTagLanguage('ja'), 'en-US', 'normalize unknown')

// ─── Chinese assertions ───
console.log('\n─── zh-CN ───')
eq(formatTagLabel('status:todo', 'zh-CN'), '待办', 'status:todo zh-CN')
eq(formatTagLabel('status:doing', 'zh-CN'), '进行中', 'status:doing zh-CN')
eq(formatTagLabel('status:done', 'zh-CN'), '已完成', 'status:done zh-CN')
eq(formatTagLabel('status:archived', 'zh-CN'), '已归档', 'status:archived zh-CN')
eq(formatTagLabel('status:review', 'zh-CN'), '审核中', 'status:review zh-CN')
eq(formatTagLabel('status:blocked', 'zh-CN'), '阻塞', 'status:blocked zh-CN')
eq(formatTagLabel('status:backlog', 'zh-CN'), '待整理', 'status:backlog zh-CN')

eq(formatTagLabel('priority:p0', 'zh-CN'), 'P0 必须有', 'priority:p0 zh-CN')
eq(formatTagLabel('priority:p1', 'zh-CN'), 'P1 重要', 'priority:p1 zh-CN')

ne(formatTagLabel('epic:1', 'zh-CN'), '1', 'epic:1 zh-CN')
contains(formatTagLabel('epic:1', 'zh-CN'), 'Epic', 'epic:1 zh-CN')

eq(formatTagLabel('sprint:1', 'zh-CN'), '迭代 1', 'sprint:1 zh-CN')
eq(formatTagLabel('scope:combat', 'zh-CN'), '战斗', 'scope:combat zh-CN')
eq(formatTagLabel('owner:program', 'zh-CN'), '程序', 'owner:program zh-CN')
eq(formatTagLabel('type:user-story', 'zh-CN'), '用户故事', 'type:user-story zh-CN')
eq(formatTagLabel('milestone:first-month', 'zh-CN'), '首月', 'milestone:first-month zh-CN')

// Bare numeric without namespace
ne(formatTagLabel('1', 'zh-CN'), '1', 'bare 1 zh-CN')
contains(formatTagLabel('1', 'zh-CN'), '其他', 'bare 1 zh-CN contains 其他')

// Bare with namespace hint
eq(formatTagLabel('doing', 'zh-CN', { namespace: 'status' }), '进行中', 'bare doing + status zh-CN')
eq(formatTagLabel('p0', 'zh-CN', { namespace: 'priority' }), 'P0 必须有', 'bare p0 + priority zh-CN')

// Custom/unknown tag
eq(formatTagLabel('custom:abc', 'zh-CN'), 'custom:abc', 'custom:abc zh-CN')

// ─── English assertions ───
console.log('\n─── en-US ───')
eq(formatTagLabel('status:todo', 'en-US'), 'Todo', 'status:todo en-US')
eq(formatTagLabel('status:doing', 'en-US'), 'Doing', 'status:doing en-US')
eq(formatTagLabel('status:done', 'en-US'), 'Done', 'status:done en-US')
eq(formatTagLabel('status:archived', 'en-US'), 'Archived', 'status:archived en-US')
eq(formatTagLabel('priority:p0', 'en-US'), 'P0 Must Have', 'priority:p0 en-US')
eq(formatTagLabel('sprint:1', 'en-US'), 'Sprint 1', 'sprint:1 en-US')
ne(formatTagLabel('epic:1', 'en-US'), '1', 'epic:1 en-US')
eq(formatTagLabel('scope:combat', 'en-US'), 'Combat', 'scope:combat en-US')
eq(formatTagLabel('owner:program', 'en-US'), 'Program', 'owner:program en-US')
contains(formatTagLabel('1', 'en-US'), 'Other', 'bare 1 en-US contains Other')

// ─── Summary ───
console.log(`\n${failures === 0 ? 'ALL PASSED' : `${failures} FAILURES`}`)
process.exit(failures > 0 ? 1 : 0)
