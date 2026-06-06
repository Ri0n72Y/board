import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  RecordBody,
  RecordItem,
  RecordResponse,
} from '@labour-board/shared'
import {
  ArrowDownTrayIcon,
  ArrowPathIcon,
  CameraIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  PlusIcon,
  QueueListIcon,
} from '@heroicons/react/20/solid'
import { Button } from '../components/ui/Button'
import { BoardFilters } from '../components/BoardFilters'
import { BoardView } from '../components/BoardView'
import { CreateRecordDrawer } from '../components/CreateRecordDrawer'
import { EditRecordDrawer } from '../components/EditRecordDrawer'
import { EmptyState } from '../components/EmptyState'
import { ExportContextDrawer } from '../components/ExportContextDrawer'
import { IssuesPanel } from '../components/IssuesPanel'
import { RecordCard } from '../components/RecordCard'
import { RecordHistoryDrawer } from '../components/RecordHistoryDrawer'
import { SnapshotDrawer } from '../components/SnapshotDrawer'
import { AgentDraftsDrawer } from '../components/AgentDraftsDrawer'
import { StatusBadge } from '../components/StatusBadge'
import { SummaryBar } from '../components/SummaryBar'
import {
  ViewModeToggle,
  type BoardViewMode,
} from '../components/ViewModeToggle'
import { useBoardExportController } from '../hooks/useBoardExportController'
import { useAgentDraftController } from '../hooks/useAgentDraftController'
import { useRecordHistoryController } from '../hooks/useRecordHistoryController'
import { useSnapshotController } from '../hooks/useSnapshotController'
import { useStatusMoveController } from '../hooks/useStatusMoveController'
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

