import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  RecordBody,
  RecordHistoryResponse,
  RecordItem,
  RecordResponse,
  SnapshotDetail,
  SnapshotSummary,
  Tag,
} from '@labour-board/shared'
import {
  ArrowPathIcon,
  CameraIcon,
  ExclamationTriangleIcon,
  PlusIcon,
} from '@heroicons/react/20/solid'
import axios from 'axios'
import { Button } from '../components/ui/Button'
import { BoardFilters } from '../components/BoardFilters'
import { BoardView } from '../components/BoardView'
import { CreateRecordDrawer } from '../components/CreateRecordDrawer'
import { EditRecordDrawer } from '../components/EditRecordDrawer'
import { EmptyState } from '../components/EmptyState'
import { IssuesPanel } from '../components/IssuesPanel'
import { RecordCard } from '../components/RecordCard'
import { RecordHistoryDrawer } from '../components/RecordHistoryDrawer'
import { SnapshotDrawer } from '../components/SnapshotDrawer'
import { StatusBadge } from '../components/StatusBadge'
import { SummaryBar } from '../components/SummaryBar'
import {
  ViewModeToggle,
  type BoardViewMode,
} from '../components/ViewModeToggle'
import { fetchRecordHistory } from '../api/history'
import { RecordPatchConflictError, submitRecordPatch } from '../api/patches'
import { fetchRecordHead } from '../api/recordHead'
import {
  createSnapshot,
  fetchSnapshot,
  fetchSnapshots,
} from '../api/snapshots'
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
import {
  buildMovedStatusTags,
  isStatusMoveNoop,
} from '../utils/statusMove'
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
  const [editRecord, setEditRecord] =
    useState<RecordResponse<RecordItem<RecordBody>> | null>(null)
  const [viewMode, setViewMode] = useState<BoardViewMode>('list')
  const [movingRecordId, setMovingRecordId] = useState<string | null>(null)
  const [moveErrors, setMoveErrors] = useState<Record<string, string>>({})
  const statusMoveRequestIdRef = useRef(0)
  const statusMoveAbortRef = useRef<AbortController | null>(null)
  const [isSnapshotOpen, setIsSnapshotOpen] = useState(false)
  const [snapshots, setSnapshots] = useState<SnapshotSummary[]>([])
  const [selectedSnapshot, setSelectedSnapshot] =
    useState<SnapshotDetail | null>(null)
  const [snapshotReason, setSnapshotReason] = useState('')
  const [isSnapshotsLoading, setIsSnapshotsLoading] = useState(false)
  const [isSnapshotDetailLoading, setIsSnapshotDetailLoading] = useState(false)
  const [isSnapshotCreating, setIsSnapshotCreating] = useState(false)
  const [snapshotListError, setSnapshotListError] = useState<string | null>(null)
  const [snapshotDetailError, setSnapshotDetailError] = useState<string | null>(null)
  const [snapshotCreateError, setSnapshotCreateError] = useState<string | null>(null)
  const snapshotListRequestIdRef = useRef(0)
  const snapshotDetailRequestIdRef = useRef(0)
  const snapshotCreateRequestIdRef = useRef(0)
  const snapshotListAbortRef = useRef<AbortController | null>(null)
  const snapshotDetailAbortRef = useRef<AbortController | null>(null)
  const snapshotCreateAbortRef = useRef<AbortController | null>(null)
  const abortSnapshotRequests = useCallback(() => {
    snapshotListRequestIdRef.current += 1
    snapshotDetailRequestIdRef.current += 1
    snapshotCreateRequestIdRef.current += 1
    snapshotListAbortRef.current?.abort()
    snapshotDetailAbortRef.current?.abort()
    snapshotCreateAbortRef.current?.abort()
    snapshotListAbortRef.current = null
    snapshotDetailAbortRef.current = null
    snapshotCreateAbortRef.current = null
  }, [])

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
      statusMoveRequestIdRef.current += 1
      statusMoveAbortRef.current?.abort()
      statusMoveAbortRef.current = null
      abortSnapshotRequests()
    }
  }, [abortSnapshotRequests])

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

  const loadHistory = useCallback(
    (selection: HistorySelection) => {
      const requestId = historyRequestIdRef.current + 1
      historyRequestIdRef.current = requestId
      historyAbortRef.current?.abort()

      const controller = new AbortController()
      historyAbortRef.current = controller

      setHistorySelection(selection)
      setHistory(null)
      setHistoryError(null)
      setIsHistoryLoading(true)

      void fetchRecordHistory(selection.recordId, controller.signal)
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

  const openHistory = useCallback(
    (record: RecordResponse<RecordItem<RecordBody>>) => {
      loadHistory({
        recordId: record.body.id,
        title: getRecordTitle(record.body.body),
        pid: record.body.pid,
      })
    },
    [loadHistory]
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
    setEditRecord(null)
    setIsCreateOpen(true)
  }, [closeHistory])

  const closeCreate = useCallback(() => {
    setIsCreateOpen(false)
  }, [])

  const refreshAfterCreate = useCallback(() => {
    void loadCurrentBoard(effectiveFilters)
  }, [effectiveFilters, loadCurrentBoard])

  const openEdit = useCallback(
    (record: RecordResponse<RecordItem<RecordBody>>) => {
      setIsCreateOpen(false)
      setEditRecord(record)
    },
    []
  )

  const closeEdit = useCallback(() => {
    setEditRecord(null)
  }, [])

  const refreshAfterPatch = useCallback(
    async (recordId: string) => {
      await loadCurrentBoard(effectiveFilters)
      if (historySelection?.recordId === recordId) {
        loadHistory(historySelection)
      }
    },
    [effectiveFilters, historySelection, loadCurrentBoard, loadHistory]
  )

  const loadSnapshots = useCallback(() => {
    const requestId = snapshotListRequestIdRef.current + 1
    snapshotListRequestIdRef.current = requestId
    snapshotListAbortRef.current?.abort()

    const controller = new AbortController()
    snapshotListAbortRef.current = controller
    setIsSnapshotsLoading(true)
    setSnapshotListError(null)

    void fetchSnapshots(controller.signal)
      .then((data) => {
        if (
          snapshotListRequestIdRef.current !== requestId ||
          controller.signal.aborted
        ) {
          return
        }
        setSnapshots(data.snapshots)
      })
      .catch((unknownError: unknown) => {
        if (
          snapshotListRequestIdRef.current !== requestId ||
          controller.signal.aborted ||
          axios.isCancel(unknownError)
        ) {
          return
        }
        setSnapshotListError(errorMessage(unknownError))
      })
      .finally(() => {
        if (snapshotListRequestIdRef.current !== requestId) return
        setIsSnapshotsLoading(false)
        snapshotListAbortRef.current = null
      })
  }, [])

  const loadSnapshotDetail = useCallback((snapshotId: string) => {
    const requestId = snapshotDetailRequestIdRef.current + 1
    snapshotDetailRequestIdRef.current = requestId
    snapshotDetailAbortRef.current?.abort()

    const controller = new AbortController()
    snapshotDetailAbortRef.current = controller
    setIsSnapshotDetailLoading(true)
    setSnapshotDetailError(null)

    void fetchSnapshot(snapshotId, controller.signal)
      .then((data) => {
        if (
          snapshotDetailRequestIdRef.current !== requestId ||
          controller.signal.aborted
        ) {
          return
        }
        setSelectedSnapshot(data.snapshot)
      })
      .catch((unknownError: unknown) => {
        if (
          snapshotDetailRequestIdRef.current !== requestId ||
          controller.signal.aborted ||
          axios.isCancel(unknownError)
        ) {
          return
        }
        setSnapshotDetailError(errorMessage(unknownError))
      })
      .finally(() => {
        if (snapshotDetailRequestIdRef.current !== requestId) return
        setIsSnapshotDetailLoading(false)
        snapshotDetailAbortRef.current = null
      })
  }, [])

  const openSnapshots = useCallback(() => {
    setIsSnapshotOpen(true)
    loadSnapshots()
  }, [loadSnapshots])

  const closeSnapshots = useCallback(() => {
    abortSnapshotRequests()
    setIsSnapshotOpen(false)
    setSnapshotListError(null)
    setSnapshotDetailError(null)
    setSnapshotCreateError(null)
    setIsSnapshotsLoading(false)
    setIsSnapshotDetailLoading(false)
    setIsSnapshotCreating(false)
  }, [abortSnapshotRequests])

  const submitSnapshot = useCallback(() => {
    const requestId = snapshotCreateRequestIdRef.current + 1
    snapshotCreateRequestIdRef.current = requestId
    snapshotCreateAbortRef.current?.abort()

    const controller = new AbortController()
    snapshotCreateAbortRef.current = controller
    setIsSnapshotCreating(true)
    setSnapshotCreateError(null)

    void createSnapshot({ reason: snapshotReason }, controller.signal)
      .then((data) => {
        if (
          snapshotCreateRequestIdRef.current !== requestId ||
          controller.signal.aborted
        ) {
          return
        }
        setSelectedSnapshot(data.snapshot)
        setSnapshotReason('')
        loadSnapshots()
      })
      .catch((unknownError: unknown) => {
        if (
          snapshotCreateRequestIdRef.current !== requestId ||
          controller.signal.aborted ||
          axios.isCancel(unknownError)
        ) {
          return
        }
        setSnapshotCreateError(errorMessage(unknownError))
      })
      .finally(() => {
        if (snapshotCreateRequestIdRef.current !== requestId) return
        setIsSnapshotCreating(false)
        snapshotCreateAbortRef.current = null
      })
  }, [loadSnapshots, snapshotReason])

  const moveRecordStatus = useCallback(
    (
      record: RecordResponse<RecordItem<RecordBody>>,
      targetStatusTag: Tag,
    ) => {
      const recordId = record.body.id
      if (isStatusMoveNoop(record.body.tags, targetStatusTag)) return

      const requestId = statusMoveRequestIdRef.current + 1
      statusMoveRequestIdRef.current = requestId
      statusMoveAbortRef.current?.abort()

      const controller = new AbortController()
      statusMoveAbortRef.current = controller

      setMovingRecordId(recordId)
      setMoveErrors((current) => {
        const next = { ...current }
        delete next[recordId]
        return next
      })

      void (async () => {
        const head = await fetchRecordHead(recordId, controller.signal)
        if (
          statusMoveRequestIdRef.current !== requestId ||
          controller.signal.aborted
        ) {
          return
        }
        const nextTags = buildMovedStatusTags(record.body.tags, targetStatusTag)
        await submitRecordPatch(
          recordId,
          {
            parentId: head.lastPatchId,
            currentVersion: head.currentVersion,
            tags: nextTags,
            description: `Move status to ${targetStatusTag}`,
          },
          controller.signal,
        )
        if (
          statusMoveRequestIdRef.current !== requestId ||
          controller.signal.aborted
        ) {
          return
        }
        await refreshAfterPatch(recordId)
      })()
        .catch((unknownError: unknown) => {
          if (
            statusMoveRequestIdRef.current !== requestId ||
            controller.signal.aborted ||
            axios.isCancel(unknownError)
          ) {
            return
          }

          const message =
            unknownError instanceof RecordPatchConflictError
              ? `${unknownError.message} Refresh current board and try again.`
              : errorMessage(unknownError)
          setMoveErrors((current) => ({ ...current, [recordId]: message }))
        })
        .finally(() => {
          if (statusMoveRequestIdRef.current !== requestId) return
          setMovingRecordId(null)
          statusMoveAbortRef.current = null
        })
    },
    [refreshAfterPatch],
  )

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
          <ViewModeToggle value={viewMode} onChange={setViewMode} />
          <Button
            type="button"
            onClick={openCreate}
            icon={<PlusIcon className="h-4 w-4" />}
          >
            Create Record
          </Button>
          <Button
            type="button"
            onClick={openSnapshots}
            icon={<CameraIcon className="h-4 w-4" />}
          >
            Snapshots
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
        viewMode === 'board' ? (
          <BoardView
            records={records}
            config={config}
            profiles={profiles}
            movingRecordId={movingRecordId}
            moveErrors={moveErrors}
            onHistoryClick={openHistory}
            onEditClick={openEdit}
            onMoveStatus={moveRecordStatus}
          />
        ) : (
          <section className="mt-4 grid gap-3.5" aria-label="Current records">
            {records.map((record) => (
              <RecordCard
                key={record.body.id}
                record={record}
                profiles={profiles}
                onHistoryClick={openHistory}
                onEditClick={openEdit}
              />
            ))}
          </section>
        )
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
        onEditClick={openEdit}
      />

      <SnapshotDrawer
        open={isSnapshotOpen}
        snapshots={snapshots}
        selectedSnapshot={selectedSnapshot}
        reason={snapshotReason}
        isListLoading={isSnapshotsLoading}
        isDetailLoading={isSnapshotDetailLoading}
        isCreating={isSnapshotCreating}
        listError={snapshotListError}
        detailError={snapshotDetailError}
        createError={snapshotCreateError}
        onReasonChange={setSnapshotReason}
        onCreateSnapshot={submitSnapshot}
        onSelectSnapshot={loadSnapshotDetail}
        onRefreshList={loadSnapshots}
        onClose={closeSnapshots}
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

      {editRecord && (
        <EditRecordDrawer
          key={editRecord.body.id}
          open
          record={editRecord}
          profiles={profiles}
          knownTags={config ? knownTags : projectionKnownTags}
          statusTags={statusTags}
          priorityTags={priorityTags}
          onClose={closeEdit}
          onPatched={refreshAfterPatch}
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
