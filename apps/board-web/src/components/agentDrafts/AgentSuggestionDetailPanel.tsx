import { useTranslation } from 'react-i18next'
import type {
  AgentSuggestionDetail,
  RecordBody,
  RecordItem,
  RecordResponse,
} from '@labour-board/shared'
import { MarkdownPreview } from '../ui/MarkdownPreview'
import { AgentSuggestionMetaBar } from './AgentSuggestionMetaBar'
import { AgentSuggestionActions } from './AgentSuggestionActions'
import { AgentSuggestionPatchDraftSection } from './AgentSuggestionPatchDraftSection'
import { AgentSuggestionSkillsPanel } from './AgentSuggestionSkillsPanel'
import { AgentSuggestionAuditPanel } from './AgentSuggestionAuditPanel'
import { AgentSuggestionDiagnosticsPanel } from './AgentSuggestionDiagnosticsPanel'

interface AgentSuggestionDetailPanelProps {
  suggestion: AgentSuggestionDetail | null
  records?: RecordResponse<RecordItem<RecordBody>>[]
  onOpenEditor?: (recordId: string, patchDescription: string) => void
}

export function AgentSuggestionDetailPanel({
  suggestion,
  records,
  onOpenEditor,
}: AgentSuggestionDetailPanelProps) {
  const { t } = useTranslation()

  if (!suggestion) return null

  return (
    <div className="grid gap-4">
      <AgentSuggestionMetaBar suggestion={suggestion} />

      <AgentSuggestionActions
        suggestionId={suggestion.id}
        markdown={suggestion.markdown}
      />

      <AgentSuggestionPatchDraftSection
        suggestion={suggestion}
        records={records}
        onOpenEditor={onOpenEditor}
      />

      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-2 text-xs font-semibold uppercase text-slate-500">
          {t('agent.suggestions.fullSuggestion')}
        </div>
        <div className="p-4">
          <MarkdownPreview
            content={suggestion.markdown}
            maxHeight="max-h-[60vh]"
            emptyMessage={t('agent.suggestions.emptyMarkdown')}
          />
        </div>
      </div>

      <AgentSuggestionSkillsPanel skillSnapshots={suggestion.skillSnapshots} />

      <AgentSuggestionAuditPanel audit={suggestion.audit} />

      <AgentSuggestionDiagnosticsPanel
        suggestionId={suggestion.id}
        diagnostics={suggestion.diagnostics}
      />
    </div>
  )
}
