import type {
  RecordBody,
  RecordHistoryDiagnostic,
  RecordId,
  RecordItem,
} from '@labour-board/shared'
import type { StoredRecordDoc } from '../../repositories/recordRepository.js'
import type { StoredPatchDoc } from '../../repositories/snapshotHeadRepository.js'
import { reconstructPatchChain, replayRecordHistory } from '../record/recordHistory.js'

// ─── Domain types ───

export type ProjectionStatus = 'ok' | 'blocked'

export interface RecordCurrentOk {
  status: 'ok'
  current: RecordItem<RecordBody>
}

export interface RecordCurrentBlocked {
  status: 'blocked'
  chainStatus: 'broken' | 'conflicted'
  diagnostics: RecordHistoryDiagnostic[]
}

export type RecordCurrentProjection = RecordCurrentOk | RecordCurrentBlocked

// ─── Projection helper ───

/**
 * Projects a single record's current state from its base record and patch facts.
 *
 * - `empty` / `complete` chain → status `ok`, current = replayed final state.
 * - `broken` / `conflicted` chain → status `blocked`, no pseudo-current.
 *
 * This is a pure read-only projection. It does not access any repository,
 * write any data, or read the snapshot head. Patch ordering is determined
 * solely by parent chain, never by `createdAt` or Mongo natural order.
 */
export function projectRecordCurrent(
  record: StoredRecordDoc,
  patches: StoredPatchDoc[]
): RecordCurrentProjection {
  const targetId = record.id as RecordId
  const { orderedPatches, status, diagnostics } = reconstructPatchChain(
    patches,
    targetId
  )

  if (status === 'broken' || status === 'conflicted') {
    return { status: 'blocked', chainStatus: status, diagnostics }
  }

  // empty or complete — produce current state via replay
  const { createdBy: _cb, createdAt: _ca, ...baseItem } = record
  const { finalState } =
    status === 'complete'
      ? replayRecordHistory(baseItem, orderedPatches)
      : { finalState: baseItem }

  return { status: 'ok', current: finalState }
}

// ─── Convenience predicates ───

export function isArchivedInCurrent(
  projection: RecordCurrentProjection
): boolean {
  return (
    projection.status === 'ok' &&
    projection.current.tags.includes('status:archived')
  )
}
