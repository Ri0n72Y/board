import type { BoardCurrentProjection } from '@labour-board/shared'
import { useTranslation } from 'react-i18next'
import { Panel } from './ui/Panel'

interface SummaryBarProps {
  projection: BoardCurrentProjection
}

export function SummaryBar({ projection }: SummaryBarProps) {
  const { t } = useTranslation()

  return (
    <Panel className="mt-4 overflow-hidden p-0" aria-label="Projection summary">
      <div className="grid sm:grid-cols-5">
        <SummaryItem
          label={t('summary.snapshot')}
          value={String(projection.snapshotHeadVersion)}
        />
        <SummaryItem
          label={t('summary.visible')}
          value={String(projection.summary.visibleCurrentRecords)}
        />
        <SummaryItem
          label={t('summary.base')}
          value={String(projection.summary.totalBaseRecords)}
        />
        <SummaryItem
          label={t('summary.archived')}
          value={String(projection.summary.archivedRecords)}
        />
        <SummaryItem
          label={t('summary.blocked')}
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
