import type { AgentDraftDetail, AgentDraftStatus, AgentDraftSummary, AgentResponseDetail, AgentResponseSummary, AgentSuggestionDetail, AgentSuggestionSummary } from '@labour-board/shared'
import { useTranslation } from 'react-i18next'
import { Button } from './ui/Button'
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

interface AgentDraftsDrawerProps {
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
  // Agent Response
  responses?: AgentResponseSummary[]
  selectedResponse?: AgentResponseDetail | null
  isResponseListLoading?: boolean
  isResponseDetailLoading?: boolean
  isResponseCreating?: boolean
  responseListError?: string | null
  responseDetailError?: string | null
  responseCreateError?: string | null
  onSelectDraft: (draftId: string) => void
  onRefreshList: () => void
  onClose: () => void
  onUpdateReview?: (draftId: string, status: AgentDraftStatus, reviewNote?: string) => void
  onCopyHandoff?: (draftId: string) => void
  onDownloadHandoff?: (draftId: string) => void
  onLoadResponseDetail?: (responseId: string) => void
  onSaveResponse?: (draftId: string, responseMarkdown: string, externalAgentName?: string, responseNote?: string) => Promise<AgentResponseDetail>
  // Agent Suggestion
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
}: AgentDraftsDrawerProps) {
  const { t } = useTranslation()

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/30"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <aside
        aria-labelledby="agent-drafts-title"
        aria-modal="true"
        className="ml-auto grid h-full w-full max-w-5xl grid-rows-[auto_1fr] overflow-hidden border-l border-slate-200 bg-stone-50 text-slate-950 shadow-xl"
        role="dialog"
      >
        <header className="flex min-w-0 items-start justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4">
          <div className="min-w-0">
            <p className="mb-1 text-xs font-bold uppercase text-slate-500">{t('agent.subtitle')}</p>
            <h2 className="text-xl font-semibold leading-tight" id="agent-drafts-title">
              {t('agent.title')}
            </h2>
          </div>
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            title={t('agent.closeTitle')}
          >
            {t('agent.close')}
          </Button>
        </header>

        <div className="grid min-h-0 gap-4 overflow-y-auto px-5 py-4 lg:grid-cols-[20rem_1fr]">
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

                <AgentDraftMetaPanel key={selectedDraft.id} draft={selectedDraft} />

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
                    key={selectedDraft.id}
                    draft={selectedDraft}
                    isReviewing={isReviewing}
                    reviewError={reviewError}
                    onUpdateReview={onUpdateReview}
                  />
                )}

                <AgentDraftContextPreview draft={selectedDraft} />

                {onSaveResponse && onLoadResponseDetail && (
                  <ManualAgentResponseSection
                    key={selectedDraft.id}
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
                    key={`${selectedDraft.id}-suggestions`}
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
                  />
                )}
              </div>
            )}
            {!isDetailLoading && !detailError && !selectedDraft && (
              <div className="rounded-lg border border-slate-200 bg-white p-5 text-slate-500">{t('agent.selectHint')}</div>
            )}
          </section>
        </div>
      </aside>
    </div>
  )
}
