import { useEffect, useMemo } from 'react'
import type { Tag } from '@labour-board/shared'
import { ArrowPathIcon } from '@heroicons/react/20/solid'
import { Button } from '../components/ui/Button'
import { BoardFilters } from '../components/BoardFilters'
import { EmptyState } from '../components/EmptyState'
import { IssuesPanel } from '../components/IssuesPanel'
import { RecordCard } from '../components/RecordCard'
import { StatusBadge } from '../components/StatusBadge'
import { SummaryBar } from '../components/SummaryBar'
import { useBoardCurrentStore } from '../stores/boardCurrentStore'

export function BoardCurrentPage() {
  const filters = useBoardCurrentStore((state) => state.filters)
  const projection = useBoardCurrentStore((state) => state.projection)
  const isLoading = useBoardCurrentStore((state) => state.isLoading)
  const error = useBoardCurrentStore((state) => state.error)
  const setQ = useBoardCurrentStore((state) => state.setQ)
  const addTag = useBoardCurrentStore((state) => state.addTag)
  const removeTag = useBoardCurrentStore((state) => state.removeTag)
  const setTagMatch = useBoardCurrentStore((state) => state.setTagMatch)
  const setIncludeArchived = useBoardCurrentStore(
    (state) => state.setIncludeArchived
  )
  const setAssignee = useBoardCurrentStore((state) => state.setAssignee)
  const setAssetId = useBoardCurrentStore((state) => state.setAssetId)
  const setRelationTarget = useBoardCurrentStore(
    (state) => state.setRelationTarget
  )
  const loadCurrentBoard = useBoardCurrentStore(
    (state) => state.loadCurrentBoard
  )

  useEffect(() => {
    const controller = new AbortController()
    void loadCurrentBoard(controller.signal)
    return () => controller.abort()
  }, [filters, loadCurrentBoard])

  const knownTags = useMemo(() => {
    const values = new Set<Tag>()
    for (const record of projection?.records ?? []) {
      for (const tag of record.body.tags) {
        values.add(tag)
      }
    }
    return [...values].sort()
  }, [projection])

  const records = projection?.records ?? []
  const blockedRecords = projection?.blockedRecords ?? []
  const diagnostics = projection?.diagnostics ?? []
  const hasActiveFilters =
    filters.q.trim().length > 0 ||
    filters.tags.length > 0 ||
    filters.assignee.trim().length > 0 ||
    filters.assetId.trim().length > 0 ||
    filters.relationTarget.trim().length > 0

  return (
    <main className="mx-auto min-h-svh w-full max-w-[1180px] bg-stone-50 px-4 py-5 text-slate-950 sm:px-7 sm:py-7">
      <header className="mb-5 grid gap-4 sm:flex sm:items-start sm:justify-between">
        <div>
          <p className="mb-1 text-xs font-bold uppercase text-slate-500">
            Current board
          </p>
          <h1 className="text-3xl font-bold leading-tight text-slate-950">
            LabourBoard
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <StatusBadge status={projection?.summary.projectionStatus} />
          <Button
            type="button"
            onClick={() => void loadCurrentBoard()}
            disabled={isLoading}
            icon={<ArrowPathIcon className={isLoading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />}
          >
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
      </header>

      <BoardFilters
        q={filters.q}
        tags={filters.tags}
        tagMatch={filters.tagMatch}
        includeArchived={filters.includeArchived}
        assignee={filters.assignee}
        assetId={filters.assetId}
        relationTarget={filters.relationTarget}
        knownTags={knownTags}
        onQChange={setQ}
        onAddTag={addTag}
        onRemoveTag={removeTag}
        onTagMatchChange={setTagMatch}
        onIncludeArchivedChange={setIncludeArchived}
        onAssigneeChange={setAssignee}
        onAssetIdChange={setAssetId}
        onRelationTargetChange={setRelationTarget}
      />

      {projection && <SummaryBar projection={projection} />}

      {error && (
        <section
          className="mt-4 grid gap-1.5 rounded-lg border border-red-200 bg-red-50 p-5 text-red-800"
          role="alert"
        >
          <strong>Failed to load current board</strong>
          <span>{error}</span>
        </section>
      )}

      {!error && isLoading && !projection && (
        <section className="mt-4 rounded-lg border border-slate-200 bg-white p-5 text-slate-500">
          Loading current board...
        </section>
      )}

      {!error && projection && records.length === 0 && (
        <EmptyState
          hasActiveFilters={hasActiveFilters}
          hasProjectionIssues={blockedRecords.length > 0 || diagnostics.length > 0}
        />
      )}

      {records.length > 0 && (
        <section className="mt-4 grid gap-3.5" aria-label="Current records">
          {records.map((record) => (
            <RecordCard key={record.body.id} record={record} />
          ))}
        </section>
      )}

      <IssuesPanel blockedRecords={blockedRecords} diagnostics={diagnostics} />
    </main>
  )
}
