import { useCallback, useEffect, useMemo, useRef } from 'react'
import type { Ref } from 'react'
import { DragDropProvider, useDraggable, useDroppable } from '@dnd-kit/react'
import type {
  BoardConfig,
  Profile,
  RecordBody,
  RecordItem,
  RecordResponse,
  Tag,
} from '@labour-board/shared'
import { useTranslation } from 'react-i18next'
import { RecordCard } from './RecordCard'
import {
  getStatusColumns,
  groupRecordsByStatus,
  type BoardStatusColumn,
} from '../utils/boardView'
import {
  getUncategorizedColumnLabel,
  resolveVisibleColumnIds,
  summarizeHiddenColumns,
} from '../utils/boardViewColumns'
import { getMoveStatusOptions } from '../utils/statusMove'
import type { MoveStatusOption } from '../utils/statusMove'
import { formatTagLabel } from '../utils/tagDisplay'
import type { RecordReferenceOption } from '../utils/recordReferenceOptions'
import { APP_TOAST_IDS, dismissToast, toastInfo } from '../utils/toasts'
import { cn } from '../lib/cn'

const BOARD_RECORD_DND_TYPE = 'board-record-status-card'
const RECORD_DRAG_ID_PREFIX = 'record:'
const STATUS_DROP_ID_PREFIX = 'status-column:'

interface BoardViewProps {
  records: RecordResponse<RecordItem<RecordBody>>[]
  config: BoardConfig | null
  profiles?: Profile[] | null
  assetOptions: RecordReferenceOption[]
  relationTargetOptions: RecordReferenceOption[]
  onCardClick?: (record: RecordResponse<RecordItem<RecordBody>>) => void
  movingRecordId?: string | null
  moveErrors?: Record<string, string>
  visibleColumnIds?: string[] | null
  onMoveStatus?: (
    record: RecordResponse<RecordItem<RecordBody>>,
    targetStatusTag: Tag
  ) => void
}

