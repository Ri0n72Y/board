import type { AgentDraftStatus } from '@labour-board/shared'
import { useTranslation } from 'react-i18next'

export function AgentDraftStatusBadge({ status }: { status: AgentDraftStatus }) {
  const { t } = useTranslation()

  const colors: Record<AgentDraftStatus, string> = {
    draft: 'bg-slate-200 text-slate-700',
    reviewed: 'bg-emerald-200 text-emerald-800',
    discarded: 'bg-red-200 text-red-800',
  }
  return (
    <span className={`inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-semibold uppercase ${colors[status]}`}>
      {t(`agent.status.${status}`)}
    </span>
  )
}
