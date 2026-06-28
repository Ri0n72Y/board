import type { BoardCurrentProjection } from '@labour-board/shared'
import { useTranslation } from 'react-i18next'
import { Panel } from './ui/Panel'
import { cn } from '../lib/cn'

interface SummaryBarProps {
  projection: BoardCurrentProjection
  compact?: boolean
}

export function SummaryBar({ projection, compact = false }: SummaryBarProps) {
  const { t } = useTranslation()

  return (
    <Panel
      className={cn(
        compact ? 'mt-3 overflow-hidden p-0' : 'mt-4 overflow-hidden p-0'
      )}
      aria-label="Projection summary"
    >
      <div className={cn('grid', compact ? 'grid-cols-2' : 'sm:grid-cols-5')}>
        <SummaryItem
          label={t('summary.snapshot')}
          value={String(projection.snapshotHeadVersion)}
          compact={compact}
        />
        <SummaryItem
          label={t('summary.visible')}
          value={String(projection.summary.visibleCurrentRecords)}
          compact={compact}
        />
        <SummaryItem
          label={t('summary.base')}
          value={String(projection.summary.totalBaseRecords)}
          compact={compact}
        />
        <SummaryItem
          label={t('summary.archived')}
          value={String(projection.summary.archivedRecords)}
          compact={compact}
        />
        <SummaryItem
          label={t('summary.blocked')}
          value={String(projection.summary.blockedRecords)}
          compact={compact}
        />
      </div>
    </Panel>
  )
}

function SummaryItem({
  label,
  value,
  compact,
}: {
  label: string
  value: string
  compact: boolean
}) {
  return (
    <div className="grid gap-0.5 border-b border-slate-200 p-3 last:border-b-0 sm:border-r sm:border-b-0 sm:last:border-r-0">
      <span className="text-xs font-bold uppercase text-slate-500">
        {label}
      </span>
      <strong
        className={cn(compact ? 'text-base' : 'text-xl', 'text-slate-950')}
      >
        {value}
      </strong>
    </div>
  )
}
