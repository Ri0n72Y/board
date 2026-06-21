import type { AgentSkillSnapshot } from '@labour-board/shared'
import { createHash } from 'node:crypto'

export interface AgentSuggestionProviderInput {
  contextMarkdown: string
  skillSnapshots: AgentSkillSnapshot[]
  instruction?: string
  draftId: string
  draftTitle: string
  draftProfile: string
  draftSource: string
  draftRecordCount: number
  title?: string
}

export interface AgentSuggestionProviderOutput {
  title: string
  summary: string
  highlights: string[]
  markdown: string
  provider: string
  model: string
  diagnostics?: string[]
}

export interface AgentSuggestionProvider {
  generate(
    input: AgentSuggestionProviderInput,
  ): Promise<AgentSuggestionProviderOutput>
}

// ─── Mock Provider ───

export class MockAgentSuggestionProvider implements AgentSuggestionProvider {
  async generate(
    input: AgentSuggestionProviderInput,
  ): Promise<AgentSuggestionProviderOutput> {
    const skillName = input.skillSnapshots[0]?.name ?? 'LabourBoard Advisor'
    const recordCount = input.draftRecordCount
    const draftTitle = input.draftTitle
    const instruction = input.instruction

    const title = input.title?.trim() || `AI Suggestion for "${draftTitle}"`

    const summary = `This suggestion is based on the "${draftTitle}" draft context (${recordCount} records). The ${skillName} skill was used to analyze the board state. This is a mock suggestion generated for MVP 2.3 validation — a real AI provider would produce a tailored analysis based on the actual board context.`

    const highlights: string[] = [
      `Context analyzed from draft "${draftTitle}" with ${recordCount} records.`,
      `Skill "${skillName}" was applied as the primary analysis lens.`,
      instruction
        ? `Custom instruction provided: "${instruction.slice(0, 80)}${instruction.length > 80 ? '...' : ''}"`
        : 'No custom instruction was provided.',
      'No board mutation has been performed. This is an analysis only.',
      'Review these suggestions and decide which actions to take manually.',
    ]

    // Build a realistic mock markdown following the labourboard-advisor format
    const contextHash = createHash('sha256')
      .update(input.contextMarkdown)
      .digest('hex')

    const markdown = buildMockMarkdown({
      title,
      skillName,
      draftTitle,
      recordCount,
      draftProfile: input.draftProfile,
      draftSource: input.draftSource,
      contextHash,
      instruction,
    })

    return {
      title,
      summary,
      highlights: highlights.slice(0, 5),
      markdown,
      provider: 'mock',
      model: 'mock-suggestion-v1',
    }
  }
}

function buildMockMarkdown(params: {
  title: string
  skillName: string
  draftTitle: string
  recordCount: number
  draftProfile: string
  draftSource: string
  contextHash: string
  instruction?: string
}): string {
  const { skillName, draftTitle, recordCount, draftProfile, draftSource, contextHash, instruction } = params

  return `# LabourBoard AI Suggestion

## 1. Summary

- Draft "${draftTitle}" contains ${recordCount} records from the "${draftProfile}" profile.
- Source context was generated from "${draftSource}".
- ${skillName} skill was applied for analysis.
- This is a **mock suggestion** — a real provider would produce fully tailored analysis.
- No board mutation has been performed.

## 2. Board Diagnosis

### Context Overview

The draft context was exported using the **${draftProfile}** profile from a **${draftSource}** source. It contains ${recordCount} records.

### Mock Analysis Note

This mock provider cannot read the actual context. In a real deployment:

- Record status distribution would be analyzed.
- Sprint coverage and epic alignment would be evaluated.
- Assignee workload distribution would be assessed.
- Dependency chains and blockers would be identified.
- Tag completeness would be checked.

## 3. Risks

### Mock Limitations

Since this is a mock provider, specific risks cannot be identified from the
context. A real provider would reference actual record \`pid/id\` combinations.

Categories that would be evaluated:

- **Blockers**: Records that block dependent work.
- **Bottlenecks**: Overloaded assignees or stalled records.
- **Missing Dependencies**: Records without required relations.
- **Tag Gaps**: Records missing expected tags.
- **Staleness**: Records with no recent activity.

## 4. Recommended Actions

### Mock Note

Actual recommendations would reference specific records by \`pid/id\`.
Each recommendation would include:
- The target record(s)
- The reasoning behind the recommendation
- A clear action a human can take

${instruction ? `### Custom Instruction\n\nThe following instruction was provided: "${instruction}"\n\nIn a real suggestion, this instruction would guide the analysis focus.\n` : ''}
## 5. Patch Candidate Notes

No specific patches are recommended in this mock suggestion.
In a real suggestion, each recommended action that requires a patch
would describe:
- Target record (\`pid/id\`)
- What field(s) to change
- Before/after values
- Rationale

These notes are for human reference. No actual submit payloads are generated.

## 6. Questions for Human Review

- Are there any records that appear stalled or blocked?
- Are there any records missing expected tags (priority, sprint, epic)?
- Do any assignees appear overloaded?
- Are there dependency chains that need attention?

The above questions should be evaluated by a human using their knowledge
of the project context beyond what the draft captures.

## 7. Limits

### Analysis Boundaries

- **Context Hash**: \`${contextHash}\`
- **Source**: ${draftSource} (profile: ${draftProfile})
- **Provider**: mock (not a real AI model)
- **Skill Applied**: ${skillName}

### Known Limitations

1. This is a **mock suggestion** — no real AI analysis was performed.
2. Board records were not modified.
3. No patches were applied.
4. Only the provided context was analyzed; no external data was consulted.
5. Assumptions made by the mock provider may not reflect reality.

### What Would Improve Accuracy

- A real AI provider with access to the full context markdown.
- Additional project context beyond the draft.
- Historical board data (previous snapshots).
- Human feedback on previous suggestions to calibrate analysis.
`
}
