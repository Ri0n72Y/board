import type { RecordId, Tag } from '@labour-board/shared'
import type { RecordRepository } from '../../repositories/recordRepository.js'
import type {
  SnapshotHead,
  SnapshotHeadRepository,
  StoredPatchDoc,
} from '../../repositories/snapshotHeadRepository.js'
import { SnapshotHeadIntegrityError } from '../../repositories/snapshotHeadRepository.js'
import { reconstructPatchChain, replayRecordHistory } from './recordHistory.js'
import {
  type BoardRecordResponse,
  DEFAULT_ACTOR,
  SnapshotConflictError,
  assertAppendPatchResult,
  toRecordResponse,
} from './recordResponses.js'

export interface ArchiveRecordParams {
  id: string
  repository: RecordRepository
  snapshotHeadRepository: SnapshotHeadRepository
}

export async function archiveRecord(
  params: ArchiveRecordParams
): Promise<BoardRecordResponse | null> {
  const { id, repository, snapshotHeadRepository } = params

  const record = await repository.findById(id)
  if (!record) {
    return null
  }

  // Already archived — return current state without appending another patch
  if (record.tags.includes('status:archived')) {
    return toRecordResponse(record)
  }

  // ── 1. Load snapshot head FIRST to establish expected state ──
  let head: SnapshotHead
  try {
    head = await snapshotHeadRepository.loadSnapshotHead()
  } catch (caught) {
    if (caught instanceof SnapshotHeadIntegrityError) {
      throw new SnapshotConflictError(
        `Cannot archive record ${id}: snapshot head is corrupted — ${caught.message}`
      )
    }
    throw caught
  }
  const expectedSnapshotVersion = head.version
  const expectedParentId =
    (head.records[id as RecordId]?.lastPatchId as RecordId | null) ?? null

  // ── 2. Replay patch chain to get current state ──
  const patches = await repository.findPatchesByTargetId(id)
  const { orderedPatches, status } = reconstructPatchChain(
    patches,
    id as RecordId
  )

  const { createdBy: _cb, createdAt: _ca, ...baseItem } = record

  let currentTags: Tag[]
  if (status === 'empty') {
    if (expectedParentId !== null) {
      throw new SnapshotConflictError(
        `Cannot archive record ${id}: expected no patches but snapshot head has lastPatchId ${expectedParentId}`
      )
    }
    currentTags = record.tags
  } else if (status === 'complete') {
    const lastPatchId = orderedPatches[orderedPatches.length - 1].id
    if (lastPatchId !== expectedParentId) {
      throw new SnapshotConflictError(
        `Cannot archive record ${id}: replayed chain ends at patch ${lastPatchId} but snapshot head has lastPatchId ${expectedParentId}`
      )
    }
    const { finalState } = replayRecordHistory(baseItem, orderedPatches)
    currentTags = finalState.tags
  } else {
    throw new SnapshotConflictError(
      `Cannot archive record ${id}: patch chain is ${status}`
    )
  }

  // ── 3. Generate archive tags from current (replayed) state ──
  const archiveTags: Tag[] = Array.from(
    new Set([...currentTags, 'status:archived'])
  )

  // ── 4. Append archive patch through snapshot head ──
  const now = new Date().toISOString()
  const archivePatch: StoredPatchDoc = {
    id: crypto.randomUUID() as RecordId,
    pid: record.pid,
    schema: record.schema,
    targetId: id as RecordId,
    parentId: expectedParentId,
    tags: archiveTags,
    createdBy: DEFAULT_ACTOR,
    createdAt: now,
  }

  const append = await snapshotHeadRepository.appendPatchAndAdvanceHead({
    targetId: id as RecordId,
    patch: archivePatch,
    expectedSnapshotVersion,
    expectedParentId,
  })
  assertAppendPatchResult(append, expectedSnapshotVersion, expectedParentId)

  // ── 5. Update base record with same archiveTags for backwards compatibility
  //     (P3 current projection will remove this base-record mutation) ──
  const updated = await repository.archive(id, archiveTags)
  if (!updated) {
    throw new Error(
      `Archive patch appended but base record update returned null for ${id}`
    )
  }
  return toRecordResponse(updated)
}
