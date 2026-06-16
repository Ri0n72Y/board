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
  Cog6ToothIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  PlusIcon,
  QueueListIcon,
} from '@heroicons/react/20/solid'
import { useTranslation } from 'react-i18next'
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
import { AppSettingsDrawer } from '../components/AppSettingsDrawer'
import { AdvancedFiltersDrawer } from '../components/AdvancedFiltersDrawer'
import { StatusBadge } from '../components/StatusBadge'
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
  getConfigOtherTags,
  getConfigPriorityTags,
  getConfigStatusTags,
  getProfileOptions,
  hasEffectiveFilters,
  mergeKnownTags,
} from '../utils/board'
import { getStatusColumns } from '../utils/boardView'
import {
  getUncategorizedColumnLabel,
  readVisibleColumnPreference,
  resolveVisibleColumnIds,
  writeVisibleColumnPreference,
} from '../utils/boardViewColumns'
import {
  buildAssetReferenceOptions,
  buildRelationTargetOptions,
  mergeReferenceOptions,
  type RecordReferenceOption,
} from '../utils/recordReferenceOptions'
import { formatTagLabel } from '../utils/tagDisplay'
import { useDebouncedValue } from '../utils/useDebounce'

const Q_DEBOUNCE_MS = 300
const EMPTY_RECORDS: RecordResponse<RecordItem<RecordBody>>[] = []

