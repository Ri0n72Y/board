import { useCallback, useEffect, useMemo, useRef } from 'react'
import { DragDropProvider } from '@dnd-kit/react'
import type {
  BoardConfig,
  Profile,
  RecordBody,
  RecordItem,
  RecordResponse,
  Tag,
} from '@labour-board/shared'
import { useTranslation } from 'react-i18next'
import { BoardStatusDropColumn } from './BoardStatusDropColumn'
import { getStatusColumns, groupRecordsByStatus } from '../utils/boardView'
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
import { useBoardStatusDnd } from '../hooks/useBoardStatusDnd'

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
  const visibleStatusTags = useMemo(() => {
    const tags = new Set<Tag>()
    for (const column of columns) {
      if (column.tag?.startsWith('status:')) tags.add(column.tag)
    }
    return tags
  }, [columns])
  const hiddenNoticeKey = visibleColumnIds?.join('|') ?? 'default'
  const isMovePending = movingRecordId != null
  const { handleDragEnd, handleDragStart, registerStatusDropTarget } =
    useBoardStatusDnd({
      records,
      visibleStatusTags,
      isMovePending,
      onMoveStatus,
    })

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
    <DragDropProvider onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
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
                  dragDisabled={isMovePending || !onMoveStatus}
                  registerStatusDropTarget={registerStatusDropTarget}
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
