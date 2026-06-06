import type {
  AgentDraftDetail,
  AgentDraftHandoffOptions,
  AgentDraftHandoffResult,
} from '../interfaces/index.js'

export class AgentDraftHandoffValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AgentDraftHandoffValidationError'
  }
}

export function buildAgentDraftHandoffMarkdown(
  draft: AgentDraftDetail,
  options?: AgentDraftHandoffOptions,
): AgentDraftHandoffResult {
  // Guard: must be reviewed
  if (draft.status !== 'reviewed') {
    throw new AgentDraftHandoffValidationError(
      `Draft status "${draft.status}" is not "reviewed". Only reviewed drafts can generate formal handoff.`,
    )
  }

  // Guard: must have review metadata
  if (!draft.reviewedAt || !draft.reviewedBy) {
    throw new AgentDraftHandoffValidationError(
      'Draft is missing reviewedAt or reviewedBy metadata. A proper human review is required before handoff.',
    )
  }

  const generatedAt = options?.generatedAt ?? new Date().toISOString()
  const snapshotLine = draft.snapshotId ? `- Snapshot ID: ${draft.snapshotId}\n` : ''
  const reviewNoteLine = draft.reviewNote
    ? draft.reviewNote
    : '(no review note)'

  const handoffMarkdown = [
    '# LabourBoard Agent Manual Handoff',
    '',
    '## Handoff Metadata',
    `- Draft ID: ${draft.id}`,
    `- Draft Title: ${draft.title}`,
    `- Draft Status: ${draft.status}`,
    `- Profile: ${draft.profile}`,
    `- Source: ${draft.source}`,
    snapshotLine.trimEnd(),
    `- Record Count: ${draft.recordCount}`,
    `- Reviewed At: ${draft.reviewedAt}`,
    `- Reviewed By: ${draft.reviewedBy}`,
    `- Handoff Generated At: ${generatedAt}`,
    '',
    '## Manual Handoff Instructions',
    'This markdown is a manually reviewed context package.',
    'It is intended to be copied by a human into an external Agent/Codex/ChatGPT session.',
    'This file is not execution authorization.',
    'Do not mutate LabourBoard directly.',
    'Do not assume API write permission.',
    'If you propose changes, return them as reviewable suggestions only.',
    'Any board mutation must be performed later through LabourBoard human-confirmed workflow.',
    '',
    '## Expected Agent Behavior',
    '- Read the context carefully.',
    '- Identify risks, missing information, contradictions, and next actions.',
    '- Preserve record ids, pids, tags, relation targets, and snapshot ids.',
    '- Do not invent board state not present in this handoff.',
    '- Do not output secrets.',
    '- Do not request or expose AGENT_API_KEY.',
    '- Do not claim any patch was applied.',
    '',
    '## Human Review Note',
    reviewNoteLine,
    '',
    '## Original Agent Context Pack',
    draft.contextMarkdown.trimEnd(),
    '',
  ]
    .filter((line) => line !== '')
    .join('\n')

  const filename = buildHandoffFilename(draft, generatedAt)

  return {
    format: 'markdown',
    filename,
    content: `${handoffMarkdown}\n`,
    meta: {
      draftId: draft.id,
      draftTitle: draft.title,
      profile: draft.profile,
      source: draft.source,
      status: draft.status,
      generatedAt,
      reviewedAt: draft.reviewedAt,
      reviewedBy: draft.reviewedBy,
      recordCount: draft.recordCount,
      ...(draft.snapshotId ? { snapshotId: draft.snapshotId } : {}),
    },
  }
}

function buildHandoffFilename(draft: AgentDraftDetail, generatedAt: string): string {
  const titleSlug = draft.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 40)
  const ts = generatedAt.slice(0, 19).replace(/[:T]/g, '-')
  return `agent-handoff-${titleSlug}-${draft.id.slice(0, 8)}-${ts}.md`
}