export function BoardView({
  records,
  config,
  profiles,
  assetOptions,
  relationTargetOptions,
  onCardClick,
  movingRecordId,
  moveErrors,
  visibleColumnIds,
  onMoveStatus,
}: BoardViewProps) {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage
  const hiddenNoticeKeyRef = useRef<string | null>(null)
  const tagLabel = useCallback(
    (tag: string) => formatTagLabel(tag, lang),
    [lang]
  )
  const uncategorizedLabel = getUncategorizedColumnLabel(lang)
  const columns = useMemo(() => {
    const statusColumns = getStatusColumns(config, records, tagLabel, {
      uncategorizedLabel,
    })
    const groupedColumns = groupRecordsByStatus(records, statusColumns)
    const selectedIds = resolveVisibleColumnIds(
      groupedColumns.map((column) => column.id),
      visibleColumnIds
    )
    const visible = new Set(selectedIds)
    return groupedColumns.filter((column) => visible.has(column.id))
  }, [config, records, tagLabel, uncategorizedLabel, visibleColumnIds])
  const allColumns = useMemo(() => {
    const statusColumns = getStatusColumns(config, records, tagLabel, {
      uncategorizedLabel,
    })
    return groupRecordsByStatus(records, statusColumns)
  }, [config, records, tagLabel, uncategorizedLabel])
  const hiddenSummary = useMemo(
    () =>
      summarizeHiddenColumns(
        allColumns,
        columns.map((column) => column.id)
      ),
    [allColumns, columns]
  )
  const moveStatusOptions: MoveStatusOption[] = useMemo(
    () => getMoveStatusOptions(allColumns),
    [allColumns]
  )
  const recordsById = useMemo(() => {
    const byId = new Map<string, RecordResponse<RecordItem<RecordBody>>>()
    for (const record of records) byId.set(record.body.id, record)
    return byId
  }, [records])
  const visibleStatusTags = useMemo(() => {
    const tags = new Set<Tag>()
    for (const column of columns) {
      if (column.tag?.startsWith('status:')) tags.add(column.tag)
    }
    return tags
  }, [columns])
  const hiddenNoticeKey = visibleColumnIds?.join('|') ?? 'default'

  // Show hidden columns notice only on board entry and visible-column preference changes.
  useEffect(() => {
    if (hiddenNoticeKeyRef.current === hiddenNoticeKey) return
    hiddenNoticeKeyRef.current = hiddenNoticeKey

    const parts: string[] = []
    if (hiddenSummary.hiddenRecordCount > 0) {
      parts.push(
        t('board.hiddenColumnsNotice', {
          count: hiddenSummary.hiddenColumnCount,
          columns: hiddenSummary.hiddenColumnCount,
          records: hiddenSummary.hiddenRecordCount,
        })
      )
    }
    if (hiddenSummary.hiddenUncategorizedRecordCount > 0) {
      parts.push(
        t('board.hiddenUncategorizedNotice', {
          count: hiddenSummary.hiddenUncategorizedRecordCount,
        })
      )
    }
    if (parts.length > 0) {
      toastInfo(parts.join(' '), APP_TOAST_IDS.boardHiddenColumns)
    } else {
      dismissToast(APP_TOAST_IDS.boardHiddenColumns)
    }
  }, [hiddenNoticeKey, hiddenSummary, t])

  return (
    <DragDropProvider
      onDragEnd={(event) => {
        if (event.canceled || movingRecordId || !onMoveStatus) return

        const recordId = parseRecordDragId(event.operation.source?.id)
        const targetStatusTag = parseStatusDropId(event.operation.target?.id)
        if (!recordId || !targetStatusTag) return
        if (!visibleStatusTags.has(targetStatusTag)) return

        const record = recordsById.get(recordId)
        if (!record) return
        const currentStatus =
          record.body.tags.find((tag) => tag.startsWith('status:')) ?? null
        if (currentStatus === targetStatusTag) return

        onMoveStatus(record, targetStatusTag)
      }}
    >
      <section className="h-full min-h-0" aria-label="Current records board">
        <div className="h-full min-h-0 rounded-lg border border-slate-200 bg-white/70 p-3 pb-5">
          <div className="h-full min-h-0 overflow-x-auto pb-4 [scrollbar-width:thin]">
            <div className="grid h-full w-max auto-cols-[24rem] grid-flow-col items-stretch gap-4">
              {columns.map((column) => (
                <BoardStatusDropColumn
                  key={column.id}
                  column={column}
                  profiles={profiles}
                  assetOptions={assetOptions}
                  relationTargetOptions={relationTargetOptions}
                  moveStatusOptions={moveStatusOptions}
                  movingRecordId={movingRecordId}
                  moveErrors={moveErrors}
                  dragDisabled={movingRecordId !== null || !onMoveStatus}
                  onCardClick={onCardClick}
                  onMoveStatus={onMoveStatus}
                />
              ))}
            </div>
          </div>
        </div>
      </section>
    </DragDropProvider>
  )
}

