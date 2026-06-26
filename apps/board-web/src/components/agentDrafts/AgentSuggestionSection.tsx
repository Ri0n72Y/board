import type {
  AgentDraftDetail,
  AgentSuggestionDetail,
  AgentSuggestionSummary,
  RecordBody,
  RecordItem,
  RecordResponse,
} from '@labour-board/shared'
import { useTranslation } from 'react-i18next'
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
  onGenerate: (draftId: string) => void | Promise<unknown>
  onSelectSuggestion: (id: string) => void
  records?: RecordResponse<RecordItem<RecordBody>>[]
  onOpenEditor?: (recordId: string, patchDescription: string) => void
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
  records,
  onOpenEditor,
}: AgentSuggestionSectionProps) {
  const { t } = useTranslation()
  const isReviewed = draft.status === 'reviewed'

  const handleGenerate = () => {
    // Wrap in void to prevent unhandled promise rejection;
    // the hook already handles errors via generateError state.
    void Promise.resolve(onGenerate(draft.id)).catch(() => undefined)
  }

  return (
    <div className="grid gap-3">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800">
          {t('agent.suggestions.title', { count: suggestions.length })}
        </h3>
        <Button
          type="button"
          variant="default"
          disabled={!isReviewed || isGenerating}
          onClick={handleGenerate}
          title={
            !isReviewed
              ? t('agent.suggestions.requiresReviewed')
              : undefined
          }
        >
          {isGenerating
            ? t('agent.suggestions.generating')
            : t('agent.suggestions.generate')}
        </Button>
      </div>

      {/* Safety hint if not reviewed */}
      {!isReviewed && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {t('agent.suggestions.requiresReviewed')}
        </div>
      )}

      {/* Generate error */}
      {generateError && (
        <ErrorBlock
          title={t('agent.suggestions.generateFailed')}
          message={generateError}
        />
      )}

      {/* Suggestion list */}
      {isListLoading && (
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500">
          {t('agent.suggestions.loadingList')}
        </div>
      )}

      {listError && (
        <ErrorBlock
          title={t('agent.suggestions.listFailed')}
          message={listError}
        />
      )}

      {!isListLoading && !listError && suggestions.length === 0 && (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
          {t('agent.suggestions.empty')}
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
          {t('agent.suggestions.loadingDetail')}
        </div>
      )}

      {detailError && (
        <ErrorBlock
          title={t('agent.suggestions.detailFailed')}
          message={detailError}
        />
      )}

      {!isDetailLoading && !detailError && selectedSuggestion && (
        <AgentSuggestionDetailPanel
          suggestion={selectedSuggestion}
          records={records}
          onOpenEditor={onOpenEditor}
        />
      )}
    </div>
  )
}
