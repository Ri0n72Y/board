import { useState, useEffect } from 'react'
import type { AgentDraftDetail, AgentDraftStatus } from '@labour-board/shared'
import { ArrowPathIcon } from '@heroicons/react/20/solid'
import { useTranslation } from 'react-i18next'
import { Button } from '../ui/Button'
import { ErrorBlock } from './ErrorBlock'

interface AgentDraftReviewActionsProps {
  draft: AgentDraftDetail
  isReviewing: boolean
  reviewError: string | null
  onUpdateReview: (
    draftId: string,
    status: AgentDraftStatus,
    reviewNote?: string
  ) => void
}

export function AgentDraftReviewActions({
  draft,
  isReviewing,
  reviewError,
  onUpdateReview,
}: AgentDraftReviewActionsProps) {
  const { t } = useTranslation()
  const [reviewNote, setReviewNote] = useState(draft.reviewNote ?? '')

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional sync on key change
    setReviewNote(draft.reviewNote ?? '')
  }, [draft.id, draft.reviewNote])

  return (
    <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-5">
      <h3 className="text-sm font-semibold uppercase text-slate-500">
        {t('agent.review.title')}
      </h3>
      <label className="grid gap-1.5 text-xs font-bold text-slate-500">
        {t('agent.review.note')}
        <textarea
          className="min-h-20 resize-y rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
          value={reviewNote}
          onChange={(event) => setReviewNote(event.target.value)}
          placeholder={t('agent.review.notePlaceholder')}
        />
      </label>
      {reviewError && (
        <ErrorBlock
          title={t('agent.review.updateFailed')}
          message={reviewError}
        />
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          disabled={isReviewing}
          onClick={() =>
            onUpdateReview(draft.id, 'reviewed', reviewNote.trim() || undefined)
          }
          icon={
            isReviewing ? (
              <ArrowPathIcon className="h-4 w-4 animate-spin" />
            ) : undefined
          }
        >
          {isReviewing
            ? t('agent.review.saving')
            : t('agent.review.markReviewed')}
        </Button>
        <Button
          type="button"
          disabled={isReviewing}
          onClick={() =>
            onUpdateReview(
              draft.id,
              'discarded',
              reviewNote.trim() || undefined
            )
          }
        >
          {t('agent.review.markDiscarded')}
        </Button>
        {draft.status !== 'draft' && (
          <Button
            type="button"
            disabled={isReviewing}
            onClick={() =>
              onUpdateReview(draft.id, 'draft', reviewNote.trim() || undefined)
            }
          >
            {t('agent.review.resetToDraft')}
          </Button>
        )}
      </div>
    </section>
  )
}
