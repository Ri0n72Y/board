import type { RecordId, RecordItem } from './record.js'

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
