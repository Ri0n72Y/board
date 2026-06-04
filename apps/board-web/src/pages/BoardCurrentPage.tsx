import { useEffect, useMemo } from 'react'
import { ArrowPathIcon, ExclamationTriangleIcon } from '@heroicons/react/20/solid'
import { Button } from '../components/ui/Button'
import { BoardFilters } from '../components/BoardFilters'
import { EmptyState } from '../components/EmptyState'
import { IssuesPanel } from '../components/IssuesPanel'
import { RecordCard } from '../components/RecordCard'
import { StatusBadge } from '../components/StatusBadge'
import { SummaryBar } from '../components/SummaryBar'
import { useBoardCurrentStore } from '../stores/boardCurrentStore'
import { extractKnownTags, hasEffectiveFilters } from '../utils/board'
import { useDebouncedValue } from '../utils/useDebounce'

const Q_DEBOUNCE_MS = 300

export function BoardCurrentPage() {
  /* ── Store ── */
  const draftFilters = useBoardCurrentStore((s) => s.filters)
  const lastAppliedFilters = useBoardCurrentStore((s) => s.lastAppliedFilters)
  const projection = useBoardCurrentStore((s) => s.projection)
  const isLoading = useBoardCurrentStore((s) => s.isLoading)
  const error = useBoardCurrentStore((s) => s.error)

  const setQ = useBoardCurrentStore((s) => s.setQ)
  const addTag = useBoardCurrentStore((s) => s.addTag)
  const removeTag = useBoardCurrentStore((s) => s.removeTag)
  const setTagMatch = useBoardCurrentStore((s) => s.setTagMatch)
  const setIncludeArchived = useBoardCurrentStore((s) => s.setIncludeArchived)
  const setAssignee = useBoardCurrentStore((s) => s.setAssignee)
  const setAssetId = useBoardCurrentStore((s) => s.setAssetId)
  const setRelationTarget = useBoardCurrentStore((s) => s.setRelationTarget)
  const loadCurrentBoard = useBoardCurrentStore((s) => s.loadCurrentBoard)

  /* ── Effective filters (debounced q) ── */
  const debouncedQ = useDebouncedValue(draftFilters.q, Q_DEBOUNCE_MS)

  const effectiveFilters = useMemo(
    () => ({
      q: debouncedQ,
      tags: draftFilters.tags,
      tagMatch: draftFilters.tagMatch,
      includeArchived: draftFilters.includeArchived,
      assignee: draftFilters.assignee,
      assetId: draftFilters.assetId,
      relationTarget: draftFilters.relationTarget,
    }),
    [
      debouncedQ,
      draftFilters.tags,
      draftFilters.tagMatch,
      draftFilters.includeArchived,
      draftFilters.assignee,
      draftFilters.assetId,
      draftFilters.relationTarget,
    ],
  )

  /* ── Auto-load on effective filter change ── */
  useEffect(() => {
    const controller = new AbortController()
    void loadCurrentBoard(effectiveFilters, controller.signal)
    return () => controller.abort()
  }, [effectiveFilters, loadCurrentBoard])

  /* ── Derived data ── */
  const knownTags = useMemo(() => extractKnownTags(projection), [projection])
  const records = projection?.records ?? []
  const blockedRecords = projection?.blockedRecords ?? []
  const diagnostics = projection?.diagnostics ?? []
  const projectionStatus = projection?.summary.projectionStatus

  // "applied" filters = what produced the current projection (or effective if never loaded)
  const appliedFilters = lastAppliedFilters ?? effectiveFilters
  const active = hasEffectiveFilters(appliedFilters)
  const hasIssues = blockedRecords.length > 0 || (diagnostics?.length ?? 0) > 0
  const isInitialLoad = !projection && isLoading && !error
  const isInitialError = !projection && error
  const isRefreshError = projection && error

  /* ── Render helpers ── */
  function refresh() {
    void loadCurrentBoard(effectiveFilters)
  }

  /* ── Render ── */
  return (
    <main className="mx-auto min-h-svh w-full max-w-[1180px] bg-stone-50 px-4 py-5 text-slate-950 sm:px-7 sm:py-7">
      {/* Header */}
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
          <StatusBadge status={projectionStatus} />
          <Button
            type="button"
            onClick={refresh}
            disabled={isLoading}
            icon={
              <ArrowPathIcon
                className={isLoading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'}
              />
            }
          >
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
      </header>

      {/* Filters (always show draft values) */}
      <BoardFilters
        q={draftFilters.q}
        tags={draftFilters.tags}
        tagMatch={draftFilters.tagMatch}
        includeArchived={draftFilters.includeArchived}
        assignee={draftFilters.assignee}
        assetId={draftFilters.assetId}
        relationTarget={draftFilters.relationTarget}
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

      {/* Summary (shown once we have a projection) */}
      {projection && <SummaryBar projection={projection} />}

      {/* ── Error states ── */}
      {isInitialError && (
        <section
          className="mt-4 grid gap-1.5 rounded-lg border-2 border-red-300 bg-red-50 p-5 text-red-800"
          role="alert"
        >
          <strong>Failed to load current board</strong>
          <span>{error}</span>
        </section>
      )}

      {isRefreshError && (
        <section
          className="mt-4 grid gap-1.5 rounded-lg border border-amber-300 bg-amber-50 p-5 text-amber-900"
          role="alert"
        >
          <strong>Refresh failed — showing stale data</strong>
          <span>{error}</span>
        </section>
      )}

      {/* ── Loading states ── */}
      {isInitialLoad && (
        <section className="mt-4 rounded-lg border border-slate-200 bg-white p-5 text-slate-500">
          Loading current board…
        </section>
      )}

      {/* ── Partial projection warning ── */}
      {projectionStatus === 'partial' && !error && (
        <section
          className="mt-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900"
          role="alert"
        >
          <ExclamationTriangleIcon className="h-5 w-5 shrink-0" />
          <span className="text-sm font-medium">
            Projection is partial — some records may be missing.
          </span>
        </section>
      )}

      {/* ── Projection health: blocked ── */}
      {projectionStatus === 'blocked' && !error && (
        <section
          className="mt-4 grid gap-2 rounded-lg border-2 border-red-300 bg-red-50 p-5 text-red-800"
          role="alert"
        >
          <p className="flex items-center gap-2 font-semibold">
            <ExclamationTriangleIcon className="h-5 w-5" />
            Projection blocked
          </p>
          <p>
            {active
              ? 'The current board projection is blocked — no records match these filters.'
              : 'The current board projection is blocked — no records can be shown.'}
          </p>
          {hasIssues && <p>See projection issues below for details.</p>}
        </section>
      )}

      {/* ── Empty / filtered-empty (non-blocked only) ── */}
      {!error && projection && projectionStatus !== 'blocked' && records.length === 0 && (
        <EmptyState
          hasActiveFilters={active}
          hasIssues={hasIssues}
        />
      )}

      {/* ── Records (non-blocked only) ── */}
      {!error && projectionStatus !== 'blocked' && records.length > 0 && (
        <section className="mt-4 grid gap-3.5" aria-label="Current records">
          {records.map((record) => (
            <RecordCard key={record.body.id} record={record} />
          ))}
        </section>
      )}

      {/* ── Issues (always shown when content exists, regardless of status) ── */}
      <IssuesPanel blockedRecords={blockedRecords} diagnostics={diagnostics} />
    </main>
  )
}