export function BoardCurrentPage() {
  const { t, i18n } = useTranslation()
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
  const [editRecord, setEditRecord] = useState<RecordResponse<
    RecordItem<RecordBody>
  > | null>(null)
  const [isContextExportOpen, setIsContextExportOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isAdvancedFiltersOpen, setIsAdvancedFiltersOpen] = useState(false)
  const [viewMode, setViewMode] = useState<BoardViewMode>('board')
  const [selectedAssetOption, setSelectedAssetOption] =
    useState<RecordReferenceOption | null>(null)
  const [selectedRelationTargetOption, setSelectedRelationTargetOption] =
    useState<RecordReferenceOption | null>(null)
  const [storedVisibleColumnIds, setStoredVisibleColumnIds] = useState<
    string[] | null
  >(() => readVisibleColumnPreference())

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
    ]
  )

  useEffect(() => {
    const controller = new AbortController()
    void loadCurrentBoard(effectiveFilters, controller.signal)
    return () => controller.abort()
  }, [effectiveFilters, loadCurrentBoard])

  const knownTags = useMemo(
    () => mergeKnownTags(projection, config),
    [projection, config]
  )
  const projectionKnownTags = useMemo(
    () => extractKnownTags(projection),
    [projection]
  )
  const statusTags = useMemo(() => getConfigStatusTags(config), [config])
  const priorityTags = useMemo(() => getConfigPriorityTags(config), [config])
  const configOtherTags = useMemo(() => getConfigOtherTags(config), [config])
  const profileOptions = useMemo(() => getProfileOptions(profiles), [profiles])
  const recordReferenceCopy = useMemo(
    () => ({
      unknownAsset: t('recordReference.unknownAsset'),
      unknownRecord: t('recordReference.unknownRecord'),
      rawId: t('recordReference.rawId'),
    }),
    [t],
  )

  const records = projection?.records ?? EMPTY_RECORDS
  const assetOptions = useMemo(() => {
    const currentOptions = buildAssetReferenceOptions(records, recordReferenceCopy)
    return selectedAssetOption
      ? mergeReferenceOptions(currentOptions, [selectedAssetOption])
      : currentOptions
  }, [records, recordReferenceCopy, selectedAssetOption])
  const relationTargetOptions = useMemo(() => {
    const currentOptions = buildRelationTargetOptions(records, recordReferenceCopy)
    return selectedRelationTargetOption
      ? mergeReferenceOptions(currentOptions, [selectedRelationTargetOption])
      : currentOptions
  }, [records, recordReferenceCopy, selectedRelationTargetOption])

  const updateAssetId = useCallback((assetId: string) => {
    setAssetId(assetId)
    setSelectedAssetOption(
      assetId
        ? assetOptions.find((option) => option.value === assetId) ?? null
        : null,
    )
  }, [assetOptions, setAssetId])

  const updateRelationTarget = useCallback((relationTarget: string) => {
    setRelationTarget(relationTarget)
    setSelectedRelationTargetOption(
      relationTarget
        ? relationTargetOptions.find((option) => option.value === relationTarget) ?? null
        : null,
    )
  }, [relationTargetOptions, setRelationTarget])
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
  const boardColumnOptions = useMemo(() => {
    const lang = i18n.resolvedLanguage
    const tagLabel = (tag: string) => formatTagLabel(tag, lang)
    return getStatusColumns(config, records, tagLabel, {
      uncategorizedLabel: getUncategorizedColumnLabel(lang),
    })
  }, [config, records, i18n.resolvedLanguage])
  const boardColumnIds = useMemo(
    () => boardColumnOptions.map((column) => column.id),
    [boardColumnOptions],
  )
  const visibleBoardColumnIds = useMemo(
    () => resolveVisibleColumnIds(boardColumnIds, storedVisibleColumnIds),
    [boardColumnIds, storedVisibleColumnIds],
  )
  const updateVisibleBoardColumnIds = useCallback(
    (nextColumnIds: string[]) => {
      const normalized = writeVisibleColumnPreference(
        boardColumnIds,
        nextColumnIds,
      )
      setStoredVisibleColumnIds(normalized)
    },
    [boardColumnIds],
  )

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
    []
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
    [effectiveFilters, historyController, loadCurrentBoard]
  )

  const statusMoveController = useStatusMoveController({
    onMoved: refreshAfterPatch,
  })

  return (
    <main className="mx-auto min-h-svh w-full max-w-295 bg-stone-50 px-4 py-5 text-slate-950 sm:px-7 sm:py-7">
      <header className="mb-5 grid gap-4 sm:flex sm:items-start sm:justify-between">
        <div>
          <p className="mb-1 text-xs font-bold uppercase text-slate-500">
            {t('header.currentBoard')}
          </p>
          <h1 className="text-3xl font-bold leading-tight text-slate-950">
            {t('header.appTitle')}
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
            {t('header.createRecord')}
          </Button>
          <Button
            type="button"
            onClick={snapshotController.openSnapshots}
            icon={<CameraIcon className="h-4 w-4" />}
          >
            {t('header.snapshots')}
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
              ? t('header.exporting')
              : t('header.exportCurrentBoard')}
          </Button>
          <Button
            type="button"
            onClick={() => setIsContextExportOpen(true)}
            disabled={!projection}
            icon={<DocumentTextIcon className="h-4 w-4" />}
          >
            {t('header.contextPack')}
          </Button>
          <Button
            type="button"
            onClick={agentDraftController.openDrawer}
            disabled={!projection}
            icon={<QueueListIcon className="h-4 w-4" />}
          >
            {t('header.agentDrafts')}
          </Button>
          <Button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            icon={<Cog6ToothIcon className="h-4 w-4" />}
          >
            {t('header.settings')}
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
            {isLoading ? t('header.refreshing') : t('header.refresh')}
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
        assetOptions={assetOptions}
        relationTargetOptions={relationTargetOptions}
        profileOptions={profileOptions}
        metadataLoading={metadataLoading}
        metadataError={metadataError}
        onQChange={setQ}
        onAddTag={addTag}
        onRemoveTag={removeTag}
        onTagMatchChange={setTagMatch}
        onIncludeArchivedChange={setIncludeArchived}
        onAssigneeChange={setAssignee}
        onAssetIdChange={updateAssetId}
        onRelationTargetChange={updateRelationTarget}
        onOpenAdvanced={() => setIsAdvancedFiltersOpen(true)}
        onClearFilters={() => {
          setQ('')
          draftFilters.tags.forEach((t) => removeTag(t))
          setAssignee('')
          updateAssetId('')
          updateRelationTarget('')
          setIncludeArchived(false)
        }}
      />

      {isInitialError && (
        <section
          className="mt-4 grid gap-1.5 rounded-lg border-2 border-red-300 bg-red-50 p-5 text-red-800"
          role="alert"
        >
          <strong>{t('status.loadError')}</strong>
          <span>{error}</span>
        </section>
      )}

      {isRefreshError && (
        <section
          className="mt-4 grid gap-1.5 rounded-lg border border-amber-300 bg-amber-50 p-5 text-amber-900"
          role="alert"
        >
          <strong>{t('status.refreshError')}</strong>
          <span>{error}</span>
        </section>
      )}

      {boardExportController.currentExportError && (
        <section
          className="mt-4 grid gap-1.5 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800"
          role="alert"
        >
          <strong>{t('status.exportError')}</strong>
          <span>{boardExportController.currentExportError}</span>
        </section>
      )}

      {isInitialLoad && (
        <section className="mt-4 rounded-lg border border-slate-200 bg-white p-5 text-slate-500">
          {t('status.loading')}
        </section>
      )}

      {projectionStatus === 'partial' && (
        <section
          className="mt-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900"
          role="alert"
        >
          <ExclamationTriangleIcon className="h-5 w-5 shrink-0" />
          <span className="text-sm font-medium">
            {t('status.projectionPartial')}
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
            {t('status.projectionBlocked')}
          </p>
          <p>
            {active
              ? t('status.projectionBlockedActive')
              : t('status.projectionBlockedInactive')}
          </p>
          {hasIssues && <p>{t('status.projectionIssues')}</p>}
        </section>
      )}

      {projection && projectionStatus !== 'blocked' && records.length === 0 && (
        <EmptyState hasActiveFilters={active} hasIssues={hasIssues} />
      )}

      {projection &&
        projectionStatus !== 'blocked' &&
        records.length > 0 &&
        (viewMode === 'board' ? (
          <BoardView
            records={records}
            config={config}
            profiles={profiles}
            movingRecordId={statusMoveController.movingRecordId}
            moveErrors={statusMoveController.moveErrors}
            visibleColumnIds={visibleBoardColumnIds}
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
        ))}

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
        onExportSnapshotContext={
          snapshotController.exportSelectedSnapshotContext
        }
        onSaveSnapshotDraft={
          snapshotController.selectedSnapshot
            ? (title: string): Promise<void> => {
                return agentDraftController
                  .saveDraft({
                    title,
                    profile: 'agent-snapshot',
                    source: 'snapshot',
                    snapshotId: snapshotController.selectedSnapshot!.id,
                  })
                  .then(() => undefined)
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
        isReviewing={agentDraftController.isReviewing}
        reviewError={agentDraftController.reviewError}
        isHandoffLoading={agentDraftController.isHandoffLoading}
        handoffError={agentDraftController.handoffError}
        handoffFeedback={agentDraftController.handoffFeedback}
        onSelectDraft={agentDraftController.loadDraftDetail}
        onRefreshList={agentDraftController.loadDraftList}
        onClose={agentDraftController.closeDrawer}
        onUpdateReview={agentDraftController.updateDraftReview}
        onCopyHandoff={agentDraftController.copyHandoff}
        onDownloadHandoff={agentDraftController.downloadHandoff}
        responses={agentDraftController.responses}
        selectedResponse={agentDraftController.selectedResponse}
        isResponseListLoading={agentDraftController.isResponseListLoading}
        isResponseDetailLoading={agentDraftController.isResponseDetailLoading}
        isResponseCreating={agentDraftController.isResponseCreating}
        responseListError={agentDraftController.responseListError}
        responseDetailError={agentDraftController.responseDetailError}
        responseCreateError={agentDraftController.responseCreateError}
        onLoadResponseDetail={agentDraftController.loadResponseDetail}
        onSaveResponse={agentDraftController.saveResponse}
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
          return agentDraftController
            .saveDraft({
              ...options,
              source: 'current-board',
              filters: appliedFilters,
            })
            .then(() => {
              setIsContextExportOpen(false)
            })
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
          knownTags={configOtherTags}
          statusTags={statusTags}
          priorityTags={priorityTags}
          assetOptions={assetOptions}
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
          configOtherTags={configOtherTags}
          statusTags={statusTags}
          priorityTags={priorityTags}
          assetOptions={assetOptions}
          onClose={closeEdit}
          onPatched={refreshAfterPatch}
        />
      )}

      <AppSettingsDrawer
        open={isSettingsOpen}
        visibleColumnOptions={boardColumnOptions}
        visibleColumnIds={visibleBoardColumnIds}
        onVisibleColumnIdsChange={updateVisibleBoardColumnIds}
        onClose={() => setIsSettingsOpen(false)}
      />
      <AdvancedFiltersDrawer
        open={isAdvancedFiltersOpen}
        projection={projection}
        knownTags={config ? knownTags : projectionKnownTags}
        tags={draftFilters.tags}
        tagMatch={draftFilters.tagMatch}
        assetId={draftFilters.assetId}
        relationTarget={draftFilters.relationTarget}
        assetOptions={assetOptions}
        relationTargetOptions={relationTargetOptions}
        onAddTag={addTag}
        onRemoveTag={removeTag}
        onTagMatchChange={setTagMatch}
        onAssetIdChange={updateAssetId}
        onRelationTargetChange={updateRelationTarget}
        onClose={() => setIsAdvancedFiltersOpen(false)}
      />
    </main>
  )
}
