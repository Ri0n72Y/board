import { describe, expect, it } from 'vitest'
import type { RecordBody, RecordItem } from '@labour-board/shared'
import type { StoredPatchDoc } from '../../repositories/snapshotHeadRepository.js'
import { reconstructPatchChain, replayRecordHistory } from './recordHistory.js'

function makePatch(
  id: string,
  targetId: string,
  parentId: string | null,
  overrides?: Partial<StoredPatchDoc>
): StoredPatchDoc {
  return {
    id,
    pid: 'CARD-1',
    schema: 'CardBody',
    targetId,
    parentId,
    createdBy: 'local',
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('reconstructPatchChain', () => {
  const TARGET = 'record-a'

  it('no patches -> status empty', () => {
    const result = reconstructPatchChain([], TARGET)
    expect(result.status).toBe('empty')
    expect(result.orderedPatches).toEqual([])
    expect(result.diagnostics).toEqual([])
  })

  it('root patch only -> status complete', () => {
    const root = makePatch('p1', TARGET, null)
    const result = reconstructPatchChain([root], TARGET)
    expect(result.status).toBe('complete')
    expect(result.orderedPatches).toEqual([root])
    expect(result.diagnostics).toEqual([])
  })

  it('root + child -> status complete, ordered by parent chain', () => {
    const root = makePatch('p1', TARGET, null)
    const child = makePatch('p2', TARGET, 'p1')
    const result = reconstructPatchChain([child, root], TARGET)
    expect(result.status).toBe('complete')
    expect(result.orderedPatches.map((p) => p.id)).toEqual(['p1', 'p2'])
  })

  it('three chain patches -> ordered by parent chain', () => {
    const root = makePatch('p1', TARGET, null)
    const p2 = makePatch('p2', TARGET, 'p1')
    const p3 = makePatch('p3', TARGET, 'p2')
    const result = reconstructPatchChain([p3, root, p2], TARGET)
    expect(result.status).toBe('complete')
    expect(result.orderedPatches.map((p) => p.id)).toEqual(['p1', 'p2', 'p3'])
  })

  it('does NOT use createdAt for ordering', () => {
    const root = makePatch('p1', TARGET, null, {
      createdAt: '2025-06-01T00:00:00.000Z',
    })
    const child = makePatch('p2', TARGET, 'p1', {
      createdAt: '2025-01-01T00:00:00.000Z',
    })
    const result = reconstructPatchChain([child, root], TARGET)
    // Order must be by parent chain, not by createdAt
    expect(result.orderedPatches.map((p) => p.id)).toEqual(['p1', 'p2'])
  })

  it('multiple roots -> status conflicted', () => {
    const r1 = makePatch('p1', TARGET, null)
    const r2 = makePatch('p2', TARGET, null)
    const result = reconstructPatchChain([r1, r2], TARGET)
    expect(result.status).toBe('conflicted')
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: 'MULTIPLE_ROOTS' })
    )
  })

  it('no root patch -> status broken', () => {
    // patches with parentId but no root
    const p1 = makePatch('p2', TARGET, 'missing-parent')
    const result = reconstructPatchChain([p1], TARGET)
    expect(result.status).toBe('broken')
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: 'NO_ROOT' })
    )
  })

  it('parent missing -> status broken, returns partial chain', () => {
    const root = makePatch('p1', TARGET, null)
    const orphan = makePatch('p3', TARGET, 'non-existent-p2')
    const result = reconstructPatchChain([root, orphan], TARGET)
    expect(result.status).toBe('broken')
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: 'PARENT_MISSING' })
    )
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: 'UNREACHABLE_PATCH' })
    )
    // Root is still returned as partial chain
    expect(result.orderedPatches.length).toBe(1)
    expect(result.orderedPatches[0].id).toBe('p1')
  })

  it('cross-target patch -> status broken, returns partial chain', () => {
    const root = makePatch('p1', TARGET, null)
    const cross = makePatch('p2', 'other-target', 'p1')
    const result = reconstructPatchChain([root, cross], TARGET)
    expect(result.status).toBe('broken')
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: 'CROSS_TARGET_PATCH' })
    )
    // Root is still returned, cross-target patch is excluded from chain
    expect(result.orderedPatches.length).toBe(1)
    expect(result.orderedPatches[0].id).toBe('p1')
  })

  it('cross-target parent -> status broken', () => {
    // P1 is root for TARGET, P2 is a cross-target orphan, P3 chains from P2
    const p1 = makePatch('p1', TARGET, null)
    const p2 = makePatch('p2', 'other', 'p1')
    const p3 = makePatch('p3', TARGET, 'p2')
    const result = reconstructPatchChain([p1, p2, p3], TARGET)
    expect(result.status).toBe('broken')
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: 'CROSS_TARGET_PARENT' })
    )
  })

  it('multiple children for same parent -> status conflicted', () => {
    const root = makePatch('p1', TARGET, null)
    const childA = makePatch('p2', TARGET, 'p1')
    const childB = makePatch('p3', TARGET, 'p1')
    const result = reconstructPatchChain([root, childA, childB], TARGET)
    expect(result.status).toBe('conflicted')
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: 'BRANCHED_CHAIN' })
    )
  })

  it('duplicate patch id -> status broken', () => {
    const p1 = makePatch('p1', TARGET, null)
    const p2 = makePatch('p1', TARGET, 'p1')
    const result = reconstructPatchChain([p1, p2], TARGET)
    expect(result.status).toBe('broken')
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: 'DUPLICATE_PATCH' })
    )
    // The first occurrence of p1 is kept; chain is valid
    expect(result.orderedPatches.length).toBe(1)
    expect(result.orderedPatches[0].id).toBe('p1')
  })

  it('duplicate patch id with attempted cycle -> status broken', () => {
    const p1 = makePatch('p1', TARGET, null)
    const p2 = makePatch('p2', TARGET, 'p1')
    const p3 = makePatch('p3', TARGET, 'p2')
    const p4 = makePatch('p4', TARGET, 'p3', { id: 'p1' })
    const result = reconstructPatchChain([p1, p2, p3, p4], TARGET)
    expect(result.status).toBe('broken')
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: 'DUPLICATE_PATCH' })
    )
    expect(result.orderedPatches.map((p) => p.id)).toEqual(['p1', 'p2', 'p3'])
  })

  it('root + detached cycle -> status broken', () => {
    // p1 is root, p2 and p3 form a cycle unreachable from p1
    const p1 = makePatch('p1', TARGET, null)
    const p2 = makePatch('p2', TARGET, 'p3')
    const p3 = makePatch('p3', TARGET, 'p2')
    const result = reconstructPatchChain([p1, p2, p3], TARGET)
    expect(result.status).toBe('broken')
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: 'UNREACHABLE_PATCH' })
    )
    // Only p1 is reachable from root
    expect(result.orderedPatches.length).toBe(1)
    expect(result.orderedPatches[0].id).toBe('p1')
  })

  it('root + detached chain -> status broken', () => {
    // p1 is root, p2 is a child, p3 is orphan (parent doesn't exist)
    const p1 = makePatch('p1', TARGET, null)
    const p2 = makePatch('p2', TARGET, 'p1')
    const p3 = makePatch('p3', TARGET, 'non-existent')
    const result = reconstructPatchChain([p1, p2, p3], TARGET)
    expect(result.status).toBe('broken')
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: 'UNREACHABLE_PATCH' })
    )
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: 'PARENT_MISSING' })
    )
    // p1 and p2 are in the chain, p3 is unreachable
    expect(result.orderedPatches.length).toBe(2)
    expect(result.orderedPatches.map((p) => p.id)).toEqual(['p1', 'p2'])
  })

  it('complete chain with all patches visited -> status complete', () => {
    const p1 = makePatch('p1', TARGET, null)
    const p2 = makePatch('p2', TARGET, 'p1')
    const p3 = makePatch('p3', TARGET, 'p2')
    const result = reconstructPatchChain([p1, p2, p3], TARGET)
    expect(result.status).toBe('complete')
    expect(result.diagnostics).toEqual([])
    expect(result.orderedPatches.map((p) => p.id)).toEqual(['p1', 'p2', 'p3'])
    // All patches visited
    expect(result.orderedPatches.length).toBe(3)
  })

  it('all patches belong to different target -> status broken (no patches for this target)', () => {
    const p1 = makePatch('p1', 'other-target', null)
    const result = reconstructPatchChain([p1], TARGET)
    // p1.targetId is 'other-target', not TARGET
    // The root patches for TARGET are empty (no patch with targetId=TARGET)
    expect(result.status).toBe('broken')
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: 'NO_ROOT' })
    )
  })
})

