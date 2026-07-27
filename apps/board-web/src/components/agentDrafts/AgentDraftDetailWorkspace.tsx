import type {
  AgentDraftDetail,
  AgentDraftStatus,
  AgentSuggestionDetail,
  AgentSuggestionSummary,
  RecordBody,
  RecordItem,
  RecordResponse,
} from '@labour-board/shared'
import { useTranslation } from 'react-i18next'
import { AgentDraftSafetyBanner } from './AgentDraftSafetyBanner'
import { AgentDraftMetaPanel } from './AgentDraftMetaPanel'
import { AgentDraftReviewInfo } from './AgentDraftReviewInfo'
import { AgentDraftReviewActions } from './AgentDraftReviewActions'
import { AgentDraftContextPreview } from './AgentDraftContextPreview'
import { AgentSuggestionSection } from './AgentSuggestionSection'
import { ErrorBlock } from './ErrorBlock'

interface AgentDraftDetailState {
  selectedDraft: AgentDraftDetail | null
  isLoading: boolean
  error: string | null
}

interface AgentDraftReviewState {
  isReviewing: boolean
  reviewError: string | null
  onUpdateReview: (
    draftId: string,
    status: AgentDraftStatus,
    reviewNote?: string
  ) => void
}

interface AgentDraftSuggestionState {
  suggestions: AgentSuggestionSummary[]
  selectedSuggestion: AgentSuggestionDetail | null
  isListLoading: boolean
  isDetailLoading: boolean
  isGenerating: boolean
  listError: string | null
  detailError: string | null
  generateError: string | null
  onGenerate: (draftId: string, instruction?: string) => void | Promise<unknown>
  onSelectSuggestion: (suggestionId: string) => void
}

interface AgentDraftPatchDraftState {
  records?: RecordResponse<RecordItem<RecordBody>>[]
  onOpenRecord?: (recordId: string, patchDescription: string) => void
}

interface AgentDraftDetailWorkspaceProps {
  detail: AgentDraftDetailState
  review?: AgentDraftReviewState
  suggestion?: AgentDraftSuggestionState
  patchDraft?: AgentDraftPatchDraftState
}

export function AgentDraftDetailWorkspace({
  detail,
  review,
  suggestion,
  patchDraft,
}: AgentDraftDetailWorkspaceProps) {
  const { t } = useTranslation()
  const { selectedDraft, isLoading, error } = detail

  return (
    <section className="min-w-0">
      {isLoading && (
        <div className="rounded-lg border border-slate-200 bg-white p-5 text-slate-500">
          {t('agent.loadingDetail')}
        </div>
      )}
      {error && <ErrorBlock title={t('agent.detailFailed')} message={error} />}
      {!isLoading && !error && selectedDraft && (
        <div className="grid gap-4">
          <AgentDraftSafetyBanner />

          <AgentDraftMetaPanel
            key={`draft-meta:${selectedDraft.id}`}
            draft={selectedDraft}
          />

          <AgentDraftReviewInfo draft={selectedDraft} />

          {review && (
            <AgentDraftReviewActions
              key={`draft-review:${selectedDraft.id}`}
              draft={selectedDraft}
              isReviewing={review.isReviewing}
              reviewError={review.reviewError}
              onUpdateReview={review.onUpdateReview}
            />
          )}

          <AgentDraftContextPreview draft={selectedDraft} />

          {suggestion && (
            <AgentSuggestionSection
              key={`draft-suggestions:${selectedDraft.id}`}
              draft={selectedDraft}
              suggestions={suggestion.suggestions}
              selectedSuggestion={suggestion.selectedSuggestion}
              isListLoading={suggestion.isListLoading}
              isDetailLoading={suggestion.isDetailLoading}
              isGenerating={suggestion.isGenerating}
              listError={suggestion.listError}
              detailError={suggestion.detailError}
              generateError={suggestion.generateError}
              onGenerate={suggestion.onGenerate}
              onSelectSuggestion={suggestion.onSelectSuggestion}
              records={patchDraft?.records}
              onOpenRecord={patchDraft?.onOpenRecord}
            />
          )}
        </div>
      )}
      {!isLoading && !error && !selectedDraft && (
        <div className="rounded-lg border border-slate-200 bg-white p-5 text-slate-500">
          {t('agent.selectHint')}
        </div>
      )}
    </section>
  )
}
