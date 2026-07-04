import type { AgentSuggestionSummary } from '@labour-board/shared'
import { useTranslation } from 'react-i18next'
import { AgentSuggestionCard } from './AgentSuggestionCard'
import { ErrorBlock } from './ErrorBlock'

interface AgentSuggestionListProps {
  suggestions: AgentSuggestionSummary[]
  selectedSuggestionId: string | null
  isListLoading: boolean
  listError: string | null
  onSelectSuggestion: (id: string) => void
}

export function AgentSuggestionList({
  suggestions,
  selectedSuggestionId,
  isListLoading,
  listError,
  onSelectSuggestion,
}: AgentSuggestionListProps) {
  const { t } = useTranslation()

  return (
    <>
      {isListLoading && (
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500">
          {t('agent.suggestions.loadingList')}
        </div>
      )}

      {listError && (
        <ErrorBlock
          title={t('agent.suggestions.listFailed')}
          message={listError}
        />
      )}

      {!isListLoading && !listError && suggestions.length === 0 && (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
          {t('agent.suggestions.empty')}
        </div>
      )}

      {!isListLoading && !listError && suggestions.length > 0 && (
        <div className="grid gap-2">
          {suggestions.map((s) => (
            <AgentSuggestionCard
              key={s.id}
              suggestion={s}
              isSelected={selectedSuggestionId === s.id}
              onSelect={onSelectSuggestion}
            />
          ))}
        </div>
      )}
    </>
  )
}
