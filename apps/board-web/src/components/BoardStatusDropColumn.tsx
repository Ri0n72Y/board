import type {
  Profile,
  RecordBody,
  RecordItem,
  RecordResponse,
  Tag,
} from '@labour-board/shared'
import { useTranslation } from 'react-i18next'
import { RecordCard } from './RecordCard'
import type { BoardStatusColumn } from '../utils/boardView'
import type { MoveStatusOption } from '../utils/statusMove'
import type { RecordReferenceOption } from '../utils/recordReferenceOptions'
import { cn } from '../lib/cn'
import {
  useRecordStatusDraggable,
  useStatusColumnDropTarget,
} from '../hooks/useBoardStatusDnd'

interface BoardStatusDropColumnProps {
  column: BoardStatusColumn
  profiles?: Profile[] | null
  assetOptions: RecordReferenceOption[]
  relationTargetOptions: RecordReferenceOption[]
  moveStatusOptions: MoveStatusOption[]
  movingRecordId?: string | null
  moveErrors?: Record<string, string>
  dragDisabled: boolean
  registerStatusDropTarget: (tag: Tag, element: HTMLElement | null) => void
  onCardClick?: (record: RecordResponse<RecordItem<RecordBody>>) => void
  onMoveStatus?: (
    record: RecordResponse<RecordItem<RecordBody>>,
    targetStatusTag: Tag
  ) => void
}

export function BoardStatusDropColumn({
  column,
  profiles,
  assetOptions,
  relationTargetOptions,
  moveStatusOptions,
  movingRecordId,
  moveErrors,
  dragDisabled,
  registerStatusDropTarget,
  onCardClick,
  onMoveStatus,
}: BoardStatusDropColumnProps) {
  const { t } = useTranslation()
  const { isDropTarget, setDropRef } = useStatusColumnDropTarget({
    columnId: column.id,
    tag: column.tag,
    dragDisabled,
    registerStatusDropTarget,
  })

  return (
    <section
      ref={setDropRef}
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
  const { cardRef, dragHandleRef, isDragging } = useRecordStatusDraggable({
    recordId: record.body.id,
    dragDisabled,
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
      dragRef={cardRef}
      dragHandleRef={dragHandleRef}
      onCardClick={onCardClick}
      onMoveStatus={onMoveStatus}
    />
  )
}
