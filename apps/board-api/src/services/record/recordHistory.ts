import type { RecordHistoryDiagnostic, RecordId, RecordItem, RecordBody } from '@labour-board/shared'
import { applyRecordPatch } from '@labour-board/shared'
import type { StoredPatchDoc } from '../../repositories/snapshotHeadRepository.js'

export interface ChainReconstructionResult {
  orderedPatches: StoredPatchDoc[]
  status: 'empty' | 'complete' | 'broken' | 'conflicted'
  diagnostics: RecordHistoryDiagnostic[]
}

export interface ReplayResult {
  finalState: RecordItem<RecordBody>
  states: RecordItem<RecordBody>[]
}

export function reconstructPatchChain(
  patches: StoredPatchDoc[],
  targetId: RecordId
): ChainReconstructionResult {
  if (patches.length === 0) {
    return { orderedPatches: [], status: 'empty', diagnostics: [] }
  }

  const byId = new Map<RecordId, StoredPatchDoc>()
  const childrenByParent = new Map<RecordId | null, StoredPatchDoc[]>()
  const diagnostics: RecordHistoryDiagnostic[] = []
  const targetPatchIds = new Set<RecordId>()

  for (const patch of patches) {
    if (byId.has(patch.id)) {
      diagnostics.push({
        code: 'DUPLICATE_PATCH',
        message: `Duplicate patch id: ${patch.id}`,
        patchId: patch.id,
      })
      continue
    }
    byId.set(patch.id, patch)

    if (patch.targetId !== targetId) {
      diagnostics.push({
        code: 'CROSS_TARGET_PATCH',
        message: `Patch ${patch.id} belongs to target ${patch.targetId}, not ${targetId}`,
        patchId: patch.id,
        parentId: patch.parentId,
      })
      continue
    }

    targetPatchIds.add(patch.id)

    const parentKey = patch.parentId
    const children = childrenByParent.get(parentKey) ?? []
    children.push(patch)
    childrenByParent.set(parentKey, children)
  }

  // ── Root detection ──
  const roots = childrenByParent.get(null) ?? []
  if (roots.length === 0) {
    diagnostics.push({
      code: 'NO_ROOT',
      message: `No root patch (parentId: null) found for record ${targetId}`,
    })
    return {
      orderedPatches: [],
      status: 'broken',
      diagnostics,
    }
  }
  if (roots.length > 1) {
    diagnostics.push({
      code: 'MULTIPLE_ROOTS',
      message: `Multiple root patches found for record ${targetId}: ${roots.map((r) => r.id).join(', ')}`,
    })
  }

  // ── Parent-child integrity checks ──
  for (const [parentId, children] of childrenByParent) {
    if (parentId === null) continue

    if (!byId.has(parentId)) {
      for (const child of children) {
        diagnostics.push({
          code: 'PARENT_MISSING',
          message: `Patch ${child.id} parent ${parentId} does not exist`,
          patchId: child.id,
          parentId,
        })
      }
      continue
    }

    const parent = byId.get(parentId)!
    if (parent.targetId !== targetId) {
      for (const child of children) {
        diagnostics.push({
          code: 'CROSS_TARGET_PARENT',
          message: `Patch ${child.id} parent ${parentId} belongs to target ${parent.targetId}`,
          patchId: child.id,
          parentId,
        })
      }
    }
  }

  // ── Multiple children per parent ──
  for (const [parentId, children] of childrenByParent) {
    if (children.length > 1) {
      diagnostics.push({
        code: 'BRANCHED_CHAIN',
        message: `Parent patch ${parentId === null ? '(root)' : parentId} has ${children.length} children: ${children.map((c) => c.id).join(', ')}`,
        parentId,
      })
    }
  }

  // ── Walk chain from root ──
  // The walk starts from the single root (if present) and follows the
  // single-child chain. It stops naturally at breaks. Cycle detection
  // is defensive: under normal operation duplicate-ID guards prevent
  // structural cycles, but data corruption could introduce them.
  let orderedPatches: StoredPatchDoc[] = []
  let sawCycle = false
  const visitedPatchIds = new Set<RecordId>()

  if (roots.length === 1) {
    let current: StoredPatchDoc | null = roots[0]
    while (current) {
      if (visitedPatchIds.has(current.id)) {
        diagnostics.push({
          code: 'CYCLE',
          message: `Patch chain for record ${targetId} contains a cycle at patch ${current.id}`,
          patchId: current.id,
          parentId: current.parentId,
        })
        sawCycle = true
        break
      }
      visitedPatchIds.add(current.id)
      orderedPatches.push(current)
      const childList: StoredPatchDoc[] = childrenByParent.get(current.id) ?? []
      current = childList.length === 1 ? childList[0] : null
    }
  }

  // ── Detect patches not reachable from the root chain ──
  // Skip UNREACHABLE_PATCH when MULTIPLE_ROOTS or BRANCHED_CHAIN already
  // explain the unreachability — those are structural conflicts, not breaks.
  const hasMultipleRoots = diagnostics.some((d) => d.code === 'MULTIPLE_ROOTS')
  const hasBranched = diagnostics.some((d) => d.code === 'BRANCHED_CHAIN')
  if (!hasMultipleRoots && !hasBranched) {
    for (const id of targetPatchIds) {
      if (!visitedPatchIds.has(id)) {
        diagnostics.push({
          code: 'UNREACHABLE_PATCH',
          message: `Patch ${id} is not reachable from the root chain`,
          patchId: id,
        })
      }
    }
  }

  // ── Determine status ──
  if (sawCycle) {
    return { orderedPatches, status: 'broken', diagnostics }
  }

  const status = determineStatus(roots.length, diagnostics)

  return { orderedPatches, status, diagnostics }
}

function determineStatus(
  rootCount: number,
  diagnostics: RecordHistoryDiagnostic[]
): 'empty' | 'complete' | 'broken' | 'conflicted' {
  if (diagnostics.length === 0) return 'complete'

  const hasBroken = diagnostics.some((d) =>
    ['NO_ROOT', 'PARENT_MISSING', 'CROSS_TARGET_PARENT', 'CROSS_TARGET_PATCH', 'CYCLE', 'DUPLICATE_PATCH', 'UNREACHABLE_PATCH'].includes(d.code)
  )
  if (hasBroken) return 'broken'

  const hasConflict = diagnostics.some((d) =>
    ['MULTIPLE_ROOTS', 'BRANCHED_CHAIN'].includes(d.code)
  )
  if (hasConflict) return 'conflicted'

  return rootCount === 0 ? 'empty' : 'complete'
}

/**
 * Replays patches against a base record to produce the derived state at each step.
 * This is a pure projection — it does not write to any repository.
 *
 * Patches are applied using the existing {@link applyRecordPatch} utility.
 * `description`, `targetId`, `parentId`, and `snapshotVersion` are never
 * written into the record state.
 */
export function replayRecordHistory(
  baseRecord: RecordItem<RecordBody>,
  orderedPatches: StoredPatchDoc[]
): ReplayResult {
  const states: RecordItem<RecordBody>[] = []
  let current = baseRecord

  for (const patchDoc of orderedPatches) {
    current = applyRecordPatch(current, patchDoc)
    states.push(current)
  }

  return { finalState: current, states }
}
