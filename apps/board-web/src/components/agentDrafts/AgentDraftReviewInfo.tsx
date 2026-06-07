import type { AgentDraftDetail } from '@labour-board/shared'
import { MetaItem } from './MetaItem'
import { formatDate } from './format'

interface AgentDraftReviewInfoProps {
  draft: AgentDraftDetail
}

export function AgentDraftReviewInfo({ draft }: AgentDraftReviewInfoProps) {
  if (!draft.reviewedAt) {
    return (
      <section className="grid gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
        <p>Not reviewed yet</p>
      </section>
    )
  }

  return (
    <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-5">
      <h3 className="text-sm font-semibold uppercase text-slate-500">Review Info</h3>
      <dl className="grid gap-2 sm:grid-cols-2">
        <MetaItem label="Reviewed at" value={formatDate(draft.reviewedAt)} />
        <MetaItem label="Reviewed by" value={draft.reviewedBy ?? 'unknown'} mono />
        <MetaItem label="Review note" value={draft.reviewNote || 'None'} />
      </dl>
    </section>
  )
}
