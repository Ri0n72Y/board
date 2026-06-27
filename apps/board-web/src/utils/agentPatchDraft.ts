/**
 * agentPatchDraft – Pure utility functions for building human patch drafts
 * from AI suggestions.  No board mutation, no API calls, no side effects.
 */
import type { AgentSuggestionDetail } from '@labour-board/shared'

/**
 * Build the patch description for a human patch draft sourced from an AI suggestion.
 * Only includes minimal traceability: suggestion id, title, and "human draft" marker.
 * Explicitly excludes full markdown, context, prompt, and raw response.
 */
export function buildPatchDraftDescription(
  suggestionId: string,
  suggestionTitle: string,
): string {
  const idShort = suggestionId.slice(0, 8)
  const title = suggestionTitle.trim() || 'Untitled AI suggestion'
  return `Human patch drafted from AI suggestion ${idShort}: ${title}. Reviewed and submitted manually.`
}

/**
 * Extract candidate record PIDs (e.g. "CARD-5", "TASK/42") from suggestion markdown.
 * Returns deduplicated list.  This is a *hint* only — the user must still manually
 * select the target record.
 *
 * Matches patterns like: CARD-42, TASK-7, SYS/001, ASSET-abc
 */
export function extractPidCandidates(markdown: string): string[] {
  if (!markdown) return []

  const pidPattern = /\b[A-Z]{2,}\/[\w-]+|[A-Z]+-[\w-]+/g
  const matches = markdown.match(pidPattern)
  if (!matches) return []

  // Deduplicate, preserving order
  const seen = new Set<string>()
  return matches.filter((m) => {
    if (seen.has(m)) return false
    seen.add(m)
    return true
  })
}

/**
 * Check whether a suggestion has data that can seed a patch draft.
 */
export function canCreatePatchDraft(suggestion: AgentSuggestionDetail | null): boolean {
  if (!suggestion) return false
  if (!suggestion.title && !suggestion.markdown) return false
  return true
}
