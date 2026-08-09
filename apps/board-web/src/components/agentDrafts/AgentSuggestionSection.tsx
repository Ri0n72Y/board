import type {
  AgentDraftDetail,
  AgentSuggestionDetail,
  AgentSuggestionStatus,
  AgentSuggestionSummary,
  RecordBody,
  RecordItem,
  RecordResponse,
} from '@labour-board/shared'
import { useTranslation } from 'react-i18next'
import { AgentSuggestionToolbar } from './AgentSuggestionToolbar'
import { AgentSuggestionList } from './AgentSuggestionList'
import { AgentSuggestionDetailSlot } from './AgentSuggestionDetailSlot'
import { ErrorBlock } from './ErrorBlock'

interface AgentSuggestionSectionProps {
  draft: AgentDraftDetail
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
  onSelectSuggestion: (id: string) => void
  onReviewSuggestion: (
    suggestionId: string,
    status: AgentSuggestionStatus
  ) => void
  records?: RecordResponse<RecordItem<RecordBody>>[]
  onOpenRecord?: (recordId: string, patchDescription: string) => void
}

export function AgentSuggestionSection({
  draft,
  suggestions,
  selectedSuggestion,
  isListLoading,
  isDetailLoading,
  isGenerating,
  isReviewing,
  listError,
  detailError,
  generateError,
  reviewError,
  onGenerate,
  onSelectSuggestion,
  onReviewSuggestion,
  records,
  onOpenRecord,
}: AgentSuggestionSectionProps) {
  const { t } = useTranslation()

  return (
    <div className="grid gap-3">
      <AgentSuggestionToolbar
        draft={draft}
        suggestionCount={suggestions.length}
        isGenerating={isGenerating}
        onGenerate={onGenerate}
      />

      {generateError && (
        <ErrorBlock
          title={t('agent.suggestions.generateFailed')}
          message={generateError}
        />
      )}

      <AgentSuggestionList
        suggestions={suggestions}
        selectedSuggestion={selectedSuggestion}
        isListLoading={isListLoading}
        listError={listError}
        onSelectSuggestion={onSelectSuggestion}
      />

      <AgentSuggestionDetailSlot
        selectedSuggestion={selectedSuggestion}
        isDetailLoading={isDetailLoading}
        detailError={detailError}
        isReviewing={isReviewing}
        reviewError={reviewError}
        onReviewSuggestion={onReviewSuggestion}
        records={records}
        onOpenRecord={onOpenRecord}
      />
    </div>
  )
}
