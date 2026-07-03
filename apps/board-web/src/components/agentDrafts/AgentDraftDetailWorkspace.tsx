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

interface AgentDraftDetailWorkspaceProps {
  selectedDraft: AgentDraftDetail | null
  isDetailLoading: boolean
  detailError: string | null
  isReviewing: boolean
  reviewError: string | null
  onUpdateReview?: (
    draftId: string,
    status: AgentDraftStatus,
    reviewNote?: string
  ) => void
  suggestions: AgentSuggestionSummary[]
  selectedSuggestion: AgentSuggestionDetail | null
  isSuggestionListLoading: boolean
  isSuggestionDetailLoading: boolean
  isSuggestionGenerating: boolean
  suggestionListError: string | null
  suggestionDetailError: string | null
  suggestionGenerateError: string | null
  onGenerateSuggestion?: (
    draftId: string,
    instruction?: string
  ) => void | Promise<unknown>
  onSelectSuggestion?: (suggestionId: string) => void
  records?: RecordResponse<RecordItem<RecordBody>>[]
  onOpenEditor?: (recordId: string, patchDescription: string) => void
}

export function AgentDraftDetailWorkspace({
  selectedDraft,
  isDetailLoading,
  detailError,
  isReviewing,
  reviewError,
  onUpdateReview,
  suggestions,
  selectedSuggestion,
  isSuggestionListLoading,
  isSuggestionDetailLoading,
  isSuggestionGenerating,
  suggestionListError,
  suggestionDetailError,
  suggestionGenerateError,
  onGenerateSuggestion,
  onSelectSuggestion,
  records,
  onOpenEditor,
}: AgentDraftDetailWorkspaceProps) {
  const { t } = useTranslation()

  return (
    <section className="min-w-0">
      {isDetailLoading && (
        <div className="rounded-lg border border-slate-200 bg-white p-5 text-slate-500">
          {t('agent.loadingDetail')}
        </div>
      )}
      {detailError && (
        <ErrorBlock title={t('agent.detailFailed')} message={detailError} />
      )}
      {!isDetailLoading && !detailError && selectedDraft && (
        <div className="grid gap-4">
          <AgentDraftSafetyBanner />

          <AgentDraftMetaPanel
            key={`draft-meta:${selectedDraft.id}`}
            draft={selectedDraft}
          />

          <AgentDraftReviewInfo draft={selectedDraft} />

          {onUpdateReview && (
            <AgentDraftReviewActions
              key={`draft-review:${selectedDraft.id}`}
              draft={selectedDraft}
              isReviewing={isReviewing}
              reviewError={reviewError}
              onUpdateReview={onUpdateReview}
            />
          )}

          <AgentDraftContextPreview draft={selectedDraft} />

          {onGenerateSuggestion && onSelectSuggestion && (
            <AgentSuggestionSection
              key={`draft-suggestions:${selectedDraft.id}`}
              draft={selectedDraft}
              suggestions={suggestions}
              selectedSuggestion={selectedSuggestion}
              isListLoading={isSuggestionListLoading}
              isDetailLoading={isSuggestionDetailLoading}
              isGenerating={isSuggestionGenerating}
              listError={suggestionListError}
              detailError={suggestionDetailError}
              generateError={suggestionGenerateError}
              onGenerate={onGenerateSuggestion}
              onSelectSuggestion={onSelectSuggestion}
              records={records}
              onOpenEditor={onOpenEditor}
            />
          )}
        </div>
      )}
      {!isDetailLoading && !detailError && !selectedDraft && (
        <div className="rounded-lg border border-slate-200 bg-white p-5 text-slate-500">
          {t('agent.selectHint')}
        </div>
      )}
    </section>
  )
}
