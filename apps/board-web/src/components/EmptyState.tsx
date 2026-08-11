import { useTranslation } from 'react-i18next'
import { Button } from './ui/Button'
import { PlusIcon } from '@heroicons/react/20/solid'

interface EmptyStateProps {
  hasActiveFilters: boolean
  hasIssues: boolean
  onCreate?: () => void
}

export function EmptyState({
  hasActiveFilters,
  hasIssues,
  onCreate,
}: EmptyStateProps) {
  const { t } = useTranslation()

  // First-use guidance only applies to a truly empty board: no filters, no
  // projection issues. Everything else falls back to the plain empty copy.
  const isFirstUse = !hasActiveFilters && !hasIssues && Boolean(onCreate)

  if (isFirstUse) {
    return (
      <section className="mt-4 grid justify-items-center gap-3 rounded-lg border-2 border-dashed border-emerald-200 bg-emerald-50/40 p-10 text-center">
        <h2 className="text-base font-semibold text-slate-950">
          {t('empty.firstUseTitle')}
        </h2>
        <p className="max-w-sm text-sm text-slate-500">
          {t('empty.firstUseDescription')}
        </p>
        <Button
          type="button"
          onClick={onCreate}
          icon={<PlusIcon className="h-4 w-4" />}
          className="mt-1"
        >
          {t('empty.createFirstRecord')}
        </Button>
      </section>
    )
  }

  return (
    <section className="mt-4 grid gap-1.5 rounded-lg border border-slate-200 bg-white p-5 text-slate-500">
      <p>{hasActiveFilters ? t('status.emptyFiltered') : t('status.empty')}</p>
      {hasIssues && <p>{t('status.projectionIssuesHint')}</p>}
    </section>
  )
}
