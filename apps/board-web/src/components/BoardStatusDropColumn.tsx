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
import type { RecordReferenceOption } from '../utils/recordReferenceOptions'
import type { BoardColumnInsertion } from '../hooks/useBoardStatusDnd'
import { cn } from '../lib/cn'
import { lookupProfile } from '../utils/board'
import { formatProfileCompact } from '../utils/profileDisplay'
import {
  useRecordStatusDraggable,
  useStatusColumnDropTarget,
} from '../hooks/useBoardStatusDnd'

interface BoardStatusDropColumnProps {
  column: BoardStatusColumn
  profiles?: Profile[] | null
  assetOptions: RecordReferenceOption[]
  relationTargetOptions: RecordReferenceOption[]
  movingRecordId?: string | null
  moveErrors?: Record<string, string>
  dragDisabled: boolean
  registerStatusDropTarget: (tag: Tag, element: HTMLElement | null) => void
  registerCardTarget: (
    tag: Tag | null,
    recordId: string,
    element: HTMLElement | null
  ) => void
  draggingRecordId?: string | null
  draggingRecord?: RecordResponse<RecordItem<RecordBody>> | null
  hoverInsertion?: BoardColumnInsertion | null
  statusTags?: Tag[]
  onStatusChange?: (
    record: RecordResponse<RecordItem<RecordBody>>,
    statusTag: Tag
  ) => void
  onCardClick?: (record: RecordResponse<RecordItem<RecordBody>>) => void
}

export function BoardStatusDropColumn({
  column,
  profiles,
  assetOptions,
  relationTargetOptions,
  movingRecordId,
  moveErrors,
  dragDisabled,
  registerStatusDropTarget,
  registerCardTarget,
  draggingRecordId,
  draggingRecord,
  hoverInsertion,
  statusTags,
  onStatusChange,
  onCardClick,
}: BoardStatusDropColumnProps) {
  const { t } = useTranslation()
  const { isDropTarget, setDropRef } = useStatusColumnDropTarget({
    columnId: column.id,
    tag: column.tag,
    dragDisabled,
    registerStatusDropTarget,
  })

  const showPreviewInThisColumn =
    column.tag != null &&
    hoverInsertion?.tag === column.tag &&
    draggingRecord != null &&
    draggingRecordId != null
  const previewIndex = showPreviewInThisColumn ? hoverInsertion!.index : -1

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

      {column.records.length > 0 || showPreviewInThisColumn ? (
        <div className="grid min-h-0 auto-rows-max items-start gap-3 overflow-y-auto overscroll-behavior-contain pr-1 [scrollbar-width:thin]">
          {column.records.flatMap((record, index) => [
            showPreviewInThisColumn && index === previewIndex ? (
              <DropPreviewCard
                key="drop-preview"
                record={draggingRecord!}
                profiles={profiles}
              />
            ) : null,
            <DraggableRecordCard
              key={record.body.id}
              columnTag={column.tag}
              record={record}
              profiles={profiles}
              assetOptions={assetOptions}
              relationTargetOptions={relationTargetOptions}
              isMovingStatus={movingRecordId === record.body.id}
              moveStatusError={moveErrors?.[record.body.id] ?? null}
              dragDisabled={dragDisabled}
              registerCardTarget={registerCardTarget}
              statusTags={statusTags}
              onStatusChange={onStatusChange}
              onCardClick={onCardClick}
            />,
          ])}
          {showPreviewInThisColumn && previewIndex >= column.records.length && (
            <DropPreviewCard
              key="drop-preview"
              record={draggingRecord!}
              profiles={profiles}
            />
          )}
        </div>
      ) : (
        <p className="px-1 py-3 text-sm text-slate-400">
          {t('record.noRecords')}
        </p>
      )}
    </section>
  )
}

function DropPreviewCard({
  record,
  profiles,
}: {
  record: RecordResponse<RecordItem<RecordBody>>
  profiles?: Profile[] | null
}) {
  const { t } = useTranslation()
  const cardBody = record.body.body
  const title =
    typeof cardBody === 'object' &&
    cardBody !== null &&
    'title' in cardBody &&
    typeof cardBody.title === 'string'
      ? cardBody.title
      : record.body.pid
  const profile = lookupProfile(profiles ?? null, record.body.assignee ?? '')
  const assigneeDisplay = formatProfileCompact(
    record.body.assignee,
    profile,
    t('record.unassigned'),
    t('record.unknownMember')
  )
  return (
    <div
      className="flex h-fit w-full cursor-default flex-col gap-3 rounded-lg border border-emerald-300 bg-white p-4 opacity-60"
      aria-hidden="true"
    >
      <div className="min-w-0">
        <p className="mb-0.5 font-mono text-xs text-slate-500">
          {record.body.pid}
        </p>
        <p className="line-clamp-2 text-sm font-semibold leading-tight text-slate-950">
          {title}
        </p>
      </div>
      {record.body.assignee && (
        <p className="truncate text-xs text-slate-500">{assigneeDisplay}</p>
      )}
    </div>
  )
}

function DraggableRecordCard({
  columnTag,
  record,
  profiles,
  assetOptions,
  relationTargetOptions,
  isMovingStatus,
  moveStatusError,
  dragDisabled,
  registerCardTarget,
  statusTags,
  onStatusChange,
  onCardClick,
}: {
  columnTag: Tag | null
  record: RecordResponse<RecordItem<RecordBody>>
  profiles?: Profile[] | null
  assetOptions: RecordReferenceOption[]
  relationTargetOptions: RecordReferenceOption[]
  isMovingStatus: boolean
  moveStatusError: string | null
  dragDisabled: boolean
  registerCardTarget: (
    tag: Tag | null,
    recordId: string,
    element: HTMLElement | null
  ) => void
  statusTags?: Tag[]
  onStatusChange?: (
    record: RecordResponse<RecordItem<RecordBody>>,
    statusTag: Tag
  ) => void
  onCardClick?: (record: RecordResponse<RecordItem<RecordBody>>) => void
}) {
  const { cardRef, isDragging } = useRecordStatusDraggable({
    recordId: record.body.id,
    dragDisabled,
  })

  return (
    <div
      className="min-w-0"
      ref={(element) => registerCardTarget(columnTag, record.body.id, element)}
    >
      <RecordCard
        record={record}
        profiles={profiles}
        assetOptions={assetOptions}
        relationTargetOptions={relationTargetOptions}
        compact
        isMovingStatus={isMovingStatus}
        moveStatusError={moveStatusError}
        isDragging={isDragging}
        dragRef={cardRef}
        statusTags={statusTags}
        onStatusChange={onStatusChange}
        onCardClick={onCardClick}
      />
    </div>
  )
}
