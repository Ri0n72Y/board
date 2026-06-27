import type {
  AgentDraftDetail,
  AgentDraftStatus,
  AgentDraftSummary,
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
  onSelectDraft: (draftId: string) => void
  onRefreshList: () => void
  onClose: () => void
  onUpdateReview?: (
    draftId: string,
    status: AgentDraftStatus,
    reviewNote?: string,
  ) => void
  // Agent Suggestion
  suggestions?: AgentSuggestionSummary[]
  selectedSuggestion?: AgentSuggestionDetail | null
  isSuggestionListLoading?: boolean
  isSuggestionDetailLoading?: boolean
  isSuggestionGenerating?: boolean
  suggestionListError?: string | null
  suggestionDetailError?: string | null
  suggestionGenerateError?: string | null
  onGenerateSuggestion?: (
    draftId: string,
    instruction?: string,
  ) => void | Promise<unknown>
  onSelectSuggestion?: (suggestionId: string) => void
  // Patch Draft
  records?: RecordResponse<RecordItem<RecordBody>>[]
  onOpenEditor?: (recordId: string, patchDescription: string) => void
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
  onSelectDraft,
  onRefreshList,
  onClose,
  onUpdateReview,
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
  // Patch Draft
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

              <AgentDraftMetaPanel key={`draft-meta:${selectedDraft.id}`} draft={selectedDraft} />

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
            <div className="rounded-lg border border-slate-200 bg-white p-5 text-slate-500">{t('agent.selectHint')}</div>
          )}
        </section>
      </div>
    </AnimatedDrawer>
  )
}
