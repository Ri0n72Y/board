import { useEffect, useRef } from 'react'
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
import type { RecordReferenceOption } from '../utils/recordReferenceOptions'
import { APP_TOAST_IDS, dismissToast, toastInfo } from '../utils/toasts'
import { useBoardStatusDnd } from '../hooks/useBoardStatusDnd'
import { useBoardViewModel } from '../hooks/useBoardViewModel'

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
  const { columns, hiddenSummary, visibleStatusTags } = useBoardViewModel({
    records,
    config,
    language: lang,
    visibleColumnIds,
  })
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
                  movingRecordId={movingRecordId}
                  moveErrors={moveErrors}
                  dragDisabled={isMovePending || !onMoveStatus}
                  registerStatusDropTarget={registerStatusDropTarget}
                  onCardClick={onCardClick}
                />
              ))}
            </div>
          </div>
        </div>
      </section>
    </DragDropProvider>
  )
}
