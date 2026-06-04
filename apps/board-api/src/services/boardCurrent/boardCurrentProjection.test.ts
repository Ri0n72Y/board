import { describe, expect, it } from 'vitest'
import {
  projectRecordCurrent,
  isArchivedInCurrent,
  type RecordCurrentOk,
} from './boardCurrentProjection.js'
import { createServiceWithRepo, makePatchDoc } from '../record/recordTestUtils.js'

/**
 * Helper: creates a base record and returns its raw stored doc + a service
 * reference for creating legitimate patches through the snapshot head.
 */
async function createBaseRecord() {
  const { service, repo } = createServiceWithRepo()
  const envelope = await service.create({
    schema: 'CardBody',
    tags: ['status:todo'],
    body: { title: 'Projection test' },
  })
  const stored = await repo.findById(envelope.body.id)
  return { service, repo, recordId: envelope.body.id, stored: stored! }
}

describe('boardCurrentProjection', () => {
  // ── Basic projection ──

  it('empty chain: current = base record', async () => {
    const { repo, recordId, stored } = await createBaseRecord()
    const patches = await repo.findPatchesByTargetId(recordId)

    const result = projectRecordCurrent(stored, patches)

    expect(result.status).toBe('ok')
    const ok = result as RecordCurrentOk
    expect(ok.current.id).toBe(recordId)
    expect(ok.current.tags).toEqual(['status:todo'])
    expect(ok.current.body).toMatchObject({ title: 'Projection test' })
    // current must not contain envelope fields
    expect(ok.current).not.toHaveProperty('createdBy')
    expect(ok.current).not.toHaveProperty('createdAt')
  })

  it('complete chain: current = replay finalState', async () => {
    const { service, repo, recordId, stored } = await createBaseRecord()

    await service.createRecordPatch(recordId, {
      parentId: null,
      snapshotVersion: 0,
      tags: ['status:wip'],
      body: { description: 'Updated desc' },
    })

    const patches = await repo.findPatchesByTargetId(recordId)
    const result = projectRecordCurrent(stored, patches)

    expect(result.status).toBe('ok')
    const ok = result as RecordCurrentOk
    expect(ok.current.tags).toEqual(['status:wip'])
    expect(ok.current.body).toMatchObject({
      title: 'Projection test',
      description: 'Updated desc',
    })
  })

  it('patch modifies tags: current.tags reflect cumulative effect', async () => {
    const { service, repo, recordId, stored } = await createBaseRecord()

    await service.createRecordPatch(recordId, {
      parentId: null,
      snapshotVersion: 0,
      tags: ['status:wip'],
    })

    const patches = await repo.findPatchesByTargetId(recordId)
    const result = projectRecordCurrent(stored, patches)

    expect(result.status).toBe('ok')
    const ok = result as RecordCurrentOk
    expect(ok.current.tags).toEqual(['status:wip'])
  })

  it('patch modifies body: current.body accumulates updates', async () => {
    const { service, repo, recordId, stored } = await createBaseRecord()

    const r1 = await service.createRecordPatch(recordId, {
      parentId: null,
      snapshotVersion: 0,
      body: { description: 'Step 1' },
    })

    await service.createRecordPatch(recordId, {
      parentId: r1!.patch.body.id,
      snapshotVersion: 1,
      body: { content: 'Step 2 content' },
    })

    const patches = await repo.findPatchesByTargetId(recordId)
    const result = projectRecordCurrent(stored, patches)

    expect(result.status).toBe('ok')
    const ok = result as RecordCurrentOk
    expect(ok.current.body).toMatchObject({
      title: 'Projection test',
      description: 'Step 1',
      content: 'Step 2 content',
    })
  })

  it('archive patch: current.tags includes status:archived', async () => {
    const { service, repo, recordId, stored } = await createBaseRecord()

    await service.createRecordPatch(recordId, {
      parentId: null,
      snapshotVersion: 0,
      tags: ['status:wip'],
    })
    // Archive via delete (appends archive patch)
    await service.delete(recordId)

    const patches = await repo.findPatchesByTargetId(recordId)
    const result = projectRecordCurrent(stored, patches)

    expect(result.status).toBe('ok')
    const ok = result as RecordCurrentOk
    expect(ok.current.tags).toEqual(
      expect.arrayContaining(['status:wip', 'status:archived'])
    )
    expect(ok.current.tags).not.toContain('status:todo')
  })

  // ── Broken / conflicted ──

  it('conflicted chain (multi-root): status=blocked, chainStatus=conflicted', async () => {
    const { repo, recordId, stored } = await createBaseRecord()

    await repo.appendPatch(makePatchDoc('p1', recordId, null))
    await repo.appendPatch(makePatchDoc('p2', recordId, null))

    const patches = await repo.findPatchesByTargetId(recordId)
    const result = projectRecordCurrent(stored, patches)

    expect(result.status).toBe('blocked')
    if (result.status === 'blocked') {
      expect(result.chainStatus).toBe('conflicted')
    }
    expect(result).not.toHaveProperty('current')
    expect(result.diagnostics.some((d) => d.code === 'MULTIPLE_ROOTS')).toBe(true)
  })

  it('conflicted chain (branched): status=blocked, chainStatus=conflicted', async () => {
    const { repo, recordId, stored } = await createBaseRecord()

    await repo.appendPatch(makePatchDoc('p1', recordId, null))
    await repo.appendPatch(makePatchDoc('p2', recordId, 'p1'))
    await repo.appendPatch(makePatchDoc('p3', recordId, 'p1'))

    const patches = await repo.findPatchesByTargetId(recordId)
    const result = projectRecordCurrent(stored, patches)

    expect(result.status).toBe('blocked')
    if (result.status === 'blocked') {
      expect(result.chainStatus).toBe('conflicted')
    }
    expect(result).not.toHaveProperty('current')
    expect(result.diagnostics.some((d) => d.code === 'BRANCHED_CHAIN')).toBe(true)
  })

  it('broken chain (missing parent): status=blocked, chainStatus=broken', async () => {
    const { repo, recordId, stored } = await createBaseRecord()

    await repo.appendPatch(makePatchDoc('patch-1', recordId, null))
    await repo.appendPatch(makePatchDoc('patch-2', recordId, 'non-existent-parent'))

    const patches = await repo.findPatchesByTargetId(recordId)
    const result = projectRecordCurrent(stored, patches)

    expect(result.status).toBe('blocked')
    if (result.status === 'blocked') {
      expect(result.chainStatus).toBe('broken')
    }
    expect(result).not.toHaveProperty('current')
    expect(result.diagnostics.some((d) => d.code === 'PARENT_MISSING')).toBe(true)
  })

  // ── Immutability ──

  it('does not mutate base record', async () => {
    const { repo, recordId, stored } = await createBaseRecord()
    const originalTags = [...stored.tags]
    const originalTitle = (stored.body as { title?: string }).title

    const patches = await repo.findPatchesByTargetId(recordId)
    projectRecordCurrent(stored, patches)

    // Base record untouched
    const after = await repo.findById(recordId)
    expect(after!.tags).toEqual(originalTags)
    expect((after!.body as { title?: string }).title).toBe(originalTitle)
  })

  it('does not mutate patches', async () => {
    const { repo, recordId, stored } = await createBaseRecord()

    await repo.appendPatch(
      makePatchDoc('p1', recordId, null, { tags: ['status:wip'] })
    )

    const patchesBefore = structuredClone(
      await repo.findPatchesByTargetId(recordId)
    )
    projectRecordCurrent(stored, await repo.findPatchesByTargetId(recordId))
    const patchesAfter = await repo.findPatchesByTargetId(recordId)

    expect(patchesAfter).toEqual(patchesBefore)
  })

  // ── Ordering ──

  it('does not sort patches by createdAt', async () => {
    const { repo, recordId, stored } = await createBaseRecord()

    // Inject patches with reversed timestamps
    const older = new Date('2020-01-01').toISOString()
    const newer = new Date('2025-01-01').toISOString()

    await repo.appendPatch(
      makePatchDoc('p2', recordId, 'p1', {
        tags: ['status:done'],
        createdAt: older,
      })
    )
    await repo.appendPatch(
      makePatchDoc('p1', recordId, null, {
        tags: ['status:wip'],
        createdAt: newer,
      })
    )

    const patches = await repo.findPatchesByTargetId(recordId)
    const result = projectRecordCurrent(stored, patches)

    // Chain order is by parent chain, not createdAt
    expect(result.status).toBe('ok')
    const ok = result as RecordCurrentOk
    // p1 (root, newer createdAt) applied first, p2 (child, older) second
    expect(ok.current.tags).toEqual(['status:done'])
  })

  // ── Archived detection ──

  it('isArchivedInCurrent: false for non-archived current', async () => {
    const { repo, recordId, stored } = await createBaseRecord()
    const patches = await repo.findPatchesByTargetId(recordId)
    const result = projectRecordCurrent(stored, patches)

    expect(isArchivedInCurrent(result)).toBe(false)
  })

  it('isArchivedInCurrent: true when current tags include status:archived', async () => {
    const { service, repo, recordId, stored } = await createBaseRecord()
    await service.delete(recordId)

    const patches = await repo.findPatchesByTargetId(recordId)
    const result = projectRecordCurrent(stored, patches)

    expect(result.status).toBe('ok')
    expect(isArchivedInCurrent(result)).toBe(true)
  })
})
