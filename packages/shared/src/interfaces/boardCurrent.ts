import type { RecordHistoryDiagnostic } from './api.js'
import type { RecordBody, RecordItem } from './record.js'
import type { RecordResponse } from './api.js'
import type { Tag } from './tag.js'

// ─── Board projection status ───

export type BoardProjectionStatus = 'clean' | 'partial' | 'blocked' | 'empty'

// ─── Board-level diagnostic ───

export interface ProjectionDiagnostic {
  code: string
  message: string
}

// ─── Blocked record entry ───

export interface BlockedRecordEntry {
  recordId: string
  status: 'broken' | 'conflicted'
  diagnostics: RecordHistoryDiagnostic[]
}

// ─── Board current summary ───

export interface BoardCurrentSummary {
  totalBaseRecords: number
  visibleCurrentRecords: number
  archivedRecords: number
  blockedRecords: number
  projectionStatus: BoardProjectionStatus
}

// ─── Board current projection (API response) ───

export interface BoardCurrentProjection {
  snapshotHeadVersion: number
  records: RecordResponse<RecordItem<RecordBody>>[]
  blockedRecords: BlockedRecordEntry[]
  summary: BoardCurrentSummary
  /** Board-level projection issues (e.g. corrupted snapshot head). */
  diagnostics?: ProjectionDiagnostic[]
}

export type BoardCurrentTagMatch = 'all' | 'any'

export interface BoardCurrentQuery {
  tags?: Tag[]
  tagMatch?: BoardCurrentTagMatch
  assignee?: string
  assetId?: string
  relationTarget?: string
  q?: string
  includeArchived?: boolean
}
