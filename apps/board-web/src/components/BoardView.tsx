import { useCallback, useEffect, useMemo, useRef } from 'react'
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
import { dismissToast, toastInfo } from '../utils/toasts'

const BOARD_HIDDEN_COLUMNS_TOAST_ID = 'board-hidden-columns'

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
  onToastHint?: (msg: string | null) => void
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
      toastInfo(parts.join(' '), BOARD_HIDDEN_COLUMNS_TOAST_ID)
    } else {
      dismissToast(BOARD_HIDDEN_COLUMNS_TOAST_ID)
    }
  }, [hiddenNoticeKey, hiddenSummary, t])

  return (
    <section className="h-full min-h-0" aria-label="Current records board">
      <div className="h-full min-h-0 rounded-lg border border-slate-200 bg-white/70 p-3 pb-5">
        <div className="h-full min-h-0 overflow-x-auto pb-4 [scrollbar-width:thin]">
          <div className="grid h-full w-max auto-cols-[24rem] grid-flow-col items-stretch gap-4">
            {columns.map((column) => (
              <section
                key={column.id}
                className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3 rounded-lg border border-slate-200 bg-slate-100 p-4"
                aria-label={column.label}
              >
                <header className="flex min-w-0 items-center justify-between gap-3 bg-slate-100 pb-1">
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
                      <RecordCard
                        key={record.body.id}
                        record={record}
                        profiles={profiles}
                        assetOptions={assetOptions}
                        relationTargetOptions={relationTargetOptions}
                        compact
                        moveStatusOptions={moveStatusOptions}
                        isMovingStatus={movingRecordId === record.body.id}
                        moveStatusError={moveErrors?.[record.body.id] ?? null}
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
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
