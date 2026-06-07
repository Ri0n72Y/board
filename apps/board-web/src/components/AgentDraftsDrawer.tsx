import type { AgentDraftDetail, AgentDraftStatus, AgentDraftSummary, AgentResponseDetail, AgentResponseSummary } from '@labour-board/shared'
import { XMarkIcon } from '@heroicons/react/20/solid'
import { Button } from './ui/Button'
import { AgentDraftQueuePanel } from './agentDrafts/AgentDraftQueuePanel'
import { AgentDraftSafetyBanner } from './agentDrafts/AgentDraftSafetyBanner'
import { AgentDraftMetaPanel } from './agentDrafts/AgentDraftMetaPanel'
import { AgentDraftReviewInfo } from './agentDrafts/AgentDraftReviewInfo'
import { AgentDraftReviewActions } from './agentDrafts/AgentDraftReviewActions'
import { AgentDraftContextPreview } from './agentDrafts/AgentDraftContextPreview'
import { FormalHandoffSection } from './agentDrafts/FormalHandoffSection'
import { ManualAgentResponseSection } from './agentDrafts/ManualAgentResponseSection'
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
}: AgentDraftsDrawerProps) {
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
            <p className="mb-1 text-xs font-bold uppercase text-slate-500">Agent</p>
            <h2 className="text-xl font-semibold leading-tight" id="agent-drafts-title">
              Agent Drafts / Review Queue
            </h2>
          </div>
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            title="Close agent drafts"
            icon={<XMarkIcon className="h-4 w-4" />}
          >
            Close
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
              <div className="rounded-lg border border-slate-200 bg-white p-5 text-slate-500">Loading draft detail...</div>
            )}
            {detailError && <ErrorBlock title="Detail failed" message={detailError} />}
            {!isDetailLoading && !detailError && selectedDraft && (
              <div className="grid gap-4">
                <AgentDraftSafetyBanner />

                <AgentDraftMetaPanel draft={selectedDraft} />

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
              </div>
            )}
            {!isDetailLoading && !detailError && !selectedDraft && (
              <div className="rounded-lg border border-slate-200 bg-white p-5 text-slate-500">Select a draft to view its context.</div>
            )}
          </section>
        </div>
      </aside>
    </div>
  )
}
