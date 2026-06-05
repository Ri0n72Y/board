import type {
  DeepPartial,
  PatchItem,
  PublicKey,
  RecordBody,
  RecordId,
  RecordItem,
  RecordResponse,
} from '@labour-board/shared'
import type { AppendPatchResult, StoredPatchDoc } from '../../repositories/snapshotHeadRepository.js'
import type { StoredRecordDoc } from '../../repositories/recordRepository.js'

// ─── API response DTO types ───

export type BoardRecordResponse = RecordResponse<RecordItem<RecordBody>>
export type BoardPatchResponse = RecordResponse<
  PatchItem<DeepPartial<RecordBody>>
>

export interface PatchResult {
  patch: BoardPatchResponse
  /** The new dynamic current-head version after this patch was committed. */
  newCurrentVersion: number
  /** Deprecated compatibility alias for legacy clients. */
  newSnapshotVersion?: number
}

// ─── Error types ───

export class RecordValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RecordValidationError'
  }
}

export class SnapshotConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SnapshotConflictError'
  }
}

export class CurrentHeadConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CurrentHeadConflictError'
  }
}

// ─── Constants ───

export const DEFAULT_ACTOR: PublicKey = 'local' as PublicKey

// ─── Response helpers ───

export function toRecordResponse(doc: StoredRecordDoc): BoardRecordResponse {
  const { createdBy, createdAt, ...body } = doc
  if (!createdBy || !createdAt) {
    throw new Error(
      `Record ${doc.id} is missing audit fields: createdBy=${createdBy}, createdAt=${createdAt}`
    )
  }
  return { createdBy, createdAt, body }
}

export function toPatchResponse(doc: StoredPatchDoc): BoardPatchResponse {
  const { createdBy, createdAt, ...body } = doc
  if (!createdBy || !createdAt) {
    throw new Error(
      `Patch ${doc.id} is missing audit fields: createdBy=${createdBy}, createdAt=${createdAt}`
    )
  }
  return { createdBy, createdAt, body }
}

export function resolveActor(headerValue: string | undefined): PublicKey {
  const trimmed = headerValue?.trim()
  if (trimmed) {
    return trimmed as PublicKey
  }
  return DEFAULT_ACTOR
}

// ─── Append result assertion (shared by patch submit and archive) ───

export function assertAppendPatchResult(
  result: AppendPatchResult,
  snapshotVersion: number,
  parentId: RecordId | null
): asserts result is Extract<AppendPatchResult, { ok: true }> {
  if (result.ok) {
    return
  }

  if (result.reason === 'snapshotVersionMismatch') {
    throw new SnapshotConflictError(
      `Snapshot version mismatch: client has ${snapshotVersion}, server has ${result.currentVersion}`
    )
  }

  if (result.reason === 'parentMismatch') {
    throw new SnapshotConflictError(
      `Parent patch mismatch: client has ${parentId}, server has ${result.currentParentId}`
    )
  }

  if (result.reason === 'parentPatchMissing') {
    throw new RecordValidationError(
      `Parent patch ${result.parentId} does not exist`
    )
  }

  throw new RecordValidationError(
    `Parent patch ${result.parentId} does not belong to record ${result.parentTargetId}`
  )
}
