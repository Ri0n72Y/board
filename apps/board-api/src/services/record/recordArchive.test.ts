import { describe, expect, it } from 'vitest'
import { RecordService, SnapshotConflictError } from '../recordService.js'
import {
  createRecordService,
  createServiceWithRepo,
  makePatchDoc,
} from './recordTestUtils.js'

describe('RecordService archive', () => {
  it('returns null when archiving a missing record', async () => {
    const service = createRecordService()
    await expect(service.delete('missing')).resolves.toBeNull()
  })

  it('archives records and hides them from current board lists by default', async () => {
    const service = createRecordService()
    const envelope = await service.create({
      schema: 'CardBody',
      tags: ['status:todo'],
      body: { title: 'Archive me' },
    })
    const record = envelope.body

    const headBefore = await service.getSnapshotHead()
    expect(headBefore.version).toBe(0)

    const archivedEnv = await service.delete(record.id)
    const archived = archivedEnv!.body

    expect(archived.tags).toContain('status:archived')
    await expect(service.findById(record.id)).resolves.toBeNull()
    await expect(service.list({})).resolves.toEqual([])
    await expect(service.list({ includeArchived: true })).resolves.toEqual([
      archivedEnv,
    ])

    // Snapshot head must advance after archive patch
    const headAfter = await service.getSnapshotHead()
    expect(headAfter.version).toBe(1)
    expect(headAfter.records[record.id]?.lastPatchId).toBeDefined()

    // History must include the archive patch
    const history = await service.getRecordHistory(record.id)
    expect(history).not.toBeNull()
    expect(history!.status).toBe('complete')
    expect(history!.patches).toHaveLength(1)
    expect(history!.patches[0].body.tagChanges).toEqual({
      add: ['status:archived'],
    })
    expect(history!.replay).toBeDefined()
    expect(history!.replay!.finalState.tags).toContain('status:archived')
  })

  it('double archive returns existing archived record without creating another patch', async () => {
    const service = createRecordService()
    const envelope = await service.create({
      schema: 'CardBody',
      tags: ['status:todo'],
      body: { title: 'Double archive' },
    })
    const recordId = envelope.body.id

    await service.delete(recordId)
    const headAfterFirst = await service.getSnapshotHead()
    const versionAfterFirst = headAfterFirst.version

    const secondResult = await service.delete(recordId)
    expect(secondResult).not.toBeNull()
    expect(secondResult!.body.tags).toContain('status:archived')

    const headAfterSecond = await service.getSnapshotHead()
    expect(headAfterSecond.version).toBe(versionAfterFirst)
  })

  it('archive appends archive patch and advances snapshot head from non-zero version', async () => {
    const service = createRecordService()
    const envelope = await service.create({
      schema: 'CardBody',
      tags: ['status:todo'],
      body: { title: 'Patch then archive' },
    })
    const recordId = envelope.body.id

    await service.createRecordPatch(recordId, {
      parentId: null,
      currentVersion: 0,
      tagChanges: { change: [{ namespace: 'status', from: 'status:todo', to: 'status:wip' }] },
    })
    const headBeforeArchive = await service.getSnapshotHead()
    expect(headBeforeArchive.version).toBe(1)

    await service.delete(recordId)

    const headAfter = await service.getSnapshotHead()
    expect(headAfter.version).toBe(2)

    const history = await service.getRecordHistory(recordId)
    expect(history).not.toBeNull()
    expect(history!.status).toBe('complete')
    expect(history!.patches).toHaveLength(2)
    expect(history!.patches[0].body.tagChanges).toEqual({
      change: [{ namespace: 'status', from: 'status:todo', to: 'status:wip' }],
    })
    expect(history!.patches[1].body.tagChanges).toEqual({
      add: ['status:archived'],
    })
    expect(history!.patches[1].body.parentId).toBe(history!.patches[0].body.id)
    expect(history!.replay).toBeDefined()
    expect(history!.replay!.finalState.tags).toEqual(
      expect.arrayContaining(['status:wip', 'status:archived'])
    )
    expect(history!.replay!.finalState.tags).not.toContain('status:todo')
  })

  // 鈹€鈹€鈹€ Broken / conflicted chain rejection 鈹€鈹€鈹€

  it('rejects archive when patch chain has multiple roots', async () => {
    const { service, repo } = createServiceWithRepo()
    const envelope = await service.create({
      schema: 'CardBody',
      tags: ['status:todo'],
      body: { title: 'Multi-root archive test' },
    })
    const recordId = envelope.body.id

    const headBefore = await service.getSnapshotHead()
    const patchCountBefore = (await service.listPatchesByTargetId(recordId)).length

    await repo.appendPatch(makePatchDoc('p1', recordId, null, { tagChanges: { change: [{ namespace: 'status', from: 'status:todo', to: 'status:wip' }] } as any }))
    await repo.appendPatch(makePatchDoc('p2', recordId, null, { tagChanges: { change: [{ namespace: 'status', from: 'status:todo', to: 'status:done' }] } as any }))

    await expect(service.delete(recordId)).rejects.toThrow(SnapshotConflictError)

    const headAfter = await service.getSnapshotHead()
    expect(headAfter.version).toBe(headBefore.version)
    const patchesAfter = await service.listPatchesByTargetId(recordId)
    expect(patchesAfter).toHaveLength(patchCountBefore + 2)
    for (const p of patchesAfter) {
      expect(p.body.tagChanges?.add ?? []).not.toContain('status:archived')
    }
  })

  it('rejects archive when patch chain has branched children', async () => {
    const { service, repo } = createServiceWithRepo()
    const envelope = await service.create({
      schema: 'CardBody',
      tags: ['status:todo'],
      body: { title: 'Branched archive test' },
    })
    const recordId = envelope.body.id

    const headBefore = await service.getSnapshotHead()
    const patchCountBefore = (await service.listPatchesByTargetId(recordId)).length

    await repo.appendPatch(makePatchDoc('p1', recordId, null))
    await repo.appendPatch(makePatchDoc('p2', recordId, 'p1'))
    await repo.appendPatch(makePatchDoc('p3', recordId, 'p1'))

    await expect(service.delete(recordId)).rejects.toThrow(SnapshotConflictError)

    const headAfter = await service.getSnapshotHead()
    expect(headAfter.version).toBe(headBefore.version)
    const patchCountAfter = (await service.listPatchesByTargetId(recordId)).length
    expect(patchCountAfter).toBe(patchCountBefore + 3)
  })

  it('rejects archive when patch chain has missing parent', async () => {
    const { service, repo } = createServiceWithRepo()
    const envelope = await service.create({
      schema: 'CardBody',
      tags: ['status:todo'],
      body: { title: 'Missing parent archive test' },
    })
    const recordId = envelope.body.id

    const headBefore = await service.getSnapshotHead()
    const patchCountBefore = (await service.listPatchesByTargetId(recordId)).length

    await repo.appendPatch(makePatchDoc('patch-1', recordId, null))
    await repo.appendPatch(makePatchDoc('patch-2', recordId, 'non-existent-parent'))

    await expect(service.delete(recordId)).rejects.toThrow(SnapshotConflictError)

    const headAfter = await service.getSnapshotHead()
    expect(headAfter.version).toBe(headBefore.version)
    const patchCountAfter = (await service.listPatchesByTargetId(recordId)).length
    expect(patchCountAfter).toBe(patchCountBefore + 2)
  })

  it('rejects archive when patch chain has detached cycle', async () => {
    const { service, repo } = createServiceWithRepo()
    const envelope = await service.create({
      schema: 'CardBody',
      tags: ['status:todo'],
      body: { title: 'Detached cycle archive test' },
    })
    const recordId = envelope.body.id

    const headBefore = await service.getSnapshotHead()
    const patchCountBefore = (await service.listPatchesByTargetId(recordId)).length

    await repo.appendPatch(makePatchDoc('patch-1', recordId, null))
    await repo.appendPatch(makePatchDoc('patch-2', recordId, 'patch-3'))
    await repo.appendPatch(makePatchDoc('patch-3', recordId, 'patch-2'))

    await expect(service.delete(recordId)).rejects.toThrow(SnapshotConflictError)

    const headAfter = await service.getSnapshotHead()
    expect(headAfter.version).toBe(headBefore.version)
    const patchCountAfter = (await service.listPatchesByTargetId(recordId)).length
    expect(patchCountAfter).toBe(patchCountBefore + 3)
  })

  // 鈹€鈹€鈹€ Consistency 鈹€鈹€鈹€

  it('archive response tags match replay finalState and does not rollback current state', async () => {
    const service = createRecordService()
    const envelope = await service.create({
      schema: 'CardBody',
      tags: ['status:todo'],
      body: { title: 'No rollback test' },
    })
    const recordId = envelope.body.id

    await service.createRecordPatch(recordId, {
      parentId: null,
      currentVersion: 0,
      tagChanges: { change: [{ namespace: 'status', from: 'status:todo', to: 'status:wip' }] },
    })

    const archivedEnv = await service.delete(recordId)
    expect(archivedEnv).not.toBeNull()
    const archived = archivedEnv!.body

    expect(archived.tags).toEqual(
      expect.arrayContaining(['status:wip', 'status:archived'])
    )
    expect(archived.tags).not.toContain('status:todo')

    const history = await service.getRecordHistory(recordId)
    expect(history).not.toBeNull()
    expect(history!.replay).toBeDefined()
    expect(history!.replay!.finalState.tags).toEqual(
      expect.arrayContaining(['status:wip', 'status:archived'])
    )
    expect(history!.replay!.finalState.tags).not.toContain('status:todo')

    expect(archived.tags).toEqual(history!.replay!.finalState.tags)
  })

  it('archive uses rebuilt snapshot head when no checkpoint has been loaded', async () => {
    const { service, repo } = createServiceWithRepo()
    const envelope = await service.create({
      schema: 'CardBody',
      tags: ['status:todo'],
      body: { title: 'Head replay mismatch test' },
    })
    const recordId = envelope.body.id

    await repo.appendPatch(
      makePatchDoc('injected-before-load', recordId, null, {
        tagChanges: { change: [{ namespace: 'status', from: 'status:todo', to: 'status:wip' }] },
      })
    )

    const archived = await service.delete(recordId)
    expect(archived!.body.tags).toEqual(
      expect.arrayContaining(['status:wip', 'status:archived'])
    )

    const head = await service.getSnapshotHead()
    expect(head.version).toBe(2)
    expect(head.records[recordId]?.lastPatchId).not.toBe('injected-before-load')
  })
})