export function BoardCurrentPage() {
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

  const config = useBoardMetadataStore((s) => s.config)
  const profiles = useBoardMetadataStore((s) => s.profiles)
  const metadataLoading = useBoardMetadataStore((s) => s.isLoading)
  const metadataError = useBoardMetadataStore((s) => s.error)
  const loadMetadata = useBoardMetadataStore((s) => s.loadMetadata)

  const historyController = useRecordHistoryController()
  const snapshotController = useSnapshotController()
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editRecord, setEditRecord] =
    useState<RecordResponse<RecordItem<RecordBody>> | null>(null)
  const [isContextExportOpen, setIsContextExportOpen] = useState(false)
  const [viewMode, setViewMode] = useState<BoardViewMode>('list')

  useEffect(() => {
    const controller = new AbortController()
    void loadMetadata(controller.signal)
    return () => controller.abort()
  }, [loadMetadata])

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

  useEffect(() => {
    const controller = new AbortController()
    void loadCurrentBoard(effectiveFilters, controller.signal)
    return () => controller.abort()
  }, [effectiveFilters, loadCurrentBoard])

  const knownTags = useMemo(
    () => mergeKnownTags(projection, config),
    [projection, config],
  )
  const projectionKnownTags = useMemo(
    () => extractKnownTags(projection),
    [projection],
  )
  const statusTags = useMemo(() => getConfigStatusTags(config), [config])
  const priorityTags = useMemo(() => getConfigPriorityTags(config), [config])
  const profileOptions = useMemo(() => getProfileOptions(profiles), [profiles])

  const records = projection?.records ?? []
  const blockedRecords = projection?.blockedRecords ?? []
  const diagnostics = projection?.diagnostics ?? []
  const projectionStatus = projection?.summary.projectionStatus
  const appliedFilters = lastAppliedFilters ?? effectiveFilters
  const active = hasEffectiveFilters(appliedFilters)
  const hasIssues = blockedRecords.length > 0 || (diagnostics?.length ?? 0) > 0
  const isInitialLoad = !projection && isLoading && !error
  const isInitialError = !projection && error
  const isRefreshError = projection && error

  const boardExportController = useBoardExportController({ appliedFilters })
  const agentDraftController = useAgentDraftController()

  function refresh() {
    void loadCurrentBoard(effectiveFilters)
  }

  const openCreate = useCallback(() => {
    historyController.closeHistory()
    setEditRecord(null)
    setIsCreateOpen(true)
  }, [historyController])

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
    [],
  )

  const closeEdit = useCallback(() => {
    setEditRecord(null)
  }, [])

  const refreshAfterPatch = useCallback(
    async (recordId: string) => {
      await loadCurrentBoard(effectiveFilters)
      if (historyController.historySelection?.recordId === recordId) {
        historyController.loadHistory(historyController.historySelection)
      }
    },
    [effectiveFilters, historyController, loadCurrentBoard],
  )

  const statusMoveController = useStatusMoveController({
    onMoved: refreshAfterPatch,
  })

  return (
    <main className="mx-auto min-h-svh w-full max-w-295 bg-stone-50 px-4 py-5 text-slate-950 sm:px-7 sm:py-7">
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
            onClick={snapshotController.openSnapshots}
            icon={<CameraIcon className="h-4 w-4" />}
          >
            Snapshots
          </Button>
          <Button
            type="button"
            onClick={boardExportController.exportCurrentMarkdown}
            disabled={boardExportController.isCurrentExporting || !projection}
            icon={
              boardExportController.isCurrentExporting ? (
                <ArrowPathIcon className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowDownTrayIcon className="h-4 w-4" />
              )
            }
          >
            {boardExportController.isCurrentExporting
              ? 'Exporting...'
              : 'Export Current Board'}
          </Button>
          <Button
            type="button"
            onClick={() => setIsContextExportOpen(true)}
            disabled={!projection}
            icon={<DocumentTextIcon className="h-4 w-4" />}
          >
            Context Pack
          </Button>
          <Button
            type="button"
            onClick={agentDraftController.openDrawer}
            disabled={!projection}
            icon={<QueueListIcon className="h-4 w-4" />}
          >
            Agent Drafts
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

      <BoardFilters
        q={draftFilters.q}
        tags={draftFilters.tags}
        tagMatch={draftFilters.tagMatch}
        includeArchived={draftFilters.includeArchived}
        assignee={draftFilters.assignee}
        assetId={draftFilters.assetId}
        relationTarget={draftFilters.relationTarget}
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

      {projection && <SummaryBar projection={projection} />}

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
          <strong>Refresh failed - showing stale data</strong>
          <span>{error}</span>
        </section>
      )}

      {boardExportController.currentExportError && (
        <section
          className="mt-4 grid gap-1.5 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800"
          role="alert"
        >
          <strong>Export failed</strong>
          <span>{boardExportController.currentExportError}</span>
        </section>
      )}

      {isInitialLoad && (
        <section className="mt-4 rounded-lg border border-slate-200 bg-white p-5 text-slate-500">
          Loading current board...
        </section>
      )}

      {projectionStatus === 'partial' && (
        <section
          className="mt-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900"
          role="alert"
        >
          <ExclamationTriangleIcon className="h-5 w-5 shrink-0" />
          <span className="text-sm font-medium">
            Projection is partial - some records may be missing.
          </span>
        </section>
      )}

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
              ? 'The current board projection is blocked - no records match these filters.'
              : 'The current board projection is blocked - no records can be shown.'}
          </p>
          {hasIssues && <p>See projection issues below for details.</p>}
        </section>
      )}

      {projection && projectionStatus !== 'blocked' && records.length === 0 && (
        <EmptyState hasActiveFilters={active} hasIssues={hasIssues} />
      )}

      {projection && projectionStatus !== 'blocked' && records.length > 0 && (
        viewMode === 'board' ? (
          <BoardView
            records={records}
            config={config}
            profiles={profiles}
            movingRecordId={statusMoveController.movingRecordId}
            moveErrors={statusMoveController.moveErrors}
            onHistoryClick={historyController.openHistory}
            onEditClick={openEdit}
            onMoveStatus={statusMoveController.moveRecordStatus}
          />
        ) : (
          <section className="mt-4 grid gap-3.5" aria-label="Current records">
            {records.map((record) => (
              <RecordCard
                key={record.body.id}
                record={record}
                profiles={profiles}
                onHistoryClick={historyController.openHistory}
                onEditClick={openEdit}
              />
            ))}
          </section>
        )
      )}

      <IssuesPanel blockedRecords={blockedRecords} diagnostics={diagnostics} />

      <RecordHistoryDrawer
        open={historyController.historySelection !== null}
        recordId={historyController.historySelection?.recordId ?? null}
        title={historyController.historySelection?.title}
        pid={historyController.historySelection?.pid}
        history={historyController.history}
        isLoading={historyController.isHistoryLoading}
        error={historyController.historyError}
        profiles={profiles}
        onClose={historyController.closeHistory}
        onEditClick={openEdit}
      />

      <SnapshotDrawer
        open={snapshotController.isSnapshotOpen}
        snapshots={snapshotController.snapshots}
        selectedSnapshot={snapshotController.selectedSnapshot}
        reason={snapshotController.snapshotReason}
        isListLoading={snapshotController.isSnapshotsLoading}
        isDetailLoading={snapshotController.isSnapshotDetailLoading}
        isCreating={snapshotController.isSnapshotCreating}
        listError={snapshotController.snapshotListError}
        detailError={snapshotController.snapshotDetailError}
        createError={snapshotController.snapshotCreateError}
        isExporting={snapshotController.isSnapshotExporting}
        exportError={snapshotController.snapshotExportError}
        onReasonChange={snapshotController.setSnapshotReason}
        onCreateSnapshot={snapshotController.submitSnapshot}
        onSelectSnapshot={snapshotController.loadSnapshotDetail}
        onRefreshList={snapshotController.loadSnapshots}
        onExportSnapshot={snapshotController.exportSelectedSnapshotMarkdown}
        onExportSnapshotContext={snapshotController.exportSelectedSnapshotContext}
        onSaveSnapshotDraft={
          snapshotController.selectedSnapshot
            ? (title: string) => {
                agentDraftController.saveDraft({
                  title,
                  profile: 'agent-snapshot',
                  source: 'snapshot',
                  snapshotId: snapshotController.selectedSnapshot!.id,
                })
              }
            : undefined
        }
        isSavingDraft={agentDraftController.isCreating}
        draftSaveError={agentDraftController.createError}
        onClose={snapshotController.closeSnapshots}
      />

      <AgentDraftsDrawer
        open={agentDraftController.isDrawerOpen}
        drafts={agentDraftController.drafts}
        selectedDraft={agentDraftController.selectedDraft}
        isListLoading={agentDraftController.isListLoading}
        isDetailLoading={agentDraftController.isDetailLoading}
        isCreating={agentDraftController.isCreating}
        listError={agentDraftController.listError}
        detailError={agentDraftController.detailError}
        createError={agentDraftController.createError}
        onSelectDraft={agentDraftController.loadDraftDetail}
        onRefreshList={agentDraftController.loadDraftList}
        onClose={agentDraftController.closeDrawer}
      />

      <ExportContextDrawer
        open={isContextExportOpen}
        records={records}
        filters={appliedFilters}
        knownTags={config ? knownTags : projectionKnownTags}
        isExporting={boardExportController.isContextExporting}
        error={boardExportController.contextExportError}
        onExport={boardExportController.exportContextPack}
        onSaveDraft={(options) => {
          agentDraftController.saveDraft({
            ...options,
            source: 'current-board',
            filters: appliedFilters,
          })
          setIsContextExportOpen(false)
        }}
        isSavingDraft={agentDraftController.isCreating}
        draftSaveError={agentDraftController.createError}
        onClose={() => setIsContextExportOpen(false)}
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
