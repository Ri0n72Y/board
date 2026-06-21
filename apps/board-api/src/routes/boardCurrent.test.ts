import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import { createBoardCurrentRoute } from './boardCurrent.js'
import { createServiceWithRepo, makePatchDoc } from '../services/record/recordTestUtils.js'

function createApp(): Hono {
  return new Hono()
}

function createAppWithRoute(): {
  app: Hono
  service: ReturnType<typeof createServiceWithRepo>['service']
  repo: ReturnType<typeof createServiceWithRepo>['repo']
} {
  const { service, repo, head } = createServiceWithRepo()
  const app = new Hono()
  app.route('/api/v0/board', createBoardCurrentRoute(repo, head))
  return { app, service, repo }
}

describe('GET /api/v0/board/current', () => {
  // 鈹€鈹€ Empty board 鈹€鈹€

  it('empty board returns 200 with empty projection', async () => {
    const { app } = createAppWithRoute()

    const res = await app.request('/api/v0/board/current')
    expect(res.status).toBe(200)

    const payload = await res.json()
    expect(payload.ok).toBe(true)
    expect(payload.data.snapshotHeadVersion).toBe(0)
    expect(payload.data.records).toEqual([])
    expect(payload.data.blockedRecords).toEqual([])
    expect(payload.data.summary.projectionStatus).toBe('empty')
    expect(payload.data.diagnostics).toBeUndefined()
  })

  // 鈹€鈹€ Basic current record 鈹€鈹€

  it('returns current record for base record without patches', async () => {
    const { app, service } = createAppWithRoute()

    const envelope = await service.create({
      schema: 'CardBody',
      tags: ['status:todo'],
      body: { title: 'Visible' },
    })

    const res = await app.request('/api/v0/board/current')
    expect(res.status).toBe(200)

    const payload = await res.json()
    expect(payload.data.records).toHaveLength(1)
    expect(payload.data.records[0].body.id).toBe(envelope.body.id)
    expect(payload.data.records[0].body.tags).toEqual(['status:todo'])
    // Body must not contain envelope fields
    expect(payload.data.records[0].body).not.toHaveProperty('createdBy')
    expect(payload.data.records[0].body).not.toHaveProperty('createdAt')
    // Envelope layer has audit fields
    expect(payload.data.records[0]).toHaveProperty('createdBy')
    expect(payload.data.records[0]).toHaveProperty('createdAt')
    expect(payload.data.summary.visibleCurrentRecords).toBe(1)
    expect(payload.data.summary.projectionStatus).toBe('clean')
  })

  // 鈹€鈹€ Complete patch chain 鈹€鈹€

  it('returns replayed current state after patches', async () => {
    const { app, service } = createAppWithRoute()

    const envelope = await service.create({
      schema: 'CardBody',
      tags: ['status:todo'],
      body: { title: 'Patched', description: 'Original' },
    })
    const recordId = envelope.body.id

    await service.createRecordPatch(recordId, {
      parentId: null,
      currentVersion: 0,
      tagChanges: { change: [{ namespace: 'status', from: 'status:todo', to: 'status:wip' }] },
      body: { description: 'Updated via patch' },
    })

    const res = await app.request('/api/v0/board/current')
    expect(res.status).toBe(200)

    const payload = await res.json()
    expect(payload.data.records).toHaveLength(1)
    const current = payload.data.records[0].body
    expect(current.tags).toEqual(['status:wip'])
    expect(current.body).toMatchObject({
      title: 'Patched',
      description: 'Updated via patch',
    })
  })

  it('filters board current by replayed tags and ignores schema', async () => {
    const { app, service } = createAppWithRoute()

    const envelope = await service.create({
      schema: 'CardBody',
      tags: ['status:todo'],
      body: { title: 'Route filtered' },
    })
    await service.createRecordPatch(envelope.body.id, {
      parentId: null,
      currentVersion: 0,
      tagChanges: { change: [{ namespace: 'status', from: 'status:todo', to: 'status:wip' }] },
    })

    const wipRes = await app.request(
      '/api/v0/board/current?tags=status:wip&schema=NotAUserFilter'
    )
    const wipPayload = await wipRes.json()
    expect(wipPayload.data.records).toHaveLength(1)
    expect(wipPayload.data.records[0].body.id).toBe(envelope.body.id)

    const todoRes = await app.request(
      '/api/v0/board/current?tags=status:todo&schema=CardBody'
    )
    const todoPayload = await todoRes.json()
    expect(todoPayload.data.records).toEqual([])
  })

  it('schema-only query does not filter board current results', async () => {
    const { app, service } = createAppWithRoute()

    const envelope = await service.create({
      schema: 'CardBody',
      tags: ['status:todo'],
      body: { title: 'Schema ignored' },
    })

    const res = await app.request('/api/v0/board/current?schema=SomeSchema')
    const payload = await res.json()

    expect(
      payload.data.records.map(
        (record: { body: { id: string } }) => record.body.id
      )
    ).toEqual([envelope.body.id])
    expect(payload.data.summary.visibleCurrentRecords).toBe(1)
  })

  it('parses tagMatch=any, assignee, assetId, relationTarget, and q for board current', async () => {
    const { app, service } = createAppWithRoute()

    const target = await service.create({
      schema: 'AssetBody',
      tags: ['status:todo'],
      body: { title: 'Linked target' },
    })
    const envelope = await service.create({
      schema: 'CardBody',
      tags: ['status:todo'],
      body: { title: 'Base title' },
    })
    await service.createRecordPatch(envelope.body.id, {
      parentId: null,
      currentVersion: 0,
      tagChanges: { change: [{ namespace: 'status', from: 'status:todo', to: 'status:wip' }] },
      assignee: 'member-current',
      assets: [target.body.id],
      relations: [{ constraint: 'blocks', target: target.body.id }],
      body: { title: 'Current route searchable' },
    })

    const url =
      `/api/v0/board/current?tags=status:wip&tags=status:todo` +
      `&tagMatch=any&assignee=member-current&assetId=${target.body.id}` +
      `&relationTarget=${target.body.id}&q=current%20route`
    const res = await app.request(url)
    const payload = await res.json()
    expect(
      payload.data.records.map(
        (record: { body: { id: string } }) => record.body.id
      )
    ).toEqual([envelope.body.id])
    expect(payload.data.summary.visibleCurrentRecords).toBe(1)
  })

  // 鈹€鈹€ Archived 鈹€鈹€

  it('hides archived current records by default', async () => {
    const { app, service } = createAppWithRoute()

    const envelope = await service.create({
      schema: 'CardBody',
      tags: ['status:todo'],
      body: { title: 'To archive' },
    })
    await service.delete(envelope.body.id)

    const res = await app.request('/api/v0/board/current')
    expect(res.status).toBe(200)

    const payload = await res.json()
    expect(payload.data.records).toEqual([])
    expect(payload.data.summary.archivedRecords).toBe(1)
  })

  it('returns archived current records when includeArchived=true', async () => {
    const { app, service } = createAppWithRoute()

    const envelope = await service.create({
      schema: 'CardBody',
      tags: ['status:todo'],
      body: { title: 'Archived visible' },
    })
    await service.delete(envelope.body.id)

    const res = await app.request(
      '/api/v0/board/current?includeArchived=true'
    )
    expect(res.status).toBe(200)

    const payload = await res.json()
    expect(payload.data.records).toHaveLength(1)
    expect(payload.data.records[0].body.tags).toContain('status:archived')
    expect(payload.data.summary.visibleCurrentRecords).toBe(1)
  })

  it('archived tags come from replay current, not base', async () => {
    const { app, service } = createAppWithRoute()

    // base: status:todo 鈫?patch: status:wip 鈫?archive
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
    await service.delete(recordId)

    const res = await app.request(
      '/api/v0/board/current?includeArchived=true'
    )
    expect(res.status).toBe(200)

    const payload = await res.json()
    expect(payload.data.records).toHaveLength(1)
    const tags = payload.data.records[0].body.tags
    expect(tags).toEqual(
      expect.arrayContaining(['status:wip', 'status:archived'])
    )
    expect(tags).not.toContain('status:todo')
  })

  // 鈹€鈹€ Broken / conflicted 鈹€鈹€

  it('conflicted record enters blockedRecords, not records', async () => {
    const { app, service, repo } = createAppWithRoute()

    const envelope = await service.create({
      schema: 'CardBody',
      tags: ['status:todo'],
      body: { title: 'Multi-root record' },
    })
    const recordId = envelope.body.id

    await repo.appendPatch(makePatchDoc('p1', recordId, null))
    await repo.appendPatch(makePatchDoc('p2', recordId, null))

    const res = await app.request('/api/v0/board/current')
    expect(res.status).toBe(200)

    const payload = await res.json()
    expect(payload.data.records).toEqual([])
    expect(payload.data.blockedRecords).toHaveLength(1)
    expect(payload.data.blockedRecords[0].recordId).toBe(recordId)
    expect(payload.data.blockedRecords[0].status).toBe('conflicted')
    expect(payload.data.blockedRecords[0].diagnostics).toBeDefined()
    expect(payload.data.blockedRecords[0].diagnostics.some(
      (d: { code: string }) => d.code === 'MULTIPLE_ROOTS'
    )).toBe(true)
    expect(payload.data.summary.blockedRecords).toBe(1)
  })

  // 鈹€鈹€ Corrupted snapshot head 鈹€鈹€

  it('corrupted head with no base records returns 200 with diagnostics', async () => {
    const { service, repo, head } = createServiceWithRepo()
    const app = createApp()
    app.route('/api/v0/board', createBoardCurrentRoute(repo, head))

    // Inject broken patches to corrupt the head (no base records)
    const fakeId = '00000000-0000-0000-0000-000000000099'
    await repo.appendPatch(makePatchDoc('cp1', fakeId, null))
    await repo.appendPatch(makePatchDoc('cp2', fakeId, null))

    const res = await app.request('/api/v0/board/current')
    expect(res.status).toBe(200)

    const payload = await res.json()
    expect(payload.data.snapshotHeadVersion).toBe(-1)
    expect(payload.data.diagnostics).toBeDefined()
    expect(payload.data.diagnostics.some(
      (d: { code: string }) => d.code === 'SNAPSHOT_HEAD_INTEGRITY_ERROR'
    )).toBe(true)
    expect(payload.data.summary.projectionStatus).toBe('blocked')
    // blockedStatus must not be 'empty' when head is corrupted
    expect(payload.data.summary.projectionStatus).not.toBe('empty')
  })

  it('corrupted head with visible records returns partial, not clean', async () => {
    const { service, repo, head } = createServiceWithRepo()
    const app = createApp()
    app.route('/api/v0/board', createBoardCurrentRoute(repo, head))

    // Create a normal record
    await service.create({
      schema: 'CardBody',
      tags: ['status:todo'],
      body: { title: 'Survivor' },
    })

    // Inject broken patches to corrupt the head
    const fakeId = '00000000-0000-0000-0000-000000000098'
    await repo.appendPatch(makePatchDoc('cp1', fakeId, null))
    await repo.appendPatch(makePatchDoc('cp2', fakeId, null))

    const res = await app.request('/api/v0/board/current')
    expect(res.status).toBe(200)

    const payload = await res.json()
    expect(payload.data.snapshotHeadVersion).toBe(-1)
    expect(payload.data.diagnostics).toBeDefined()
    expect(payload.data.records).toHaveLength(1)
    // Must be partial, not clean
    expect(payload.data.summary.projectionStatus).toBe('partial')
    expect(payload.data.summary.projectionStatus).not.toBe('clean')
  })

  // 鈹€鈹€ Side-effect-free 鈹€鈹€

  it('route does not modify snapshot head', async () => {
    const { app, service } = createAppWithRoute()

    // Create a record with a patch so snapshot head version > 0
    const envelope = await service.create({
      schema: 'CardBody',
      tags: ['status:todo'],
      body: { title: 'Stable' },
    })
    await service.createRecordPatch(envelope.body.id, {
      parentId: null,
      currentVersion: 0,
      tagChanges: { change: [{ namespace: 'status', from: 'status:todo', to: 'status:wip' }] },
    })

    const headBefore = structuredClone(await service.getSnapshotHead())
    expect(headBefore.version).toBeGreaterThan(0)

    await app.request('/api/v0/board/current')

    const headAfter = await service.getSnapshotHead()
    expect(headAfter).toEqual(headBefore)
  })

  it('route does not append patches', async () => {
    const { app, service } = createAppWithRoute()

    const envelope = await service.create({
      schema: 'CardBody',
      tags: ['status:todo'],
      body: { title: 'No leak' },
    })

    const patchesBefore = (await service.listPatchesByTargetId(
      envelope.body.id
    )).length

    await app.request('/api/v0/board/current')

    const patchesAfter = (await service.listPatchesByTargetId(
      envelope.body.id
    )).length
    expect(patchesAfter).toBe(patchesBefore)
  })

  it('route does not modify records collection', async () => {
    const { app, service, repo } = createAppWithRoute()

    const envelope = await service.create({
      schema: 'CardBody',
      tags: ['status:todo'],
      body: { title: 'No mutation' },
    })

    const recordBefore = structuredClone(await repo.findById(envelope.body.id))

    await app.request('/api/v0/board/current')

    const recordAfter = await repo.findById(envelope.body.id)
    expect(recordAfter).toEqual(recordBefore)
  })
})
