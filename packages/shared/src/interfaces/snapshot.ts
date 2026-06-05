import type { BoardCurrentProjection } from './boardCurrent.js'
import type { PublicKey, RecordId, RecordItem } from './record.js'

export type SnapshotSource =
  | 'manual'
  | 'scheduled'
  | 'startup-rebuild'
  | 'transaction'
  | 'local-cache'

export interface SnapshotItem {
  id: string
  projectKey?: string
  generatedAt: string
  generatedBy?: string
  source: SnapshotSource
  baseSnapshotId?: string
  latestPatchId?: string
  latestPatchPid?: string
  latestPatchAppliedAt?: string
  recordCount: number
  patchCount?: number
  records: Record<RecordId, RecordItem>
  description?: string
  meta?: Record<string, unknown>
}

export interface SnapshotSummary {
  id: string
  createdAt: string
  createdBy: PublicKey
  reason?: string
  recordCount: number
  patchCount?: number
  source: 'manual'
  projectionStatus: BoardCurrentProjection['summary']['projectionStatus']
}

export interface SnapshotDetail extends SnapshotSummary {
  projection: BoardCurrentProjection
}

export interface CreateSnapshotInput {
  reason?: string
}

export interface CreateSnapshotResponse {
  snapshot: SnapshotDetail
}

export interface ListSnapshotsResponse {
  snapshots: SnapshotSummary[]
}

export interface GetSnapshotResponse {
  snapshot: SnapshotDetail
}
