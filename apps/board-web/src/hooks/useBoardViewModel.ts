import { useCallback, useMemo } from 'react'
import type {
  BoardConfig,
  RecordBody,
  RecordItem,
  RecordResponse,
  Tag,
} from '@labour-board/shared'
import { getStatusColumns, groupRecordsByStatus } from '../utils/boardView'
import {
  getUncategorizedColumnLabel,
  resolveColumnOrderIds,
  resolveVisibleColumnIds,
  summarizeHiddenColumns,
} from '../utils/boardViewColumns'
import {
  applyRecordOrder,
  resolveRecordOrderForColumn,
  type BoardRecordOrderPreference,
} from '../utils/boardRecordOrder'
import { getMoveStatusOptions } from '../utils/statusMove'
import type { MoveStatusOption } from '../utils/statusMove'
import { formatTagLabel } from '../utils/tagDisplay'

interface UseBoardViewModelArgs {
  records: RecordResponse<RecordItem<RecordBody>>[]
  config: BoardConfig | null
  language: string | undefined
  visibleColumnIds?: string[] | null
  columnOrderIds?: string[] | null
  recordOrder?: BoardRecordOrderPreference | null
}

export function useBoardViewModel({
  records,
  config,
  language,
  visibleColumnIds,
  columnOrderIds,
  recordOrder,
}: UseBoardViewModelArgs) {
  const tagLabel = useCallback(
    (tag: string) => formatTagLabel(tag, language),
    [language]
  )
  const uncategorizedLabel = getUncategorizedColumnLabel(language)

  const allColumns = useMemo(() => {
    const statusColumns = getStatusColumns(config, records, tagLabel, {
      uncategorizedLabel,
    })
    const grouped = groupRecordsByStatus(records, statusColumns)
    if (!recordOrder) return grouped
    return grouped.map((column) => {
      const orderedIds = resolveRecordOrderForColumn(recordOrder, column.id)
      if (orderedIds.length === 0) return column
      return {
        ...column,
        records: applyRecordOrder(column.records, orderedIds),
      }
    })
  }, [config, records, tagLabel, uncategorizedLabel, recordOrder])

  const columns = useMemo(() => {
    const columnsById = new Map(allColumns.map((column) => [column.id, column]))
    const orderedIds = resolveColumnOrderIds(
      allColumns.map((column) => column.id),
      columnOrderIds
    )
    const selectedIds = resolveVisibleColumnIds(orderedIds, visibleColumnIds)
    const selected = new Set(selectedIds)
    return orderedIds
      .filter((id) => selected.has(id))
      .map((id) => columnsById.get(id))
      .filter((column): column is (typeof allColumns)[number] => column != null)
  }, [allColumns, columnOrderIds, visibleColumnIds])

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

  return {
    allColumns,
    columns,
    hiddenSummary,
    moveStatusOptions,
    visibleStatusTags,
  }
}
