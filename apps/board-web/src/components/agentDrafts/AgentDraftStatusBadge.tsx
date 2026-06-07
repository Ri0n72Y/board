import type { AgentDraftStatus } from '@labour-board/shared'

export function AgentDraftStatusBadge({ status }: { status: AgentDraftStatus }) {
  const colors: Record<AgentDraftStatus, string> = {
    draft: 'bg-slate-200 text-slate-700',
    reviewed: 'bg-emerald-200 text-emerald-800',
    discarded: 'bg-red-200 text-red-800',
  }
  return (
    <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-semibold uppercase ${colors[status]}`}>
      {status}
    </span>
  )
}
