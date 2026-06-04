interface EmptyStateProps {
  hasActiveFilters: boolean
  hasIssues: boolean
}

export function EmptyState({
  hasActiveFilters,
  hasIssues,
}: EmptyStateProps) {
  return (
    <section className="mt-4 grid gap-1.5 rounded-lg border border-slate-200 bg-white p-5 text-slate-500">
      <p>
        {hasActiveFilters
          ? 'No current records match these filters.'
          : 'The current board has no records.'}
      </p>
      {hasIssues && (
        <p>
          Projection issues are listed below and may explain missing records.
        </p>
      )}
    </section>
  )
}
