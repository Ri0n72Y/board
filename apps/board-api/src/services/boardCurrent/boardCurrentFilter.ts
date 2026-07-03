import type { BoardCurrentQuery } from '@labour-board/shared'
import {
  filterBoardRecords,
  recordMatchesBoardFilter,
} from '@labour-board/shared'
import type { BoardRecordResponse } from '../record/recordResponses.js'

export function filterBoardCurrentRecords(
  records: BoardRecordResponse[],
  query: BoardCurrentQuery
): BoardRecordResponse[] {
  return filterBoardRecords(records, query) as BoardRecordResponse[]
}

export function matchesBoardCurrentQuery(
  envelope: BoardRecordResponse,
  query: BoardCurrentQuery
): boolean {
  return recordMatchesBoardFilter(envelope, query)
}
