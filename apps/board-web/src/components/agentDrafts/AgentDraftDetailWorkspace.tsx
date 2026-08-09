import type {
  AgentDraftDetail,
  AgentDraftStatus,
  AgentResponseDetail,
  AgentResponseSummary,
  AgentSuggestionDetail,
  AgentSuggestionStatus,
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
import { FormalHandoffSection } from './FormalHandoffSection'
import { ManualAgentResponseSection } from './ManualAgentResponseSection'
import { AgentManualWorkflowTimeline } from './AgentManualWorkflowTimeline'
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
  isReviewing: boolean
  listError: string | null
  detailError: string | null
  generateError: string | null
  reviewError: string | null
  onGenerate: (draftId: string, instruction?: string) => void | Promise<unknown>
  onSelectSuggestion: (suggestionId: string) => void
  onReviewSuggestion: (
    suggestionId: string,
    status: AgentSuggestionStatus
  ) => void
}

interface AgentDraftPatchDraftState {
  records?: RecordResponse<RecordItem<RecordBody>>[]
  onOpenRecord?: (recordId: string, patchDescription: string) => void
}

interface AgentDraftHandoffState {
  isHandoffLoading: boolean
  handoffError: string | null
  handoffFeedback: string | null
  onCopyHandoff: (draftId: string) => void
  onDownloadHandoff: (draftId: string) => void
}

interface AgentDraftManualResponseState {
  responses: AgentResponseSummary[]
  selectedResponse: AgentResponseDetail | null
  isListLoading: boolean
  isDetailLoading: boolean
  isCreating: boolean
  listError: string | null
  detailError: string | null
  createError: string | null
  onLoadResponseDetail: (responseId: string) => void
  onSaveResponse: (
    draftId: string,
    responseMarkdown: string,
    externalAgentName?: string,
    responseNote?: string
  ) => Promise<AgentResponseDetail>
}

interface AgentDraftDetailWorkspaceProps {
  detail: AgentDraftDetailState
  review?: AgentDraftReviewState
  suggestion?: AgentDraftSuggestionState
  patchDraft?: AgentDraftPatchDraftState
  handoff?: AgentDraftHandoffState
  manualResponse?: AgentDraftManualResponseState
}

export function AgentDraftDetailWorkspace({
  detail,
  review,
  suggestion,
  patchDraft,
  handoff,
  manualResponse,
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

          {handoff && (
            <FormalHandoffSection
              key={`draft-handoff:${selectedDraft.id}`}
              draft={selectedDraft}
              isHandoffLoading={handoff.isHandoffLoading}
              handoffError={handoff.handoffError}
              handoffFeedback={handoff.handoffFeedback}
              onCopyHandoff={handoff.onCopyHandoff}
              onDownloadHandoff={handoff.onDownloadHandoff}
            />
          )}

          {manualResponse && (
            <AgentManualWorkflowTimeline
              key={`draft-timeline:${selectedDraft.id}`}
              draft={selectedDraft}
              responses={manualResponse.responses}
            />
          )}

          {manualResponse && (
            <ManualAgentResponseSection
              key={`draft-responses:${selectedDraft.id}`}
              draft={selectedDraft}
              responses={manualResponse.responses}
              selectedResponse={manualResponse.selectedResponse}
              isResponseListLoading={manualResponse.isListLoading}
              isResponseDetailLoading={manualResponse.isDetailLoading}
              isResponseCreating={manualResponse.isCreating}
              responseListError={manualResponse.listError}
              responseDetailError={manualResponse.detailError}
              responseCreateError={manualResponse.createError}
              onLoadResponseDetail={manualResponse.onLoadResponseDetail}
              onSaveResponse={manualResponse.onSaveResponse}
            />
          )}

          {suggestion && (
            <AgentSuggestionSection
              key={`draft-suggestions:${selectedDraft.id}`}
              draft={selectedDraft}
              suggestions={suggestion.suggestions}
              selectedSuggestion={suggestion.selectedSuggestion}
              isListLoading={suggestion.isListLoading}
              isDetailLoading={suggestion.isDetailLoading}
              isGenerating={suggestion.isGenerating}
              isReviewing={suggestion.isReviewing}
              listError={suggestion.listError}
              detailError={suggestion.detailError}
              generateError={suggestion.generateError}
              reviewError={suggestion.reviewError}
              onGenerate={suggestion.onGenerate}
              onSelectSuggestion={suggestion.onSelectSuggestion}
              onReviewSuggestion={suggestion.onReviewSuggestion}
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
