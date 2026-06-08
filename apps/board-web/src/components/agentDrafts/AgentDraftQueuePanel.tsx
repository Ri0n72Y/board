import { useMemo, useState } from 'react'
import type { AgentDraftStatus, AgentDraftSummary } from '@labour-board/shared'
import { ArrowPathIcon } from '@heroicons/react/20/solid'
import { useTranslation } from 'react-i18next'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { AgentDraftStatusBadge } from './AgentDraftStatusBadge'
import { ErrorBlock } from './ErrorBlock'
import { formatDate } from './format'

type StatusFilter = 'all' | AgentDraftStatus

interface AgentDraftQueuePanelProps {
  drafts: AgentDraftSummary[]
  selectedDraftId: string | null
  isListLoading: boolean
  isCreating: boolean
  listError: string | null
  createError: string | null
  onSelectDraft: (draftId: string) => void
  onRefreshList: () => void
}

export function AgentDraftQueuePanel({
  drafts,
  selectedDraftId,
  isListLoading,
  isCreating,
  listError,
  createError,
  onSelectDraft,
  onRefreshList,
}: AgentDraftQueuePanelProps) {
  const { t } = useTranslation()
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const statusFilters: { value: StatusFilter; label: string }[] = useMemo(
    () => [
      { value: 'all', label: t('agent.queue.all') },
      { value: 'draft', label: t('agent.status.draft') },
      { value: 'reviewed', label: t('agent.status.reviewed') },
      { value: 'discarded', label: t('agent.status.discarded') },
    ],
    [t],
  )

  const filteredDrafts = useMemo(
    () =>
      statusFilter === 'all'
        ? drafts
        : drafts.filter((d) => d.status === statusFilter),
    [drafts, statusFilter],
  )

  return (
    <section className="grid content-start gap-4">
      <div className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold uppercase text-slate-500">
            {t('agent.queue.title')}
          </h3>
          <Button
            type="button"
            variant="ghost"
            className="min-h-8 px-2.5 text-xs"
            onClick={onRefreshList}
            disabled={isListLoading}
            icon={<ArrowPathIcon className={isListLoading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />}
          >
            {t('agent.queue.refresh')}
          </Button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {statusFilters.map((f) => (
            <button
              key={f.value}
              type="button"
              className={
                statusFilter === f.value
                  ? 'rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white'
                  : 'rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200'
              }
              onClick={() => setStatusFilter(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>

        {createError && <ErrorBlock title={t('agent.queue.createFailed')} message={createError} />}
        {listError && <ErrorBlock title={t('agent.queue.listFailed')} message={listError} />}

        {isCreating && (
          <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
            {t('agent.queue.creating')}
          </p>
        )}
        {isListLoading && (
          <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
            {t('agent.queue.loading')}
          </p>
        )}

        {!isListLoading && filteredDrafts.length === 0 && (
          <div className="grid gap-2 rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-sm text-slate-500">
            <p>
              {statusFilter === 'all'
                ? t('agent.queue.empty')
                : t('agent.queue.emptyFilter', { status: statusFilter })}
            </p>
            <p className="text-xs">{t('agent.queue.emptyHint')}</p>
          </div>
        )}

        {filteredDrafts.length > 0 && (
          <ol className="grid gap-2">
            {filteredDrafts.map((draft) => (
              <li key={draft.id}>
                <button
                  type="button"
                  className={
                    selectedDraftId === draft.id
                      ? 'grid w-full gap-1.5 rounded-md border border-emerald-500 bg-emerald-50 px-3 py-2 text-left'
                      : 'grid w-full gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-left hover:border-emerald-500'
                  }
                  onClick={() => onSelectDraft(draft.id)}
                >
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-950">{draft.title}</span>
                    <AgentDraftStatusBadge status={draft.status} />
                  </span>
                  {draft.contextGoal && (
                    <span className="wrap-break-word text-xs text-slate-600">{draft.contextGoal}</span>
                  )}
                  <span className="flex flex-wrap items-center gap-1.5">
                    <Badge>{draft.profile}</Badge>
                    <Badge>{draft.source}</Badge>
                    <Badge>{draft.recordCount.toString()} {t('agent.queue.records')}</Badge>
                  </span>
                  <span className="text-xs text-slate-400">{formatDate(draft.createdAt)}</span>
                </button>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  )
}
