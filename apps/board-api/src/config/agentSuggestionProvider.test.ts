import { describe, expect, it } from 'vitest'
import type { AgentSkillSnapshot } from '@labour-board/shared'
import { MockAgentSuggestionProvider } from './agentSuggestionProvider.js'

const mockSkill: AgentSkillSnapshot = {
  id: 'labourboard-advisor',
  name: 'LabourBoard Advisor',
  source: 'built-in',
  path: 'built-in:labourboard-advisor/SKILL.md',
  contentHash:
    'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
  markdown: '# LabourBoard Advisor\n\nTest skill content.',
}

describe('MockAgentSuggestionProvider', () => {
  it('returns title/summary/highlights/markdown', async () => {
    const provider = new MockAgentSuggestionProvider()
    const output = await provider.generate({
      contextMarkdown: '# Test Context',
      skillSnapshots: [mockSkill],
      draftId: 'draft-1',
      draftTitle: 'Test Draft',
      draftProfile: 'agent-full',
      draftSource: 'current-board',
      draftRecordCount: 3,
    })

    expect(typeof output.title).toBe('string')
    expect(output.title.length).toBeGreaterThan(0)
    expect(typeof output.summary).toBe('string')
    expect(output.summary.length).toBeGreaterThan(0)
    expect(Array.isArray(output.highlights)).toBe(true)
    expect(typeof output.markdown).toBe('string')
    expect(output.markdown.length).toBeGreaterThan(0)
  })

  it('highlights max 5', async () => {
    const provider = new MockAgentSuggestionProvider()
    const output = await provider.generate({
      contextMarkdown: '# Test',
      skillSnapshots: [mockSkill],
      draftId: 'draft-1',
      draftTitle: 'Test',
      draftProfile: 'agent-full',
      draftSource: 'current-board',
      draftRecordCount: 1,
    })

    expect(output.highlights.length).toBeLessThanOrEqual(5)
  })

  it('markdown follows LabourBoard AI Suggestion structure', async () => {
    const provider = new MockAgentSuggestionProvider()
    const output = await provider.generate({
      contextMarkdown: '# Test',
      skillSnapshots: [mockSkill],
      draftId: 'draft-1',
      draftTitle: 'Test',
      draftProfile: 'agent-full',
      draftSource: 'current-board',
      draftRecordCount: 1,
    })

    expect(output.markdown).toContain('# LabourBoard AI Suggestion')
    expect(output.markdown).toContain('## 1. Summary')
    expect(output.markdown).toContain('## 2. Board Diagnosis')
    expect(output.markdown).toContain('## 3. Risks')
    expect(output.markdown).toContain('## 4. Recommended Actions')
    expect(output.markdown).toContain('## 5. Patch Candidate Notes')
    expect(output.markdown).toContain('## 6. Questions for Human Review')
    expect(output.markdown).toContain('## 7. Limits')
  })

  it('provider is mock', async () => {
    const provider = new MockAgentSuggestionProvider()
    const output = await provider.generate({
      contextMarkdown: '# Test',
      skillSnapshots: [mockSkill],
      draftId: 'draft-1',
      draftTitle: 'Test',
      draftProfile: 'agent-full',
      draftSource: 'current-board',
      draftRecordCount: 1,
    })

    expect(output.provider).toBe('mock')
  })

  it('model is mock-suggestion-v1', async () => {
    const provider = new MockAgentSuggestionProvider()
    const output = await provider.generate({
      contextMarkdown: '# Test',
      skillSnapshots: [mockSkill],
      draftId: 'draft-1',
      draftTitle: 'Test',
      draftProfile: 'agent-full',
      draftSource: 'current-board',
      draftRecordCount: 1,
    })

    expect(output.model).toBe('mock-suggestion-v1')
  })

  it('uses configured model when provided', async () => {
    const provider = new MockAgentSuggestionProvider('mock-configured-model')
    const output = await provider.generate({
      contextMarkdown: '# Test',
      skillSnapshots: [mockSkill],
      draftId: 'draft-1',
      draftTitle: 'Test',
      draftProfile: 'agent-full',
      draftSource: 'current-board',
      draftRecordCount: 1,
    })

    expect(provider.model).toBe('mock-configured-model')
    expect(output.model).toBe('mock-configured-model')
  })
})
