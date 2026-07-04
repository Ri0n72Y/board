import type {
  AgentSuggestionDetail,
  RecordBody,
  RecordItem,
  RecordResponse,
} from '@labour-board/shared'
import { useTranslation } from 'react-i18next'
import { AgentSuggestionDetailPanel } from './AgentSuggestionDetailPanel'
import { ErrorBlock } from './ErrorBlock'

interface AgentSuggestionDetailSlotProps {
  selectedSuggestion: AgentSuggestionDetail | null
  isDetailLoading: boolean
  detailError: string | null
  records?: RecordResponse<RecordItem<RecordBody>>[]
  onOpenEditor?: (recordId: string, patchDescription: string) => void
}

export function AgentSuggestionDetailSlot({
  selectedSuggestion,
  isDetailLoading,
  detailError,
  records,
  onOpenEditor,
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
          onOpenEditor={onOpenEditor}
        />
      )}
    </>
  )
}
