import type {
  AgentDraftDetail,
  AgentSuggestionDetail,
  AgentSuggestionSummary,
  RecordBody,
  RecordItem,
  RecordResponse,
} from '@labour-board/shared'
import { AgentSuggestionToolbar } from './AgentSuggestionToolbar'
import { AgentSuggestionList } from './AgentSuggestionList'
import { AgentSuggestionDetailSlot } from './AgentSuggestionDetailSlot'

interface AgentSuggestionSectionProps {
  draft: AgentDraftDetail
  suggestions: AgentSuggestionSummary[]
  selectedSuggestion: AgentSuggestionDetail | null
  isListLoading: boolean
  isDetailLoading: boolean
  isGenerating: boolean
  listError: string | null
  detailError: string | null
  generateError: string | null
  onGenerate: (draftId: string, instruction?: string) => void | Promise<unknown>
  onSelectSuggestion: (id: string) => void
  records?: RecordResponse<RecordItem<RecordBody>>[]
  onOpenEditor?: (recordId: string, patchDescription: string) => void
}

export function AgentSuggestionSection({
  draft,
  suggestions,
  selectedSuggestion,
  isListLoading,
  isDetailLoading,
  isGenerating,
  listError,
  detailError,
  generateError,
  onGenerate,
  onSelectSuggestion,
  records,
  onOpenEditor,
}: AgentSuggestionSectionProps) {
  return (
    <div className="grid gap-3">
      <AgentSuggestionToolbar
        draft={draft}
        suggestionCount={suggestions.length}
        isGenerating={isGenerating}
        generateError={generateError}
        onGenerate={onGenerate}
      />

      <AgentSuggestionList
        suggestions={suggestions}
        selectedSuggestionId={selectedSuggestion?.id ?? null}
        isListLoading={isListLoading}
        listError={listError}
        onSelectSuggestion={onSelectSuggestion}
      />

      <AgentSuggestionDetailSlot
        selectedSuggestion={selectedSuggestion}
        isDetailLoading={isDetailLoading}
        detailError={detailError}
        records={records}
        onOpenEditor={onOpenEditor}
      />
    </div>
  )
}
