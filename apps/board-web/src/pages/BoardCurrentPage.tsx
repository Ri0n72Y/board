import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  RecordBody,
  RecordItem,
  RecordResponse,
} from '@labour-board/shared'
import {
  ArrowPathIcon,
  Cog6ToothIcon,
  ExclamationTriangleIcon,
  PlusIcon,
  EllipsisHorizontalIcon,
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
import { RecordDetailDrawer } from '../components/RecordDetailDrawer'
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
import {
  areBoardFiltersEqual,
  boardFilterUrlQuery,
  parseBoardFilterUrl,
  shouldReplaceBoardFilterUrl,
} from '../utils/boardFilterUrl'
import { getStatusColumns } from '../utils/boardView'
import {
  getUncategorizedColumnLabel,
  readBoardColumnPreference,
  resolveColumnOrderIds,
  resolveVisibleColumnIds,
  writeBoardColumnPreference,
} from '../utils/boardViewColumns'
import {
  buildAssetReferenceOptions,
  buildRelationTargetOptions,
  mergeReferenceOptions,
  type RecordReferenceOption,
} from '../utils/recordReferenceOptions'
import { buildRelationConstraintOptions } from '../utils/relationDisplay'
import { formatTagLabel } from '../utils/tagDisplay'
import { useDebouncedValue } from '../utils/useDebounce'
import { cn } from '../lib/cn'

const Q_DEBOUNCE_MS = 300
const EMPTY_RECORDS: RecordResponse<RecordItem<RecordBody>>[] = []

export function BoardCurrentPage() {
  const { t, i18n } = useTranslation()
  const draftFilters = useBoardCurrentStore((s) => s.filters)
  const effectiveFilters = useBoardCurrentStore((s) => s.effectiveFilters)
  const lastAppliedFilters = useBoardCurrentStore((s) => s.lastAppliedFilters)
  const filterUrlApplyVersion = useBoardCurrentStore(
    (s) => s.filterUrlApplyVersion
  )
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
  const setFilters = useBoardCurrentStore((s) => s.setFilters)
  const setEffectiveFilters = useBoardCurrentStore((s) => s.setEffectiveFilters)
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
  const [editInitialPatchDescription, setEditInitialPatchDescription] =
    useState<string | undefined>(undefined)
  const [isContextExportOpen, setIsContextExportOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isAdvancedFiltersOpen, setIsAdvancedFiltersOpen] = useState(false)
  const [viewMode, setViewMode] = useState<BoardViewMode>('board')
  const [detailRecord, setDetailRecord] = useState<RecordResponse<
    RecordItem<RecordBody>
  > | null>(null)
  const [selectedAssetOption, setSelectedAssetOption] =
    useState<RecordReferenceOption | null>(null)
  const [selectedRelationTargetOption, setSelectedRelationTargetOption] =
    useState<RecordReferenceOption | null>(null)
  const [storedBoardColumnPreference, setStoredBoardColumnPreference] = useState(
    () => readBoardColumnPreference()
  )

  useEffect(() => {
    const controller = new AbortController()
    void loadMetadata(controller.signal)
    return () => controller.abort()
  }, [loadMetadata])

  const debouncedQ = useDebouncedValue(
    draftFilters.q,
    Q_DEBOUNCE_MS,
    filterUrlApplyVersion
  )

  useEffect(() => {
    if (debouncedQ !== draftFilters.q) return
    setEffectiveFilters({
      q: debouncedQ,
      tags: draftFilters.tags,
      tagMatch: draftFilters.tagMatch,
      includeArchived: draftFilters.includeArchived,
      assignee: draftFilters.assignee,
      assetId: draftFilters.assetId,
      relationTarget: draftFilters.relationTarget,
    })
  }, [
    debouncedQ,
    draftFilters.q,
    draftFilters.tags,
    draftFilters.tagMatch,
    draftFilters.includeArchived,
    draftFilters.assignee,
    draftFilters.assetId,
    draftFilters.relationTarget,
    setEffectiveFilters,
  ])

  useEffect(() => {
    const controller = new AbortController()
    void loadCurrentBoard(effectiveFilters, controller.signal)
    return () => controller.abort()
  }, [effectiveFilters, loadCurrentBoard])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const nextQuery = boardFilterUrlQuery(effectiveFilters)
    if (!shouldReplaceBoardFilterUrl(window.location.search, nextQuery)) return

    const nextUrl = [
      window.location.pathname,
      nextQuery ? `?${nextQuery}` : '',
      window.location.hash,
    ].join('')
    window.history.replaceState(window.history.state, '', nextUrl)
  }, [effectiveFilters])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handlePopState = () => {
      const nextFilters = parseBoardFilterUrl(window.location.search)
      const currentFilters = useBoardCurrentStore.getState().filters
      if (!areBoardFiltersEqual(currentFilters, nextFilters)) {
        setFilters(nextFilters)
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [setFilters])

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
    [t]
  )

  const records = projection?.records ?? EMPTY_RECORDS
  const assetOptions = useMemo(() => {
    const currentOptions = buildAssetReferenceOptions(
      records,
      recordReferenceCopy
    )
    return selectedAssetOption
      ? mergeReferenceOptions(currentOptions, [selectedAssetOption])
      : currentOptions
  }, [records, recordReferenceCopy, selectedAssetOption])
  const relationTargetOptions = useMemo(() => {
    const currentOptions = buildRelationTargetOptions(
      records,
      recordReferenceCopy
    )
    return selectedRelationTargetOption
      ? mergeReferenceOptions(currentOptions, [selectedRelationTargetOption])
      : currentOptions
  }, [records, recordReferenceCopy, selectedRelationTargetOption])
  const relationConstraintOptions = useMemo(
    () => buildRelationConstraintOptions(records, t, config),
    [records, t, config]
  )

  const updateAssetId = useCallback(
    (assetId: string) => {
      setAssetId(assetId)
      setSelectedAssetOption(
        assetId
          ? (assetOptions.find((option) => option.value === assetId) ?? null)
          : null
      )
    },
    [assetOptions, setAssetId]
  )

  const updateRelationTarget = useCallback(
    (relationTarget: string) => {
      setRelationTarget(relationTarget)
      setSelectedRelationTargetOption(
        relationTarget
          ? (relationTargetOptions.find(
              (option) => option.value === relationTarget
            ) ?? null)
          : null
      )
    },
    [relationTargetOptions, setRelationTarget]
  )
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
    [boardColumnOptions]
  )
  const boardColumnOrderIds = useMemo(
    () =>
      resolveColumnOrderIds(
        boardColumnIds,
        storedBoardColumnPreference?.columnOrderIds
      ),
    [boardColumnIds, storedBoardColumnPreference]
  )
  const visibleBoardColumnIds = useMemo(
    () =>
      resolveVisibleColumnIds(
        boardColumnOrderIds,
        storedBoardColumnPreference?.visibleColumnIds
      ),
    [boardColumnOrderIds, storedBoardColumnPreference]
  )
  const updateVisibleBoardColumnIds = useCallback(
    (nextColumnIds: string[]) => {
      const normalized = writeBoardColumnPreference(
        boardColumnIds,
        nextColumnIds,
        boardColumnOrderIds
      )
      setStoredBoardColumnPreference(normalized)
    },
    [boardColumnIds, boardColumnOrderIds]
  )
  const updateBoardColumnOrderIds = useCallback(
    (nextColumnOrderIds: string[]) => {
      const normalized = writeBoardColumnPreference(
        boardColumnIds,
        visibleBoardColumnIds,
        nextColumnOrderIds
      )
      setStoredBoardColumnPreference(normalized)
    },
    [boardColumnIds, visibleBoardColumnIds]
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
      setEditInitialPatchDescription(undefined)
      setEditRecord(record)
    },
    []
  )

  const closeEdit = useCallback(() => {
    setEditRecord(null)
    setEditInitialPatchDescription(undefined)
  }, [])

  const openDetail = useCallback(
    (record: RecordResponse<RecordItem<RecordBody>>) => {
      historyController.closeHistory()
      setDetailRecord(record)
    },
    [historyController]
  )

  const closeDetail = useCallback(() => {
    historyController.closeHistory()
    setDetailRecord(null)
  }, [historyController])

  const handleDetailHistory = useCallback(
    (record: RecordResponse<RecordItem<RecordBody>>) => {
      historyController.openHistory(record)
    },
    [historyController]
  )

  const handleOpenPatchEditor = useCallback(
    (recordId: string, patchDescription: string) => {
      const found = records.find((r) => r.body.id === recordId)
      if (!found) return
      setIsCreateOpen(false)
      setEditInitialPatchDescription(patchDescription)
      setEditRecord(found)
    },
    [records]
  )

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

  const moreMenuItems = [
    {
      key: 'snapshots',
      label: t('header.snapshots'),
      action: snapshotController.openSnapshots,
    },
    {
      key: 'export',
      label: t('header.exportCurrentBoard'),
      action: boardExportController.exportCurrentMarkdown,
      disabled: boardExportController.isCurrentExporting || !projection,
    },
    {
      key: 'context',
      label: t('header.contextPack'),
      action: () => setIsContextExportOpen(true),
      disabled: !projection,
    },
    {
      key: 'agent',
      label: t('header.agentDrafts'),
      action: agentDraftController.openDrawer,
      disabled: !projection,
    },
  ]

  return (
    <div className="h-svh overflow-hidden bg-slate-50 text-slate-950">
      <div className="grid h-full w-full grid-rows-[auto_auto_minmax(0,1fr)] overflow-hidden">
        <header
          className={cn(
            `z-30 h-18 min-h-16  gap-4  px-8 backdrop-blur-sm sm:px-10`,
            `flex items-center justify-between`,
            `border-b border-slate-200 bg-white/90`
          )}
        >
          <div className="flex min-w-0 items-center gap-3">
            <div>
              <p className="mb-0.5 text-xs font-bold uppercase text-slate-500">
                {t('header.currentBoard')}
              </p>
              <h1 className="truncate text-lg font-bold leading-tight text-slate-950">
                {t('header.appTitle')}
              </h1>
            </div>
            <StatusBadge status={projectionStatus} />
          </div>
          <div className="flex shrink-0 items-center gap-6 whitespace-nowrap">
            <ViewModeToggle value={viewMode} onChange={setViewMode} />
            <Button
              type="button"
              onClick={openCreate}
              icon={<PlusIcon className="h-4 w-4" />}
              className="min-h-8 px-2.5 text-xs"
            >
              {t('header.createRecord')}
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
              className="min-h-8 px-2.5 text-xs"
            >
              {isLoading ? t('header.refreshing') : t('header.refresh')}
            </Button>
            <Button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              icon={<Cog6ToothIcon className="h-4 w-4" />}
              className="min-h-8 px-2.5 text-xs"
            >
              {t('header.settings')}
            </Button>
            <details className="relative">
              <summary className="inline-flex min-h-8 cursor-pointer items-center rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 list-none hover:bg-slate-50">
                <EllipsisHorizontalIcon className="h-4 w-4" />
                <span className="ml-1">{t('header.more')}</span>
              </summary>
              <div className="absolute right-0 top-full z-40 mt-1 w-48 rounded-md border border-slate-200 bg-white py-1 shadow-lg">
                {moreMenuItems.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className="block w-full px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                    onClick={(event) => {
                      item.action()
                      event.currentTarget
                        .closest('details')
                        ?.removeAttribute('open')
                    }}
                    disabled={item.disabled}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </details>
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
            setTagMatch('any')
            setAssignee('')
            updateAssetId('')
            updateRelationTarget('')
            setIncludeArchived(false)
          }}
        />

        <main className="flex min-h-0 flex-col overflow-hidden px-6 pb-10 pt-4 sm:px-8">
          {isRefreshError && (
            <section
              className="mb-1 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-900"
              role="alert"
            >
              <ExclamationTriangleIcon className="h-3.5 w-3.5 shrink-0" />
              <span>
                {t('status.refreshError')}: {error}
              </span>
            </section>
          )}

          {boardExportController.currentExportError && (
            <section
              className="mb-1 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-800"
              role="alert"
            >
              <ExclamationTriangleIcon className="h-3.5 w-3.5 shrink-0" />
              <span>
                {t('status.exportError')}: {boardExportController.currentExportError}
              </span>
            </section>
          )}

          {projectionStatus === 'partial' && (
            <section
              className="mb-1 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-900"
              role="alert"
            >
              <ExclamationTriangleIcon className="h-3.5 w-3.5 shrink-0" />
              <span>{t('status.projectionPartial')}</span>
            </section>
          )}

          <div
            className={
              viewMode === 'board'
                ? 'min-h-0 flex-1 overflow-hidden'
                : 'min-h-0 flex-1 overflow-y-auto'
            }
          >
            {isInitialError && (
              <section
                className="grid gap-1.5 rounded-lg border-2 border-red-300 bg-red-50 p-5 text-red-800"
                role="alert"
              >
                <strong>{t('status.loadError')}</strong>
                <span>{error}</span>
              </section>
            )}

            {isInitialLoad && (
              <section className="rounded-lg border border-slate-200 bg-white p-5 text-slate-500">
                {t('status.loading')}
              </section>
            )}

            {projectionStatus === 'blocked' && (
              <section
                className="grid gap-2 rounded-lg border-2 border-red-300 bg-red-50 p-5 text-red-800"
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

            {projection &&
              projectionStatus !== 'blocked' &&
              records.length === 0 && (
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
                  assetOptions={assetOptions}
                  relationTargetOptions={relationTargetOptions}
                  movingRecordId={statusMoveController.movingRecordId}
                  moveErrors={statusMoveController.moveErrors}
                  visibleColumnIds={visibleBoardColumnIds}
                  columnOrderIds={boardColumnOrderIds}
                  onCardClick={openDetail}
                  onMoveStatus={statusMoveController.moveRecordStatus}
                />
              ) : (
                <section className="grid gap-3.5" aria-label="Current records">
                  {records.map((record) => (
                    <RecordCard
                      key={record.body.id}
                      record={record}
                      profiles={profiles}
                      assetOptions={assetOptions}
                      relationTargetOptions={relationTargetOptions}
                      onCardClick={openDetail}
                    />
                  ))}
                </section>
              ))}

            {viewMode !== 'board' && (
              <IssuesPanel
                blockedRecords={blockedRecords}
                diagnostics={diagnostics}
              />
            )}
          </div>
        </main>
      </div>

      <RecordDetailDrawer
        key={detailRecord?.body.id ?? 'record-detail'}
        open={detailRecord !== null}
        record={detailRecord}
        profiles={profiles}
        assetOptions={assetOptions}
        history={historyController.history}
        isHistoryLoading={historyController.isHistoryLoading}
        historyError={historyController.historyError}
        onClose={closeDetail}
        onHistoryClick={handleDetailHistory}
      />

      <RecordHistoryDrawer
        open={historyController.historySelection !== null && detailRecord === null}
        recordId={historyController.historySelection?.recordId ?? null}
        title={historyController.historySelection?.title}
        pid={historyController.historySelection?.pid}
        history={historyController.history}
        isLoading={historyController.isHistoryLoading}
        error={historyController.historyError}
        profiles={profiles}
        assetOptions={assetOptions}
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
        onSelectDraft={agentDraftController.loadDraftDetail}
        onRefreshList={agentDraftController.loadDraftList}
        onClose={agentDraftController.closeDrawer}
        onUpdateReview={agentDraftController.updateDraftReview}
        suggestions={agentDraftController.suggestions}
        selectedSuggestion={agentDraftController.selectedSuggestion}
        isSuggestionListLoading={agentDraftController.isSuggestionListLoading}
        isSuggestionDetailLoading={agentDraftController.isSuggestionDetailLoading}
        isSuggestionGenerating={agentDraftController.isSuggestionGenerating}
        suggestionListError={agentDraftController.suggestionListError}
        suggestionDetailError={agentDraftController.suggestionDetailError}
        suggestionGenerateError={agentDraftController.suggestionGenerateError}
        onGenerateSuggestion={agentDraftController.generateSuggestion}
        onSelectSuggestion={agentDraftController.loadSuggestionDetail}
        records={records}
        onOpenEditor={handleOpenPatchEditor}
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
          relationTargetOptions={relationTargetOptions}
          relationConstraintOptions={relationConstraintOptions}
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
          relationTargetOptions={relationTargetOptions}
          relationConstraintOptions={relationConstraintOptions}
          initialPatchDescription={editInitialPatchDescription}
          onClose={closeEdit}
          onPatched={refreshAfterPatch}
        />
      )}

      <AppSettingsDrawer
        open={isSettingsOpen}
        visibleColumnOptions={boardColumnOptions}
        visibleColumnIds={visibleBoardColumnIds}
        columnOrderIds={boardColumnOrderIds}
        onVisibleColumnIdsChange={updateVisibleBoardColumnIds}
        onColumnOrderIdsChange={updateBoardColumnOrderIds}
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
    </div>
  )
}
