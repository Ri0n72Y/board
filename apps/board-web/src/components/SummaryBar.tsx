import type { BoardCurrentProjection } from '@labour-board/shared'
import { Panel } from './ui/Panel'

interface SummaryBarProps {
  projection: BoardCurrentProjection
}

export function SummaryBar({ projection }: SummaryBarProps) {
  return (
    <Panel className="mt-4 overflow-hidden p-0" aria-label="Projection summary">
      <div className="grid sm:grid-cols-5">
        <SummaryItem
          label="Snapshot"
          value={String(projection.snapshotHeadVersion)}
        />
        <SummaryItem
          label="Visible"
          value={String(projection.summary.visibleCurrentRecords)}
        />
        <SummaryItem
          label="Base"
          value={String(projection.summary.totalBaseRecords)}
        />
        <SummaryItem
          label="Archived"
          value={String(projection.summary.archivedRecords)}
        />
        <SummaryItem
          label="Blocked"
          value={String(projection.summary.blockedRecords)}
        />
      </div>
    </Panel>
  )
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-0.5 border-b border-slate-200 p-3 last:border-b-0 sm:border-r sm:border-b-0 sm:last:border-r-0">
      <span className="text-xs font-bold uppercase text-slate-500">
        {label}
      </span>
      <strong className="text-xl text-slate-950">{value}</strong>
    </div>
  )
}
