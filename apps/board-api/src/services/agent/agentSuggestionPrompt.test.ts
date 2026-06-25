import { describe, expect, it } from 'vitest'
import { buildSuggestionPrompt } from './agentSuggestionPrompt.js'

describe('agentSuggestionPrompt', () => {
  const skillMarkdown = '# Test Skill\n\nThis is a test skill markdown.'
  const contextMarkdown = '# Board Context\n\nRecord TASK/1: Test task.'

  it('prompt contains output contract', () => {
    const { systemPrompt } = buildSuggestionPrompt({
      contextMarkdown,
      skillSnapshots: [
        {
          id: 'skill-1',
          name: 'test-skill',
          source: 'built-in',
          path: '/skills/test.md',
          contentHash: 'abc',
          markdown: skillMarkdown,
        },
      ],
      draftTitle: 'Test Draft',
    })

    expect(systemPrompt).toContain('# LabourBoard AI Suggestion')
    expect(systemPrompt).toContain('## 1. Summary')
    expect(systemPrompt).toContain('## 7. Limits')
  })

  it('prompt contains non-execution boundary', () => {
    const { systemPrompt } = buildSuggestionPrompt({
      contextMarkdown,
      skillSnapshots: [
        {
          id: 'skill-1',
          name: 'test-skill',
          source: 'built-in',
          path: '/skills/test.md',
          contentHash: 'abc',
          markdown: skillMarkdown,
        },
      ],
      draftTitle: 'Test Draft',
    })

    expect(systemPrompt).toContain('I have updated the board')
    expect(systemPrompt).toContain('I applied the patch')
    expect(systemPrompt).toContain('I executed')
    expect(systemPrompt).toContain('已修改看板')
    expect(systemPrompt).toContain('已应用补丁')
    expect(systemPrompt).toContain('已执行')
    expect(systemPrompt).toContain('PROHIBITED')
  })

  it('prompt includes skill markdown', () => {
    const { userPrompt } = buildSuggestionPrompt({
      contextMarkdown,
      skillSnapshots: [
        {
          id: 'skill-1',
          name: 'test-skill',
          source: 'built-in',
          path: '/skills/test.md',
          contentHash: 'abc',
          markdown: skillMarkdown,
        },
      ],
      draftTitle: 'Test Draft',
    })

    expect(userPrompt).toContain('test-skill')
    expect(userPrompt).toContain('This is a test skill markdown')
  })

  it('prompt includes context markdown', () => {
    const { userPrompt } = buildSuggestionPrompt({
      contextMarkdown,
      skillSnapshots: [
        {
          id: 'skill-1',
          name: 'test-skill',
          source: 'built-in',
          path: '/skills/test.md',
          contentHash: 'abc',
          markdown: skillMarkdown,
        },
      ],
      draftTitle: 'Test Draft',
    })

    expect(userPrompt).toContain('# Board Context')
    expect(userPrompt).toContain('Record TASK/1')
  })

  it('prompt includes instruction when provided', () => {
    const { userPrompt } = buildSuggestionPrompt({
      contextMarkdown,
      skillSnapshots: [
        {
          id: 'skill-1',
          name: 'test-skill',
          source: 'built-in',
          path: '/skills/test.md',
          contentHash: 'abc',
          markdown: skillMarkdown,
        },
      ],
      draftTitle: 'Test Draft',
      instruction: 'Focus on priority items.',
    })

    expect(userPrompt).toContain('Focus on priority items')
    expect(userPrompt).toContain('**User instruction**')
  })

  it('prompt does not include API key', () => {
    const { systemPrompt, userPrompt } = buildSuggestionPrompt({
      contextMarkdown,
      skillSnapshots: [
        {
          id: 'skill-1',
          name: 'test-skill',
          source: 'built-in',
          path: '/skills/test.md',
          contentHash: 'abc',
          markdown: skillMarkdown,
        },
      ],
      draftTitle: 'Test Draft',
    })

    const combined = systemPrompt + userPrompt
    expect(combined).not.toContain('sk-')
    // "Bearer" and "Authorization" appear in the prompt as prohibition text
    // (telling the model what NOT to output). This is correct behavior.
    // The prompt must NOT contain actual secret values.
    expect(combined).not.toContain('Authorization:')
    expect(combined).not.toContain('x-api-key:')
  })

  it('prompt includes title hint when title provided', () => {
    const { userPrompt } = buildSuggestionPrompt({
      contextMarkdown,
      skillSnapshots: [],
      draftTitle: 'Test Draft',
      title: 'Custom Suggestion Title',
    })

    expect(userPrompt).toContain('Custom Suggestion Title')
    expect(userPrompt).toContain('**Requested title**')
  })

  it('userPrompt includes draft title', () => {
    const { userPrompt } = buildSuggestionPrompt({
      contextMarkdown,
      skillSnapshots: [],
      draftTitle: 'My Draft Title',
    })

    expect(userPrompt).toContain('My Draft Title')
  })

  it('prompt handles empty skill snapshots', () => {
    const { userPrompt } = buildSuggestionPrompt({
      contextMarkdown,
      skillSnapshots: [],
      draftTitle: 'Test Draft',
    })

    expect(userPrompt).toContain('## Skills Applied')
    expect(userPrompt).toContain('## Board Context')
  })
})
