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
import { getMoveStatusOptions } from '../utils/statusMove'
import type { MoveStatusOption } from '../utils/statusMove'
import { formatTagLabel } from '../utils/tagDisplay'

interface BoardViewProps {
  records: RecordResponse<RecordItem<RecordBody>>[]
  config: BoardConfig | null
  profiles?: Profile[] | null
  onHistoryClick?: (record: RecordResponse<RecordItem<RecordBody>>) => void
  onEditClick?: (record: RecordResponse<RecordItem<RecordBody>>) => void
  movingRecordId?: string | null
  moveErrors?: Record<string, string>
  onMoveStatus?: (
    record: RecordResponse<RecordItem<RecordBody>>,
    targetStatusTag: Tag,
  ) => void
}

export function BoardView({
  records,
  config,
  profiles,
  onHistoryClick,
  onEditClick,
  movingRecordId,
  moveErrors,
  onMoveStatus,
}: BoardViewProps) {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage
  const tagLabel = useCallback((tag: string) => formatTagLabel(tag, lang), [lang])
  const columns = useMemo(() => {
    const statusColumns = getStatusColumns(config, records, tagLabel)
    return groupRecordsByStatus(records, statusColumns)
  }, [config, records, tagLabel])
  const moveStatusOptions: MoveStatusOption[] = useMemo(
    () => getMoveStatusOptions(columns),
    [columns],
  )

  return (
    <section className="mt-4" aria-label="Current records board">
      <div className="overflow-x-auto pb-3">
        <div className="grid min-w-full gap-3 sm:auto-cols-[20rem] sm:grid-flow-col sm:grid-cols-none">
          {columns.map((column) => (
            <section
              key={column.id}
              className="grid min-h-48 content-start gap-3 rounded-lg border border-slate-200 bg-slate-100 p-3 sm:w-80"
              aria-label={column.label}
            >
              <header className="flex min-w-0 items-center justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-bold text-slate-950">
                    {column.label}
                  </h2>
                  {column.tag && (
                    <p className="truncate font-mono text-xs text-slate-500">
                      {column.tag}
                    </p>
                  )}
                </div>
                <span className="inline-flex min-h-7 min-w-7 shrink-0 items-center justify-center rounded-full bg-white px-2 text-xs font-bold text-slate-600">
                  {column.records.length}
                </span>
              </header>

              {column.records.length > 0 ? (
                <div className="grid gap-3">
                  {column.records.map((record) => (
                    <RecordCard
                      key={record.body.id}
                      record={record}
                      profiles={profiles}
                      compact
                      moveStatusOptions={moveStatusOptions}
                      isMovingStatus={movingRecordId === record.body.id}
                      moveStatusError={moveErrors?.[record.body.id] ?? null}
                      onHistoryClick={onHistoryClick}
                      onEditClick={onEditClick}
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
    </section>
  )
}
