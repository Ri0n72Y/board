import type {
  AgentDraftDetail,
  AgentDraftStatus,
  AgentDraftSummary,
  AgentResponseDetail,
  AgentResponseSummary,
  AgentSuggestionDetail,
  AgentSuggestionSummary,
  RecordBody,
  RecordItem,
  RecordResponse,
} from '@labour-board/shared'
import { useTranslation } from 'react-i18next'
import { AnimatedDrawer } from './ui/AnimatedDrawer'
import { AgentDraftQueuePanel } from './agentDrafts/AgentDraftQueuePanel'
import { AgentDraftSafetyBanner } from './agentDrafts/AgentDraftSafetyBanner'
import { AgentDraftMetaPanel } from './agentDrafts/AgentDraftMetaPanel'
import { AgentDraftReviewInfo } from './agentDrafts/AgentDraftReviewInfo'
import { AgentDraftReviewActions } from './agentDrafts/AgentDraftReviewActions'
import { AgentDraftContextPreview } from './agentDrafts/AgentDraftContextPreview'
import { FormalHandoffSection } from './agentDrafts/FormalHandoffSection'
import { ManualAgentResponseSection } from './agentDrafts/ManualAgentResponseSection'
import { AgentManualWorkflowTimeline } from './agentDrafts/AgentManualWorkflowTimeline'
import { AgentSuggestionSection } from './agentDrafts/AgentSuggestionSection'
import { ErrorBlock } from './agentDrafts/ErrorBlock'

interface AgentDraftsDrawerBaseProps {
  open: boolean
  drafts: AgentDraftSummary[]
  selectedDraft: AgentDraftDetail | null
  isListLoading: boolean
  isDetailLoading: boolean
  isCreating: boolean
  listError: string | null
  detailError: string | null
  createError: string | null
  isReviewing?: boolean
  reviewError?: string | null
  isHandoffLoading?: boolean
  handoffError?: string | null
  handoffFeedback?: string | null
  onSelectDraft: (draftId: string) => void
  onRefreshList: () => void
  onClose: () => void
  onUpdateReview?: (
    draftId: string,
    status: AgentDraftStatus,
    reviewNote?: string,
  ) => void
  onCopyHandoff?: (draftId: string) => void
  onDownloadHandoff?: (draftId: string) => void
}

interface AgentResponsePanelProps {
  responses?: AgentResponseSummary[]
  selectedResponse?: AgentResponseDetail | null
  isResponseListLoading?: boolean
  isResponseDetailLoading?: boolean
  isResponseCreating?: boolean
  responseListError?: string | null
  responseDetailError?: string | null
  responseCreateError?: string | null
  onLoadResponseDetail?: (responseId: string) => void
  onSaveResponse?: (
    draftId: string,
    responseMarkdown: string,
    externalAgentName?: string,
    responseNote?: string,
  ) => Promise<AgentResponseDetail>
}

interface AgentSuggestionPanelProps {
  suggestions?: AgentSuggestionSummary[]
  selectedSuggestion?: AgentSuggestionDetail | null
  isSuggestionListLoading?: boolean
  isSuggestionDetailLoading?: boolean
  isSuggestionGenerating?: boolean
  suggestionListError?: string | null
  suggestionDetailError?: string | null
  suggestionGenerateError?: string | null
  onGenerateSuggestion?: (draftId: string) => void | Promise<unknown>
  onSelectSuggestion?: (suggestionId: string) => void
}

interface AgentPatchDraftBridgeProps {
  records?: RecordResponse<RecordItem<RecordBody>>[]
  onOpenEditor?: (recordId: string, patchDescription: string) => void
}

type AgentDraftsDrawerProps = AgentDraftsDrawerBaseProps &
  AgentResponsePanelProps &
  AgentSuggestionPanelProps &
  AgentPatchDraftBridgeProps

export function AgentDraftsDrawer({
  open,
  drafts,
  selectedDraft,
  isListLoading,
  isDetailLoading,
  isCreating,
  listError,
  detailError,
  createError,
  isReviewing = false,
  reviewError = null,
  isHandoffLoading = false,
  handoffError = null,
  handoffFeedback = null,
  responses = [],
  selectedResponse = null,
  isResponseListLoading = false,
  isResponseDetailLoading = false,
  isResponseCreating = false,
  responseListError = null,
  responseDetailError = null,
  responseCreateError = null,
  onSelectDraft,
  onRefreshList,
  onClose,
  onUpdateReview,
  onCopyHandoff,
  onDownloadHandoff,
  onLoadResponseDetail,
  onSaveResponse,
  // Agent Suggestion
  suggestions = [],
  selectedSuggestion = null,
  isSuggestionListLoading = false,
  isSuggestionDetailLoading = false,
  isSuggestionGenerating = false,
  suggestionListError = null,
  suggestionDetailError = null,
  suggestionGenerateError = null,
  onGenerateSuggestion,
  onSelectSuggestion,
  // Patch Draft (2.6)
  records,
  onOpenEditor,
}: AgentDraftsDrawerProps) {
  const { t } = useTranslation()

  if (!open) return null

  return (
    <AnimatedDrawer
      open={open}
      onClose={onClose}
      title={t('agent.title')}
      subtitle={t('agent.subtitle')}
      closeLabel={t('agent.close')}
      size="xl"
    >
      <div className="grid content-start gap-4 lg:grid-cols-[20rem_1fr]">
        <AgentDraftQueuePanel
          drafts={drafts}
          selectedDraftId={selectedDraft?.id ?? null}
          isListLoading={isListLoading}
          isCreating={isCreating}
          listError={listError}
          createError={createError}
          onSelectDraft={onSelectDraft}
          onRefreshList={onRefreshList}
        />

        <section className="min-w-0">
          {isDetailLoading && (
            <div className="rounded-lg border border-slate-200 bg-white p-5 text-slate-500">{t('agent.loadingDetail')}</div>
          )}
          {detailError && <ErrorBlock title={t('agent.detailFailed')} message={detailError} />}
          {!isDetailLoading && !detailError && selectedDraft && (
            <div className="grid gap-4">
              <AgentDraftSafetyBanner />

              <AgentManualWorkflowTimeline
                draft={selectedDraft}
                responses={responses}
              />

              <AgentDraftMetaPanel key={`draft-meta:${selectedDraft.id}`} draft={selectedDraft} />

              <AgentDraftReviewInfo draft={selectedDraft} />

              {onCopyHandoff && onDownloadHandoff && (
                <FormalHandoffSection
                  draft={selectedDraft}
                  isHandoffLoading={isHandoffLoading}
                  handoffError={handoffError}
                  handoffFeedback={handoffFeedback}
                  onCopyHandoff={onCopyHandoff}
                  onDownloadHandoff={onDownloadHandoff}
                />
              )}

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

              {onSaveResponse && onLoadResponseDetail && (
                <ManualAgentResponseSection
                  key={`draft-responses:${selectedDraft.id}`}
                  draft={selectedDraft}
                  responses={responses}
                  selectedResponse={selectedResponse}
                  isResponseListLoading={isResponseListLoading}
                  isResponseDetailLoading={isResponseDetailLoading}
                  isResponseCreating={isResponseCreating}
                  responseListError={responseListError}
                  responseDetailError={responseDetailError}
                  responseCreateError={responseCreateError}
                  onLoadResponseDetail={onLoadResponseDetail}
                  onSaveResponse={onSaveResponse}
                />
              )}

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
            <div className="rounded-lg border border-slate-200 bg-white p-5 text-slate-500">{t('agent.selectHint')}</div>
          )}
        </section>
      </div>
    </AnimatedDrawer>
  )
}
