import type {
  AgentDraftDetail,
  AgentDraftStatus,
  AgentDraftSummary,
  AgentSuggestionDetail,
  AgentSuggestionStatus,
  AgentSuggestionSummary,
  RecordBody,
  RecordItem,
  RecordResponse,
} from '@labour-board/shared'
import { useTranslation } from 'react-i18next'
import { AnimatedDrawer } from './ui/AnimatedDrawer'
import { AgentDraftQueuePanel } from './agentDrafts/AgentDraftQueuePanel'
import { AgentDraftDetailWorkspace } from './agentDrafts/AgentDraftDetailWorkspace'

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
    reviewNote?: string
  ) => void
  // Agent Suggestion
  suggestions?: AgentSuggestionSummary[]
  selectedSuggestion?: AgentSuggestionDetail | null
  isSuggestionListLoading?: boolean
  isSuggestionDetailLoading?: boolean
  isSuggestionGenerating?: boolean
  isSuggestionReviewing?: boolean
  suggestionListError?: string | null
  suggestionDetailError?: string | null
  suggestionGenerateError?: string | null
  suggestionReviewError?: string | null
  onGenerateSuggestion?: (
    draftId: string,
    instruction?: string
  ) => void | Promise<unknown>
  onSelectSuggestion?: (suggestionId: string) => void
  onReviewSuggestion?: (
    suggestionId: string,
    status: AgentSuggestionStatus
  ) => void
  // Patch Draft
  records?: RecordResponse<RecordItem<RecordBody>>[]
  onOpenRecord?: (recordId: string, patchDescription: string) => void
  // Formal Handoff
  isHandoffLoading: boolean
  handoffError: string | null
  handoffFeedback: string | null
  onCopyHandoff: (draftId: string) => void
  onDownloadHandoff: (draftId: string) => void
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
  isSuggestionReviewing = false,
  suggestionListError = null,
  suggestionDetailError = null,
  suggestionGenerateError = null,
  suggestionReviewError = null,
  onGenerateSuggestion,
  onSelectSuggestion,
  onReviewSuggestion,
  // Patch Draft
  records,
  onOpenRecord,
  // Formal Handoff
  isHandoffLoading = false,
  handoffError = null,
  handoffFeedback = null,
  onCopyHandoff,
  onDownloadHandoff,
}: AgentDraftsDrawerProps) {
  const { t } = useTranslation()

  if (!open) return null

  const review = onUpdateReview
    ? { isReviewing, reviewError, onUpdateReview }
    : undefined
  const suggestion =
    onGenerateSuggestion && onSelectSuggestion && onReviewSuggestion
      ? {
          suggestions,
          selectedSuggestion,
          isListLoading: isSuggestionListLoading,
          isDetailLoading: isSuggestionDetailLoading,
          isGenerating: isSuggestionGenerating,
          isReviewing: isSuggestionReviewing,
          listError: suggestionListError,
          detailError: suggestionDetailError,
          generateError: suggestionGenerateError,
          reviewError: suggestionReviewError,
          onGenerate: onGenerateSuggestion,
          onSelectSuggestion,
          onReviewSuggestion,
        }
      : undefined
  const patchDraft = { records, onOpenRecord }
  const handoff = {
    isHandoffLoading,
    handoffError,
    handoffFeedback,
    onCopyHandoff,
    onDownloadHandoff,
  }

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

        <AgentDraftDetailWorkspace
          detail={{
            selectedDraft,
            isLoading: isDetailLoading,
            error: detailError,
          }}
          review={review}
          suggestion={suggestion}
          patchDraft={patchDraft}
          handoff={handoff}
        />
      </div>
    </AnimatedDrawer>
  )
}
