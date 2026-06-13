import type { RecordBody, RecordId, RecordItem, Tag } from '@labour-board/shared'
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

  let head: SnapshotHead
  try {
    head = await snapshotHeadRepository.loadSnapshotHead()
  } catch (caught) {
    if (caught instanceof SnapshotHeadIntegrityError) {
      throw new SnapshotConflictError(
        `Cannot archive record ${id}: snapshot head is corrupted - ${caught.message}`
      )
    }
    throw caught
  }
  const expectedSnapshotVersion = head.version
  const expectedParentId =
    (head.records[id as RecordId]?.lastPatchId as RecordId | null) ?? null

  const patches = await repository.findPatchesByTargetId(id)
  const { orderedPatches, status } = reconstructPatchChain(
    patches,
    id as RecordId
  )

  const { createdBy: _cb, createdAt: _ca, ...baseItem } = record
  let currentState: RecordItem<RecordBody>

  if (status === 'empty') {
    if (expectedParentId !== null) {
      throw new SnapshotConflictError(
        `Cannot archive record ${id}: expected no patches but snapshot head has lastPatchId ${expectedParentId}`
      )
    }
    currentState = baseItem
  } else if (status === 'complete') {
    const lastPatchId = orderedPatches[orderedPatches.length - 1].id
    if (lastPatchId !== expectedParentId) {
      throw new SnapshotConflictError(
        `Cannot archive record ${id}: replayed chain ends at patch ${lastPatchId} but snapshot head has lastPatchId ${expectedParentId}`
      )
    }
    currentState = replayRecordHistory(baseItem, orderedPatches).finalState
  } else {
    throw new SnapshotConflictError(
      `Cannot archive record ${id}: patch chain is ${status}`
    )
  }

  if (currentState.tags.includes('status:archived')) {
    return toRecordResponse({
      ...record,
      ...currentState,
      createdBy: record.createdBy,
      createdAt: record.createdAt,
    })
  }

  const archiveTags: Tag[] = Array.from(
    new Set([...currentState.tags, 'status:archived'])
  )
  const now = new Date().toISOString()
  const archivePatch: StoredPatchDoc = {
    id: crypto.randomUUID() as RecordId,
    pid: record.pid,
    schema: record.schema,
    targetId: id as RecordId,
    parentId: expectedParentId,
    tagChanges: {
      add: ['status:archived'],
    },
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

  return toRecordResponse({
    ...record,
    ...currentState,
    tags: archiveTags,
    createdBy: record.createdBy,
    createdAt: record.createdAt,
  })
}
