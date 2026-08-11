import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type {
  AgentSuggestionDetail,
  AgentSuggestionStatus,
  RecordBody,
  RecordItem,
  RecordResponse,
} from '@labour-board/shared'
import { Button } from '../ui/Button'
import { ConfirmDialog } from '../ui/ConfirmDialog'
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
  onOpenRecord?: (recordId: string, patchDescription: string) => void
  isReviewing: boolean
  reviewError: string | null
  onReviewSuggestion: (
    suggestionId: string,
    status: AgentSuggestionStatus
  ) => void
}

export function AgentSuggestionDetailPanel({
  suggestion,
  records,
  onOpenRecord,
  isReviewing,
  reviewError,
  onReviewSuggestion,
}: AgentSuggestionDetailPanelProps) {
  const { t } = useTranslation()
  const [isRejectConfirmOpen, setIsRejectConfirmOpen] = useState(false)

  if (!suggestion) return null

  const { id, status } = suggestion

  return (
    <div className="grid gap-4">
      <AgentSuggestionMetaBar suggestion={suggestion} />

      <div className="flex flex-wrap items-center gap-2">
        {status === 'generated' ? (
          <>
            <Button
              type="button"
              onClick={() => onReviewSuggestion(id, 'reviewed')}
              disabled={isReviewing}
            >
              {isReviewing
                ? t('agent.suggestions.updating')
                : t('agent.suggestions.accept')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsRejectConfirmOpen(true)}
              disabled={isReviewing}
            >
              {t('agent.suggestions.reject')}
            </Button>
          </>
        ) : (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
            {status === 'reviewed'
              ? t('agent.suggestions.accepted')
              : t('agent.suggestions.rejected')}
          </span>
        )}
        {reviewError && (
          <span className="text-xs text-red-600">{reviewError}</span>
        )}
      </div>

      <AgentSuggestionActions
        suggestionId={suggestion.id}
        markdown={suggestion.markdown}
      />

      <AgentSuggestionPatchDraftSection
        suggestion={suggestion}
        records={records}
        onOpenRecord={onOpenRecord}
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

      <ConfirmDialog
        open={isRejectConfirmOpen}
        title={t('agent.suggestions.rejectConfirmTitle')}
        message={t('agent.suggestions.rejectConfirmMessage')}
        confirmLabel={t('agent.suggestions.rejectConfirmAction')}
        cancelLabel={t('agent.review.cancel')}
        busy={isReviewing}
        onConfirm={() => {
          setIsRejectConfirmOpen(false)
          onReviewSuggestion(id, 'discarded')
        }}
        onCancel={() => setIsRejectConfirmOpen(false)}
      />
    </div>
  )
}
