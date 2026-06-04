import type {
  BlockedRecordEntry,
  BoardCurrentProjection,
  BoardCurrentQuery,
  BoardCurrentSummary,
  BoardProjectionStatus,
  ProjectionDiagnostic,
  Tag,
} from '@labour-board/shared'
import type { RecordRepository } from '../../repositories/recordRepository.js'
import type { SnapshotHeadRepository } from '../../repositories/snapshotHeadRepository.js'
import { SnapshotHeadIntegrityError } from '../../repositories/snapshotHeadRepository.js'
import type { BoardRecordResponse } from '../record/recordResponses.js'
import {
  isArchivedInCurrent,
  projectRecordCurrent,
} from './boardCurrentProjection.js'
import { filterBoardCurrentRecords } from './boardCurrentFilter.js'

export type {
  BlockedRecordEntry,
  BoardCurrentProjection,
  BoardCurrentSummary,
  BoardProjectionStatus,
  ProjectionDiagnostic,
}

export interface GetBoardCurrentParams {
  repository: RecordRepository
  snapshotHeadRepository: SnapshotHeadRepository
  query?: BoardCurrentQuery
  includeArchived?: boolean
}

// ─── Service ───

/**
 * Assembles a board-level current projection.
 *
 * - Reads the snapshot head for the version marker only.
 * - Reads all base records and their patch facts.
 * - Projects each record via {@link projectRecordCurrent}.
 * - Archived detection uses current (replayed) tags, not base tags.
 * - Broken / conflicted records go into `blockedRecords`; they are never
 *   included in `records`.
 *
 * This is a pure read-only projection. It does not write to any
 * repository, does not advance the snapshot head, and does not persist
 * anything.
 */
export async function getBoardCurrentProjection(
  params: GetBoardCurrentParams
): Promise<BoardCurrentProjection> {
  const { repository, snapshotHeadRepository } = params
  const query = params.query ?? { includeArchived: params.includeArchived }
  const includeArchived = query.includeArchived

  let headVersion: number
  let headCorrupted = false
  const topLevelDiagnostics: ProjectionDiagnostic[] = []

  try {
    const head = await snapshotHeadRepository.loadSnapshotHead()
    headVersion = head.version
  } catch (caught) {
    if (caught instanceof SnapshotHeadIntegrityError) {
      headVersion = -1
      headCorrupted = true
      topLevelDiagnostics.push({
        code: 'SNAPSHOT_HEAD_INTEGRITY_ERROR',
        message: `Snapshot head is corrupted: ${caught.message}`,
      })
    } else {
      throw caught
    }
  }

  const baseRecords = await repository.list({
    includeArchived: true,
    excludeTags: [] as Tag[],
  })

  // Empty board with corrupted head → blocked, not empty.
  if (baseRecords.length === 0) {
    return {
      snapshotHeadVersion: headVersion,
      records: [],
      blockedRecords: [],
      summary: {
        totalBaseRecords: 0,
        visibleCurrentRecords: 0,
        archivedRecords: 0,
        blockedRecords: 0,
        projectionStatus: headCorrupted ? 'blocked' : 'empty',
      },
      ...(topLevelDiagnostics.length > 0
        ? { diagnostics: topLevelDiagnostics }
        : {}),
    }
  }

  const visibleRecords: BoardRecordResponse[] = []
  const blockedRecords: BlockedRecordEntry[] = []
  let archivedCount = 0

  for (const base of baseRecords) {
    const patches = await repository.findPatchesByTargetId(base.id)
    const projection = projectRecordCurrent(base, patches)

    if (projection.status === 'blocked') {
      blockedRecords.push({
        recordId: base.id,
        status: projection.chainStatus,
        diagnostics: projection.diagnostics,
      })
      continue
    }

    // status === 'ok'
    const isArchived = isArchivedInCurrent(projection)
    if (isArchived) {
      archivedCount++
      if (!includeArchived) continue
    }

    const envelope: BoardRecordResponse = {
      createdBy: base.createdBy,
      createdAt: base.createdAt,
      body: projection.current,
    }
    visibleRecords.push(envelope)
  }

  const filteredRecords = filterBoardCurrentRecords(visibleRecords, query)

  // Projection status reports board projection health before user filters;
  // filtered-empty results should not hide archived, blocked, or head issues.
  const projectionStatus = resolveBoardProjectionStatus(
    baseRecords.length,
    visibleRecords.length,
    archivedCount,
    blockedRecords.length,
    headCorrupted
  )

  return {
    snapshotHeadVersion: headVersion,
    records: filteredRecords,
    blockedRecords,
    summary: {
      totalBaseRecords: baseRecords.length,
      visibleCurrentRecords: filteredRecords.length,
      archivedRecords: archivedCount,
      blockedRecords: blockedRecords.length,
      projectionStatus,
    },
    ...(topLevelDiagnostics.length > 0
      ? { diagnostics: topLevelDiagnostics }
      : {}),
  }
}

function resolveBoardProjectionStatus(
  totalBase: number,
  visibleCurrent: number,
  archived: number,
  blocked: number,
  headCorrupted: boolean
): BoardProjectionStatus {
  if (totalBase === 0) return headCorrupted ? 'blocked' : 'empty'

  const problemRecords = archived + blocked

  if (problemRecords === 0 && !headCorrupted) return 'clean'
  if (visibleCurrent > 0) return 'partial'
  // No visible records: all archived or blocked
  if (blocked > 0 || headCorrupted) return 'blocked'
  // All records are archived (none blocked, none visible, head ok)
  return 'partial'
}
