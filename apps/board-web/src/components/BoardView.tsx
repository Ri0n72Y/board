import { useCallback, useMemo } from 'react'
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
    targetStatusTag: Tag,
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
  const tagLabel = useCallback((tag: string) => formatTagLabel(tag, lang), [lang])
  const uncategorizedLabel = getUncategorizedColumnLabel(lang)
  const columns = useMemo(() => {
    const statusColumns = getStatusColumns(config, records, tagLabel, {
      uncategorizedLabel,
    })
    const groupedColumns = groupRecordsByStatus(records, statusColumns)
    const selectedIds = resolveVisibleColumnIds(
      groupedColumns.map((column) => column.id),
      visibleColumnIds,
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
        columns.map((column) => column.id),
      ),
    [allColumns, columns],
  )
  const moveStatusOptions: MoveStatusOption[] = useMemo(
    () => getMoveStatusOptions(allColumns),
    [allColumns],
  )

  return (
    <section className="mt-4" aria-label="Current records board">
      {(hiddenSummary.hiddenRecordCount > 0 ||
        hiddenSummary.hiddenUncategorizedRecordCount > 0) && (
        <div className="mb-3 grid gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {hiddenSummary.hiddenRecordCount > 0 && (
            <p>
              {t('board.hiddenColumnsNotice', {
                count: hiddenSummary.hiddenColumnCount,
                columns: hiddenSummary.hiddenColumnCount,
                records: hiddenSummary.hiddenRecordCount,
              })}
            </p>
          )}
          {hiddenSummary.hiddenUncategorizedRecordCount > 0 && (
            <p>
              {t('board.hiddenUncategorizedNotice', {
                count: hiddenSummary.hiddenUncategorizedRecordCount,
              })}
            </p>
          )}
        </div>
      )}
      <div className="rounded-lg border border-slate-200 bg-white/70 p-2">
        <p className="mb-2 px-1 text-xs font-medium text-slate-500">
          {t('board.horizontalScrollHint')}
        </p>
        <div className="overflow-x-auto pb-3 [scrollbar-width:thin]">
          <div className="grid min-w-full auto-cols-[minmax(20rem,1fr)] grid-flow-col gap-3">
          {columns.map((column) => (
            <section
              key={column.id}
              className="grid max-h-[calc(100svh-16rem)] min-h-80 grid-rows-[auto_minmax(0,1fr)] gap-3 rounded-lg border border-slate-200 bg-slate-100 p-3"
              aria-label={column.label}
            >
              <header className="sticky top-0 z-10 flex min-w-0 items-center justify-between gap-3 bg-slate-100 pb-1">
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
                <div className="grid min-h-0 gap-3 overflow-y-auto pr-1 [scrollbar-width:thin]">
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
