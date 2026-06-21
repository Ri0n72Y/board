import type { AgentSuggestionDetail, AgentSuggestionSummary } from '@labour-board/shared'

export const MAX_SUMMARY_LENGTH = 600
export const MAX_HIGHLIGHTS = 5

export function trimSuggestionSummary(raw: string): string {
  if (raw.length <= MAX_SUMMARY_LENGTH) return raw
  return raw.slice(0, MAX_SUMMARY_LENGTH - 3) + '...'
}

export function limitSuggestionHighlights(
  highlights: string[],
): string[] {
  return highlights.slice(0, MAX_HIGHLIGHTS)
}

/** View model for the suggestion card — purposefully excludes markdown. */
export interface SuggestionCardViewModel {
  id: string
  draftId: string
  title: string
  summary: string
  highlights: string[]
  status: string
  createdAt: string
  createdBy: string
  provider: string
  model: string
  contextHash: string
}

export function toSuggestionCardViewModel(
  summary: AgentSuggestionSummary,
): SuggestionCardViewModel {
  const {
    id,
    draftId,
    title,
    summary: rawSummary,
    highlights,
    status,
    createdAt,
    createdBy,
    provider,
    model,
    contextHash,
  } = summary
  return {
    id,
    draftId,
    title,
    summary: trimSuggestionSummary(rawSummary),
    highlights: limitSuggestionHighlights(highlights),
    status,
    createdAt,
    createdBy,
    provider,
    model,
    contextHash,
  }
}

/** View model for the suggestion detail — includes full markdown. */
export interface SuggestionDetailViewModel extends SuggestionCardViewModel {
  markdown: string
  skillSnapshots: unknown[]
  diagnostics?: string[]
}

export function toSuggestionDetailViewModel(
  detail: AgentSuggestionDetail,
): SuggestionDetailViewModel {
  return {
    ...toSuggestionCardViewModel(detail),
    markdown: detail.markdown,
    skillSnapshots: detail.skillSnapshots,
    diagnostics: detail.diagnostics,
  }
}

const STATUS_LABELS: Record<string, string> = {
  generated: 'generated',
  reviewed: 'reviewed',
  discarded: 'discarded',
}

export function formatSuggestionStatus(status: string): string {
  return STATUS_LABELS[status] ?? status
}

export interface SkillSnapshotLabel {
  name: string
  source: string
  /** First 8 chars of contentHash */
  hashShort: string
}

export function formatSkillSnapshotLabel(snapshot: {
  name: string
  source: string
  contentHash: string
}): SkillSnapshotLabel {
  return {
    name: snapshot.name,
    source: snapshot.source,
    hashShort: snapshot.contentHash.slice(0, 8),
  }
}
