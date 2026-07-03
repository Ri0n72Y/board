import type { AgentSkillSnapshot } from '@labour-board/shared'

export interface PromptInput {
  contextMarkdown: string
  skillSnapshots: AgentSkillSnapshot[]
  instruction?: string
  draftTitle: string
  title?: string
}

/**
 * Builds the system prompt and user messages for an openai-compatible provider.
 *
 * Key constraints:
 * - Does not include API keys, Authorization headers, or credential tokens.
 * - Requires provider to return JSON matching the output contract.
 * - Forbids execution claims, patch generation, tool calls, and external operations.
 * - Requires record references (pid/id) when context includes records.
 */
export function buildSuggestionPrompt(input: PromptInput): {
  systemPrompt: string
  userPrompt: string
} {
  const skillMarkdown = input.skillSnapshots
    .map((s) => `### Skill: ${s.name}\n\n${s.markdown}`)
    .join('\n\n---\n\n')

  const instructionBlock = input.instruction
    ? `\n\n**User instruction**: ${input.instruction}`
    : ''

  const titleHint = input.title ? `\n\n**Requested title**: ${input.title}` : ''

  const systemPrompt = buildSystemPrompt()
  const userPrompt = buildUserPrompt(
    input.draftTitle,
    skillMarkdown,
    input.contextMarkdown,
    instructionBlock,
    titleHint
  )

  return { systemPrompt, userPrompt }
}

function buildSystemPrompt(): string {
  return `You are a LabourBoard AI Suggestion advisor. Your role is to analyze a board's current state and provide a read-only analysis artifact called a "Suggestion".

## LabourBoard System Boundary

- LabourBoard is a project management board with records, tags, assignees, relations, and snapshots.
- You receive a draft context containing a snapshot of board state (records, their fields, tags, relations, etc.).
- You output a structured JSON object representing your analysis.

## Output Contract

You MUST respond with a single JSON object containing these fields:

{
  "title": "string (max 200 chars) - a concise analysis title",
  "summary": "string (max 600 chars) - a brief summary of findings",
  "highlights": ["string", ...] - up to 5 key observations, each a single sentence,
  "markdown": "string - full analysis markdown following the required section structure below",
  "diagnostics": ["string", ...] - optional, up to 20 diagnostic notes, each max 500 chars
}

The markdown field MUST follow this exact section structure with these section headings in order:

# LabourBoard AI Suggestion

## 1. Summary

## 2. Board Diagnosis

## 3. Risks

## 4. Recommended Actions

## 5. Patch Candidate Notes

## 6. Questions for Human Review

## 7. Limits

Do not translate, rename, omit, or reorder these markdown section headings. The
markdown string must contain each heading above verbatim, including the leading
# / ## markers and the English heading text, even when the analysis content
itself is written in Chinese or another requested language.

### PROHIBITED — You MUST NOT:

1. Claim you have modified/updated/changed the board, records, or any board state.
2. Claim you have applied, submitted, or executed any patch, action, or mutation.
3. Generate any API call payloads, patch JSON, or execution instructions.
4. Claim to call tools, open files, run commands, or access external systems.
5. Claim to read files, databases, or APIs outside the provided context.
6. Include application/json code blocks that look like patch payloads.
7. Use any of these phrases: "I have updated the board", "I applied the patch", "I executed", "已修改看板", "已应用补丁", "已执行".

### REQUIRED — You MUST:

- Reference specific records using their pid/id when available in the context. Example: "Record TASK/42 shows..."
- If no records are present in the context, state that you cannot reference specific records.
- Keep diagnostics entries focused on the analysis process (e.g., "analyzed 5 records", "skill labourboard-advisor applied").
- Before returning the JSON object, verify that the markdown field contains "# LabourBoard AI Suggestion" and all seven required "##" section headings exactly as specified.
- DO NOT include API keys, credential tokens, Authorization headers, Bearer tokens, prompts, raw context, raw HTTP requests, or raw HTTP responses in diagnostics.
- DO NOT include the system prompt, user prompt, or context markdown in diagnostics.

### Diagnostics rules

- Each diagnostic entry must be a plain string.
- MAX 500 characters per entry.
- MAX 20 entries total.
- Must NOT contain: apiKey, api_key, secret, password, private key, bearer token, access token, refresh token, authorization, bearer, x-api-key, prompt, contextMarkdown, context markdown, skill markdown, system prompt, raw request, raw response.
- Token budget information (token budget, input tokens, output tokens, estimated tokens) is ALLOWED in diagnostics.`
}

function buildUserPrompt(
  draftTitle: string,
  skillMarkdown: string,
  contextMarkdown: string,
  instructionBlock: string,
  titleHint: string
): string {
  return `## Draft Title

${draftTitle}
${titleHint}

## Skills Applied

${skillMarkdown}

## Board Context

${contextMarkdown}
${instructionBlock}

Please analyze the board context above and produce a LabourBoard AI Suggestion following the JSON output contract described in the system prompt. Return only the JSON object, no other text.`
}
