import { useTranslation } from 'react-i18next'

interface EmptyStateProps {
  hasActiveFilters: boolean
  hasIssues: boolean
}

export function EmptyState({
  hasActiveFilters,
  hasIssues,
}: EmptyStateProps) {
  const { t } = useTranslation()

  return (
    <section className="mt-4 grid gap-1.5 rounded-lg border border-slate-200 bg-white p-5 text-slate-500">
      <p>
        {hasActiveFilters
          ? t('status.emptyFiltered')
          : t('status.empty')}
      </p>
      {hasIssues && (
        <p>
          {t('status.projectionIssuesHint')}
        </p>
      )}
    </section>
  )
}
