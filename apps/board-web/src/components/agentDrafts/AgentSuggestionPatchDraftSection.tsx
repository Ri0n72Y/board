import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type {
  AgentSuggestionDetail,
  RecordBody,
  RecordItem,
  RecordResponse,
} from '@labour-board/shared'
import { Button } from '../ui/Button'
import { AgentPatchDraftPanel } from './AgentPatchDraftPanel'
import { canCreatePatchDraft } from '../../utils/agentPatchDraft'

interface AgentSuggestionPatchDraftSectionProps {
  suggestion: AgentSuggestionDetail
  records?: RecordResponse<RecordItem<RecordBody>>[]
  onOpenRecord?: (recordId: string, patchDescription: string) => void
}

export function AgentSuggestionPatchDraftSection({
  suggestion,
  records,
  onOpenRecord,
}: AgentSuggestionPatchDraftSectionProps) {
  const { t } = useTranslation()
  const [showPatchDraft, setShowPatchDraft] = useState(false)

  if (!records || !onOpenRecord || !canCreatePatchDraft(suggestion)) return null

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-4 py-2 text-xs font-semibold uppercase text-slate-500">
        {t('agent.patchDraft.title')}
      </div>
      <div className="px-4 py-3">
        {!showPatchDraft ? (
          <Button
            type="button"
            variant="default"
            onClick={() => setShowPatchDraft(true)}
          >
            {t('agent.patchDraft.createButton')}
          </Button>
        ) : (
          <AgentPatchDraftPanel
            key={suggestion.id}
            suggestionId={suggestion.id}
            suggestionTitle={suggestion.title}
            suggestionMarkdown={suggestion.markdown}
            records={records}
            onOpenRecord={onOpenRecord}
            onClose={() => setShowPatchDraft(false)}
          />
        )}
      </div>
    </div>
  )
}
