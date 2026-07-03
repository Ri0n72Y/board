import type { AgentDraftDetail } from '@labour-board/shared'
import { useTranslation } from 'react-i18next'
import { MetaItem } from './MetaItem'
import { formatDate } from './format'

interface AgentDraftReviewInfoProps {
  draft: AgentDraftDetail
}

export function AgentDraftReviewInfo({ draft }: AgentDraftReviewInfoProps) {
  const { t } = useTranslation()

  if (!draft.reviewedAt) {
    return (
      <section className="grid gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
        <p>{t('agent.reviewInfo.notReviewed')}</p>
      </section>
    )
  }

  return (
    <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-5">
      <h3 className="text-sm font-semibold uppercase text-slate-500">
        {t('agent.reviewInfo.title')}
      </h3>
      <dl className="grid gap-2 sm:grid-cols-2">
        <MetaItem
          label={t('agent.reviewInfo.reviewedAt')}
          value={formatDate(draft.reviewedAt)}
        />
        <MetaItem
          label={t('agent.reviewInfo.reviewedBy')}
          value={draft.reviewedBy ?? t('agent.reviewInfo.unknown')}
          mono
        />
        <MetaItem
          label={t('agent.reviewInfo.reviewNote')}
          value={draft.reviewNote || t('agent.meta.none')}
        />
      </dl>
    </section>
  )
}
