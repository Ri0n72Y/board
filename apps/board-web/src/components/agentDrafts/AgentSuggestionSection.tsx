import type { AgentDraftDetail, AgentSuggestionDetail, AgentSuggestionSummary } from '@labour-board/shared'
import { ErrorBlock } from './ErrorBlock'
import { AgentSuggestionCard } from './AgentSuggestionCard'
import { AgentSuggestionDetailPanel } from './AgentSuggestionDetailPanel'
import { Button } from '../ui/Button'

interface AgentSuggestionSectionProps {
  draft: AgentDraftDetail
  suggestions: AgentSuggestionSummary[]
  selectedSuggestion: AgentSuggestionDetail | null
  isListLoading: boolean
  isDetailLoading: boolean
  isGenerating: boolean
  listError: string | null
  detailError: string | null
  generateError: string | null
  onGenerate: (draftId: string) => void
  onSelectSuggestion: (id: string) => void
}

export function AgentSuggestionSection({
  draft,
  suggestions,
  selectedSuggestion,
  isListLoading,
  isDetailLoading,
  isGenerating,
  listError,
  detailError,
  generateError,
  onGenerate,
  onSelectSuggestion,
}: AgentSuggestionSectionProps) {
  const isReviewed = draft.status === 'reviewed'

  return (
    <div className="grid gap-3">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800">
          AI Suggestions ({suggestions.length})
        </h3>
        <Button
          type="button"
          variant="default"
          disabled={!isReviewed || isGenerating}
          onClick={() => onGenerate(draft.id)}
          title={
            !isReviewed
              ? 'Draft must be reviewed before generating AI suggestions'
              : undefined
          }
        >
          {isGenerating ? 'Generating...' : 'Generate AI Suggestion'}
        </Button>
      </div>

      {/* Safety hint if not reviewed */}
      {!isReviewed && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Draft must be reviewed before generating AI suggestions.
        </div>
      )}

      {/* Generate error */}
      {generateError && (
        <ErrorBlock
          title="Suggestion generation failed"
          message={generateError}
        />
      )}

      {/* Suggestion list */}
      {isListLoading && (
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500">
          Loading suggestions...
        </div>
      )}

      {listError && (
        <ErrorBlock
          title="Failed to load suggestions"
          message={listError}
        />
      )}

      {!isListLoading && !listError && suggestions.length === 0 && (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
          No AI suggestions yet. Generate one from this reviewed draft.
        </div>
      )}

      {/* Suggestion cards list */}
      {!isListLoading &&
        !listError &&
        suggestions.length > 0 && (
          <div className="grid gap-2">
            {suggestions.map((s) => (
              <AgentSuggestionCard
                key={s.id}
                suggestion={s}
                isSelected={selectedSuggestion?.id === s.id}
                onSelect={onSelectSuggestion}
              />
            ))}
          </div>
        )}

      {/* Suggestion detail */}
      {isDetailLoading && (
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500">
          Loading suggestion detail...
        </div>
      )}

      {detailError && (
        <ErrorBlock
          title="Failed to load suggestion detail"
          message={detailError}
        />
      )}

      {!isDetailLoading && !detailError && selectedSuggestion && (
        <AgentSuggestionDetailPanel suggestion={selectedSuggestion} />
      )}
    </div>
  )
}