function BoardStatusDropColumn({
  column,
  profiles,
  assetOptions,
  relationTargetOptions,
  moveStatusOptions,
  movingRecordId,
  moveErrors,
  dragDisabled,
  onCardClick,
  onMoveStatus,
}: {
  column: BoardStatusColumn
  profiles?: Profile[] | null
  assetOptions: RecordReferenceOption[]
  relationTargetOptions: RecordReferenceOption[]
  moveStatusOptions: MoveStatusOption[]
  movingRecordId?: string | null
  moveErrors?: Record<string, string>
  dragDisabled: boolean
  onCardClick?: (record: RecordResponse<RecordItem<RecordBody>>) => void
  onMoveStatus?: (
    record: RecordResponse<RecordItem<RecordBody>>,
    targetStatusTag: Tag
  ) => void
}) {
  const { t } = useTranslation()
  const isStatusDropTarget = column.tag?.startsWith('status:') ?? false
  const { ref, isDropTarget } = useDroppable({
    id: column.tag ? `${STATUS_DROP_ID_PREFIX}${column.tag}` : column.id,
    accept: BOARD_RECORD_DND_TYPE,
    disabled: !isStatusDropTarget || dragDisabled,
  })

  return (
    <section
      ref={ref as unknown as Ref<HTMLElement>}
      className={cn(
        'grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3 rounded-lg border border-slate-200 bg-slate-100 p-4 transition-colors',
        isDropTarget && 'border-emerald-400 bg-emerald-50'
      )}
      aria-label={column.label}
    >
      <header className="flex min-w-0 items-center justify-between gap-3 bg-transparent pb-1">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-bold text-slate-950">
            {column.label}
          </h2>
        </div>
        <span className="inline-flex min-h-7 min-w-7 shrink-0 items-center justify-center rounded-full bg-white px-2 text-xs font-bold text-slate-600">
          {column.records.length}
        </span>
      </header>

      {column.records.length > 0 ? (
        <div className="grid min-h-0 auto-rows-max items-start gap-3 overflow-y-auto pr-1 [scrollbar-width:thin]">
          {column.records.map((record) => (
            <DraggableRecordCard
              key={record.body.id}
              record={record}
              profiles={profiles}
              assetOptions={assetOptions}
              relationTargetOptions={relationTargetOptions}
              moveStatusOptions={moveStatusOptions}
              isMovingStatus={movingRecordId === record.body.id}
              moveStatusError={moveErrors?.[record.body.id] ?? null}
              dragDisabled={dragDisabled}
              onCardClick={onCardClick}
              onMoveStatus={onMoveStatus}
            />
          ))}
        </div>
      ) : (
        <p className="rounded-md border border-dashed border-slate-300 bg-white px-3 py-4 text-sm text-slate-500">
          {t('record.noRecords')}
        </p>
      )}
    </section>
  )
}

function DraggableRecordCard({
  record,
  profiles,
  assetOptions,
  relationTargetOptions,
  moveStatusOptions,
  isMovingStatus,
  moveStatusError,
  dragDisabled,
  onCardClick,
  onMoveStatus,
}: {
  record: RecordResponse<RecordItem<RecordBody>>
  profiles?: Profile[] | null
  assetOptions: RecordReferenceOption[]
  relationTargetOptions: RecordReferenceOption[]
  moveStatusOptions: MoveStatusOption[]
  isMovingStatus: boolean
  moveStatusError: string | null
  dragDisabled: boolean
  onCardClick?: (record: RecordResponse<RecordItem<RecordBody>>) => void
  onMoveStatus?: (
    record: RecordResponse<RecordItem<RecordBody>>,
    targetStatusTag: Tag
  ) => void
}) {
  const { ref, handleRef, isDragging } = useDraggable({
    id: `${RECORD_DRAG_ID_PREFIX}${record.body.id}`,
    type: BOARD_RECORD_DND_TYPE,
    disabled: dragDisabled,
  })

  return (
    <RecordCard
      record={record}
      profiles={profiles}
      assetOptions={assetOptions}
      relationTargetOptions={relationTargetOptions}
      compact
      moveStatusOptions={moveStatusOptions}
      isMovingStatus={isMovingStatus}
      moveStatusError={moveStatusError}
      isDragEnabled={!dragDisabled}
      isDragging={isDragging || isMovingStatus}
      dragRef={ref as unknown as Ref<HTMLElement>}
      dragHandleRef={handleRef as unknown as Ref<HTMLButtonElement>}
      onCardClick={onCardClick}
      onMoveStatus={onMoveStatus}
    />
  )
}

function parseRecordDragId(id: string | number | null | undefined): string | null {
  if (typeof id !== 'string') return null
  if (!id.startsWith(RECORD_DRAG_ID_PREFIX)) return null
  return id.slice(RECORD_DRAG_ID_PREFIX.length) || null
}

function parseStatusDropId(id: string | number | null | undefined): Tag | null {
  if (typeof id !== 'string') return null
  if (!id.startsWith(STATUS_DROP_ID_PREFIX)) return null
  const tag = id.slice(STATUS_DROP_ID_PREFIX.length)
  return tag.startsWith('status:') ? (tag as Tag) : null
}
