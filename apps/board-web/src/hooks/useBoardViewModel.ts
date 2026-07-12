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
  resolveVisibleColumnIds,
  summarizeHiddenColumns,
} from '../utils/boardViewColumns'
import { getMoveStatusOptions } from '../utils/statusMove'
import type { MoveStatusOption } from '../utils/statusMove'
import { formatTagLabel } from '../utils/tagDisplay'

interface UseBoardViewModelArgs {
  records: RecordResponse<RecordItem<RecordBody>>[]
  config: BoardConfig | null
  language: string | undefined
  visibleColumnIds?: string[] | null
}

export function useBoardViewModel({
  records,
  config,
  language,
  visibleColumnIds,
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
    return groupRecordsByStatus(records, statusColumns)
  }, [config, records, tagLabel, uncategorizedLabel])

  const columns = useMemo(() => {
    const columnsById = new Map(allColumns.map((column) => [column.id, column]))
    const selectedIds = resolveVisibleColumnIds(
      allColumns.map((column) => column.id),
      visibleColumnIds
    )
    return selectedIds
      .map((id) => columnsById.get(id))
      .filter((column): column is (typeof allColumns)[number] => column != null)
  }, [allColumns, visibleColumnIds])

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
