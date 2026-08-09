import type {
  AgentSuggestionDetail,
  AgentSuggestionStatus,
  RecordBody,
  RecordItem,
  RecordResponse,
} from '@labour-board/shared'
import { useTranslation } from 'react-i18next'
import { ErrorBlock } from './ErrorBlock'
import { AgentSuggestionDetailPanel } from './AgentSuggestionDetailPanel'

interface AgentSuggestionDetailSlotProps {
  selectedSuggestion: AgentSuggestionDetail | null
  isDetailLoading: boolean
  detailError: string | null
  isReviewing: boolean
  reviewError: string | null
  records?: RecordResponse<RecordItem<RecordBody>>[]
  onOpenRecord?: (recordId: string, patchDescription: string) => void
  onReviewSuggestion: (
    suggestionId: string,
    status: AgentSuggestionStatus
  ) => void
}

export function AgentSuggestionDetailSlot({
  selectedSuggestion,
  isDetailLoading,
  detailError,
  isReviewing,
  reviewError,
  records,
  onOpenRecord,
  onReviewSuggestion,
}: AgentSuggestionDetailSlotProps) {
  const { t } = useTranslation()

  return (
    <>
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
          onOpenRecord={onOpenRecord}
          isReviewing={isReviewing}
          reviewError={reviewError}
          onReviewSuggestion={onReviewSuggestion}
        />
      )}
    </>
  )
}