describe('replayRecordHistory', () => {
  const TARGET = 'record-a'

  function baseRecord(overrides?: Partial<RecordItem<RecordBody>>): RecordItem<RecordBody> {
    return {
      id: TARGET,
      pid: 'CARD-1',
      schema: 'CardBody',
      tags: ['status:todo'],
      assignee: null,
      body: { title: 'Base record', description: 'Original', content: 'old' },
      assets: [{ id: 'asset-1' } as unknown as string],
      relations: [{ constraint: 'depends_on', target: 'target-1' }],
      ...overrides,
    }
  }

  it('empty history replay: finalState equals base record, steps is empty', () => {
    const base = baseRecord()
    const result = replayRecordHistory(base, [])
    expect(result.finalState).toEqual(base)
    expect(result.states).toEqual([])
  })

  it('one patch replay: tags update reflected in finalState', () => {
    const base = baseRecord()
    const patch = makePatch('p1', TARGET, null, { tagChanges: { change: [{ namespace: 'status', from: 'status:todo', to: 'status:wip' }] } })
    const result = replayRecordHistory(base, [patch])
    expect(result.states).toHaveLength(1)
    expect(result.states[0].tags).toEqual(['status:wip'])
    expect(result.finalState.tags).toEqual(['status:wip'])
    // Unchanged fields preserved
    expect(result.finalState.body).toEqual({ title: 'Base record', description: 'Original', content: 'old' })
  })

  it('two patch replay: both patches accumulate', () => {
    const base = baseRecord()
    const p1 = makePatch('p1', TARGET, null, { tagChanges: { change: [{ namespace: 'status', from: 'status:todo', to: 'status:wip' }] } })
    const p2 = makePatch('p2', TARGET, 'p1', { body: { description: 'Updated desc' }, tags: undefined })
    const result = replayRecordHistory(base, [p1, p2])
    expect(result.states).toHaveLength(2)
    expect(result.finalState.tags).toEqual(['status:wip'])
    expect(result.finalState.body).toMatchObject({ description: 'Updated desc' })
    // Steps preserve order
    expect(result.states[0].tags).toEqual(['status:wip'])
    expect(result.states[1].body).toMatchObject({ description: 'Updated desc' })
  })

  it('body deep partial replay: only modified field changes, others preserved', () => {
    const base = baseRecord()
    const patch = makePatch('p1', TARGET, null, { body: { description: 'New desc' } })
    const result = replayRecordHistory(base, [patch])
    expect(result.finalState.body).toEqual({
      title: 'Base record',
      description: 'New desc',
      content: 'old',
    })
  })

  it('assignee null replay: finalState.assignee is null', () => {
    const base = baseRecord({ assignee: 'alice' })
    const patch = makePatch('p1', TARGET, null, { assignee: null })
    const result = replayRecordHistory(base, [patch])
    expect(result.finalState.assignee).toBeNull()
  })

  it('assets [] replay: finalState.assets is []', () => {
    const base = baseRecord()
    const patch = makePatch('p1', TARGET, null, { assets: [] })
    const result = replayRecordHistory(base, [patch])
    expect(result.finalState.assets).toEqual([])
  })

  it('relations [] replay: finalState.relations is []', () => {
    const base = baseRecord()
    const patch = makePatch('p1', TARGET, null, { relations: [] })
    const result = replayRecordHistory(base, [patch])
    expect(result.finalState.relations).toEqual([])
  })

  it('description does not enter finalState', () => {
    const base = baseRecord()
    const patch = makePatch('p1', TARGET, null, {
      tagChanges: { change: [{ namespace: 'status', from: 'status:todo', to: 'status:wip' }] },
      description: 'Patch meta comment',
    })
    const result = replayRecordHistory(base, [patch])
    expect(result.finalState).not.toHaveProperty('description')
    expect(result.finalState.tags).toEqual(['status:wip'])
  })

  it('targetId / parentId do not enter finalState', () => {
    const base = baseRecord()
    const patch = makePatch('p1', TARGET, null, { tagChanges: { change: [{ namespace: 'status', from: 'status:todo', to: 'status:wip' }] } })
    const result = replayRecordHistory(base, [patch])
    expect(result.finalState).not.toHaveProperty('targetId')
    expect(result.finalState).not.toHaveProperty('parentId')
  })

  it('replay does not mutate base record', () => {
    const base = baseRecord()
    const original = structuredClone(base)
    const patch = makePatch('p1', TARGET, null, { tagChanges: { change: [{ namespace: 'status', from: 'status:todo', to: 'status:wip' }] } })
    replayRecordHistory(base, [patch])
    expect(base).toEqual(original)
  })

  it('replay does not mutate patch objects', () => {
    const base = baseRecord()
    const patch = makePatch('p1', TARGET, null, { tagChanges: { change: [{ namespace: 'status', from: 'status:todo', to: 'status:wip' }] } })
    const patchClone = structuredClone(patch)
    replayRecordHistory(base, [patch])
    expect(patch).toEqual(patchClone)
  })
})
