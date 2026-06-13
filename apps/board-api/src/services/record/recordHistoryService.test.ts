import { describe, expect, it } from 'vitest'
import { createServiceWithRepo, makePatchDoc } from './recordTestUtils.js'

describe('RecordService history (getRecordHistory)', () => {
  it('returns complete history for a record with a valid patch chain', async () => {
    const { service } = createServiceWithRepo()
    const envelope = await service.create({
      schema: 'CardBody',
      tags: ['status:todo'],
      body: { title: 'History test' },
    })
    const recordId = envelope.body.id

    await service.createRecordPatch(recordId, {
      parentId: null,
      snapshotVersion: 0,
      tagChanges: { change: [{ namespace: 'status', from: 'status:todo', to: 'status:wip' }] },
    })

    const history = await service.getRecordHistory(recordId)
    expect(history).not.toBeNull()
    expect(history!.status).toBe('complete')
    expect(history!.patches).toHaveLength(1)
    expect(history!.diagnostics).toBeUndefined()
    expect(history!.replay).toBeDefined()
    expect(history!.replay!.steps).toHaveLength(1)
    expect(history!.replay!.finalState.tags).toEqual(['status:wip'])
  })

  it('returns conflicted when multiple root patches exist in the repository', async () => {
    const { service, repo } = createServiceWithRepo()
    const envelope = await service.create({
      schema: 'CardBody',
      tags: ['status:todo'],
      body: { title: 'Multi-root test' },
    })
    const recordId = envelope.body.id

    await repo.appendPatch(makePatchDoc('patch-1', recordId, null, { tagChanges: { change: [{ namespace: 'status', from: 'status:todo', to: 'status:wip' }] } }))
    await repo.appendPatch(makePatchDoc('patch-2', recordId, null, { tagChanges: { change: [{ namespace: 'status', from: 'status:todo', to: 'status:done' }] } }))

    const history = await service.getRecordHistory(recordId)
    expect(history).not.toBeNull()
    expect(history!.status).toBe('conflicted')
    expect(history!.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'MULTIPLE_ROOTS' }),
      ])
    )
    expect(history!.replay).toBeUndefined()
  })

  it('returns broken when a patch has a missing parent in the repository', async () => {
    const { service, repo } = createServiceWithRepo()
    const envelope = await service.create({
      schema: 'CardBody',
      tags: ['status:todo'],
      body: { title: 'Orphan test' },
    })
    const recordId = envelope.body.id

    await repo.appendPatch(makePatchDoc('patch-1', recordId, null))
    await repo.appendPatch(makePatchDoc('patch-2', recordId, 'non-existent-parent'))

    const history = await service.getRecordHistory(recordId)
    expect(history).not.toBeNull()
    expect(history!.status).toBe('broken')
    expect(history!.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'PARENT_MISSING' }),
      ])
    )
    expect(history!.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'UNREACHABLE_PATCH' }),
      ])
    )
    expect(history!.replay).toBeUndefined()
  })

  it('returns broken when patches form a detached cycle in the repository', async () => {
    const { service, repo } = createServiceWithRepo()
    const envelope = await service.create({
      schema: 'CardBody',
      tags: ['status:todo'],
      body: { title: 'Detached cycle test' },
    })
    const recordId = envelope.body.id

    await repo.appendPatch(makePatchDoc('patch-1', recordId, null))
    await repo.appendPatch(makePatchDoc('patch-2', recordId, 'patch-3'))
    await repo.appendPatch(makePatchDoc('patch-3', recordId, 'patch-2'))

    const history = await service.getRecordHistory(recordId)
    expect(history).not.toBeNull()
    expect(history!.status).toBe('broken')
    expect(history!.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'UNREACHABLE_PATCH' }),
      ])
    )
    expect(history!.patches.length).toBe(1)
    expect(history!.replay).toBeUndefined()
  })

  it('returns null when record does not exist', async () => {
    const { service } = createServiceWithRepo()
    const history = await service.getRecordHistory('non-existent')
    expect(history).toBeNull()
  })

  it('returns empty history when record exists but has no patches', async () => {
    const { service } = createServiceWithRepo()
    const envelope = await service.create({
      schema: 'CardBody',
      tags: ['status:todo'],
      body: { title: 'No patches test' },
    })

    const history = await service.getRecordHistory(envelope.body.id)
    expect(history).not.toBeNull()
    expect(history!.status).toBe('empty')
    expect(history!.patches).toEqual([])
    expect(history!.diagnostics).toBeUndefined()
    expect(history!.replay).toBeDefined()
    expect(history!.replay!.steps).toEqual([])
    expect(history!.replay!.finalState).toMatchObject(envelope.body)
  })

  it('complete chain replay: steps count matches patches, finalState reflects all patches', async () => {
    const { service } = createServiceWithRepo()
    const envelope = await service.create({
      schema: 'CardBody',
      tags: ['status:todo'],
      body: { title: 'Cumulative replay', description: 'Original' },
    })
    const recordId = envelope.body.id

    const r1 = await service.createRecordPatch(recordId, {
      parentId: null,
      snapshotVersion: 0,
      tagChanges: { change: [{ namespace: 'status', from: 'status:todo', to: 'status:wip' }] },
    })
    const r2 = await service.createRecordPatch(recordId, {
      parentId: r1!.patch.body.id,
      snapshotVersion: 1,
      body: { description: 'Updated' },
    })
    await service.createRecordPatch(recordId, {
      parentId: r2!.patch.body.id,
      snapshotVersion: 2,
      assignee: 'alice' as any,
    })

    const history = await service.getRecordHistory(recordId)
    expect(history).not.toBeNull()
    expect(history!.status).toBe('complete')
    expect(history!.replay).toBeDefined()
    expect(history!.replay!.steps).toHaveLength(3)
    expect(history!.replay!.finalState.tags).toEqual(['status:wip'])
    expect(history!.replay!.finalState.body).toMatchObject({ description: 'Updated' })
    expect(history!.replay!.finalState.assignee).toBe('alice')
    expect(history!.replay!.steps[0].patch.body.id).toBe(r1!.patch.body.id)
    expect(history!.replay!.steps[1].patch.body.id).toBe(r2!.patch.body.id)
  })

  it('getRecordHistory does not mutate snapshot head', async () => {
    const { service } = createServiceWithRepo()
    const envelope = await service.create({
      schema: 'CardBody',
      tags: ['status:todo'],
      body: { title: 'Snapshot stability test' },
    })
    const recordId = envelope.body.id

    const r1 = await service.createRecordPatch(recordId, {
      parentId: null,
      snapshotVersion: 0,
      tagChanges: { change: [{ namespace: 'status', from: 'status:todo', to: 'status:wip' }] },
    })
    const r2 = await service.createRecordPatch(recordId, {
      parentId: r1!.patch.body.id,
      snapshotVersion: 1,
      body: { description: 'Second change' },
    })

    expect(r2!.newSnapshotVersion).toBe(2)

    const headBefore = await service.getSnapshotHead()
    const beforeVersion = headBefore.version
    const beforeLastPatchId = headBefore.records[recordId]?.lastPatchId ?? null
    const beforeHeadSnapshot = structuredClone(headBefore)

    expect(beforeVersion).toBe(2)
    expect(beforeLastPatchId).toBe(r2!.patch.body.id)

    const history = await service.getRecordHistory(recordId)
    expect(history).not.toBeNull()
    expect(history!.status).toBe('complete')
    expect(history!.replay).toBeDefined()

    const headAfter = await service.getSnapshotHead()
    expect(headAfter.version).toBe(beforeVersion)
    expect(headAfter.records[recordId]?.lastPatchId ?? null).toBe(beforeLastPatchId)
    expect(headAfter).toEqual(beforeHeadSnapshot)
  })
})
