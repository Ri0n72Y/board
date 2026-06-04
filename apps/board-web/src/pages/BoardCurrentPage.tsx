import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  RecordBody,
  RecordHistoryResponse,
  RecordItem,
  RecordResponse,
} from '@labour-board/shared'
import {
  ArrowPathIcon,
  ExclamationTriangleIcon,
  PlusIcon,
} from '@heroicons/react/20/solid'
import axios from 'axios'
import { Button } from '../components/ui/Button'
import { BoardFilters } from '../components/BoardFilters'
import { CreateRecordDrawer } from '../components/CreateRecordDrawer'
import { EmptyState } from '../components/EmptyState'
import { IssuesPanel } from '../components/IssuesPanel'
import { RecordCard } from '../components/RecordCard'
import { RecordHistoryDrawer } from '../components/RecordHistoryDrawer'
import { StatusBadge } from '../components/StatusBadge'
import { SummaryBar } from '../components/SummaryBar'
import { fetchRecordHistory } from '../api/history'
import { useBoardCurrentStore } from '../stores/boardCurrentStore'
import { useBoardMetadataStore } from '../stores/boardMetadataStore'
import {
  extractKnownTags,
  getConfigPriorityTags,
  getConfigStatusTags,
  getProfileOptions,
  hasEffectiveFilters,
  mergeKnownTags,
} from '../utils/board'
import { useDebouncedValue } from '../utils/useDebounce'

const Q_DEBOUNCE_MS = 300

interface HistorySelection {
  recordId: string
  title?: string
  pid?: string
}

export function BoardCurrentPage() {
  /* ── Current board store ── */
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

  /* ── Metadata store ── */
  const config = useBoardMetadataStore((s) => s.config)
  const profiles = useBoardMetadataStore((s) => s.profiles)
  const metadataLoading = useBoardMetadataStore((s) => s.isLoading)
  const metadataError = useBoardMetadataStore((s) => s.error)
  const loadMetadata = useBoardMetadataStore((s) => s.loadMetadata)

  /* ── Record history drawer ── */
  const [historySelection, setHistorySelection] =
    useState<HistorySelection | null>(null)
  const [history, setHistory] = useState<RecordHistoryResponse | null>(null)
  const [isHistoryLoading, setIsHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const historyRequestIdRef = useRef(0)
  const historyAbortRef = useRef<AbortController | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)

  /* ── Load metadata once on mount ── */
  useEffect(() => {
    const controller = new AbortController()
    void loadMetadata(controller.signal)
    return () => controller.abort()
  }, [loadMetadata])

  useEffect(() => {
    return () => {
      historyRequestIdRef.current += 1
      historyAbortRef.current?.abort()
      historyAbortRef.current = null
    }
  }, [])

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
    ]
  )

  /* ── Auto-load current board on effective filter change ── */
  useEffect(() => {
    const controller = new AbortController()
    void loadCurrentBoard(effectiveFilters, controller.signal)
    return () => controller.abort()
  }, [effectiveFilters, loadCurrentBoard])

  /* ── Derived data ── */
  const knownTags = useMemo(
    () => mergeKnownTags(projection, config),
    [projection, config]
  )

  // Fallback when config fails: projection-only tags
  const projectionKnownTags = useMemo(
    () => extractKnownTags(projection),
    [projection]
  )

  const statusTags = useMemo(() => getConfigStatusTags(config), [config])
  const priorityTags = useMemo(() => getConfigPriorityTags(config), [config])
  const profileOptions = useMemo(() => getProfileOptions(profiles), [profiles])

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

  const openHistory = useCallback(
    (record: RecordResponse<RecordItem<RecordBody>>) => {
      const requestId = historyRequestIdRef.current + 1
      historyRequestIdRef.current = requestId
      historyAbortRef.current?.abort()

      const controller = new AbortController()
      historyAbortRef.current = controller

      setHistorySelection({
        recordId: record.body.id,
        title: getRecordTitle(record.body.body),
        pid: record.body.pid,
      })
      setHistory(null)
      setHistoryError(null)
      setIsHistoryLoading(true)

      void fetchRecordHistory(record.body.id, controller.signal)
        .then((data) => {
          if (historyRequestIdRef.current !== requestId) return
          setHistory(data)
          setHistoryError(null)
        })
        .catch((unknownError: unknown) => {
          if (
            historyRequestIdRef.current !== requestId ||
            controller.signal.aborted ||
            axios.isCancel(unknownError)
          ) {
            return
          }
          setHistoryError(errorMessage(unknownError))
          setHistory(null)
        })
        .finally(() => {
          if (historyRequestIdRef.current !== requestId) return
          setIsHistoryLoading(false)
        })
    },
    []
  )

  const closeHistory = useCallback(() => {
    historyRequestIdRef.current += 1
    historyAbortRef.current?.abort()
    historyAbortRef.current = null
    setHistorySelection(null)
    setHistory(null)
    setHistoryError(null)
    setIsHistoryLoading(false)
  }, [])

  const openCreate = useCallback(() => {
    closeHistory()
    setIsCreateOpen(true)
  }, [closeHistory])

  const closeCreate = useCallback(() => {
    setIsCreateOpen(false)
  }, [])

  const refreshAfterCreate = useCallback(() => {
    void loadCurrentBoard(effectiveFilters)
  }, [effectiveFilters, loadCurrentBoard])

  /* ── Render ── */
  return (
    <main className="mx-auto min-h-svh w-full max-w-295 bg-stone-50 px-4 py-5 text-slate-950 sm:px-7 sm:py-7">
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
            onClick={openCreate}
            icon={<PlusIcon className="h-4 w-4" />}
          >
            Create Record
          </Button>
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
        // Use config-merged knownTags when config loaded, otherwise projection fallback
        knownTags={config ? knownTags : projectionKnownTags}
        statusTags={statusTags}
        priorityTags={priorityTags}
        profileOptions={profileOptions}
        metadataLoading={metadataLoading}
        metadataError={metadataError}
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
      {projectionStatus === 'partial' && (
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
      {projectionStatus === 'blocked' && (
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
      {projection && projectionStatus !== 'blocked' && records.length === 0 && (
        <EmptyState hasActiveFilters={active} hasIssues={hasIssues} />
      )}

      {/* ── Records (non-blocked only) ── */}
      {projection && projectionStatus !== 'blocked' && records.length > 0 && (
        <section className="mt-4 grid gap-3.5" aria-label="Current records">
          {records.map((record) => (
            <RecordCard
              key={record.body.id}
              record={record}
              profiles={profiles}
              onHistoryClick={openHistory}
            />
          ))}
        </section>
      )}

      {/* ── Issues (always shown when content exists, regardless of status) ── */}
      <IssuesPanel blockedRecords={blockedRecords} diagnostics={diagnostics} />

      <RecordHistoryDrawer
        open={historySelection !== null}
        recordId={historySelection?.recordId ?? null}
        title={historySelection?.title}
        pid={historySelection?.pid}
        history={history}
        isLoading={isHistoryLoading}
        error={historyError}
        profiles={profiles}
        onClose={closeHistory}
      />

      {isCreateOpen && (
        <CreateRecordDrawer
          open
          config={config}
          profiles={profiles}
          knownTags={config ? knownTags : projectionKnownTags}
          statusTags={statusTags}
          priorityTags={priorityTags}
          onClose={closeCreate}
          onCreated={refreshAfterCreate}
        />
      )}
    </main>
  )
}

function getRecordTitle(body: RecordBody): string | undefined {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return undefined
  const value = (body as Record<string, unknown>).title
  return typeof value === 'string' && value.trim() ? value : undefined
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
