import { describe, expect, it } from 'vitest'
import { getBoardCurrentProjection } from './boardCurrentService.js'
import { createServiceWithRepo, makePatchDoc } from '../record/recordTestUtils.js'

describe('boardCurrentService', () => {
  // 鈹€鈹€ Empty board 鈹€鈹€

  it('empty board: projectionStatus = empty, no diagnostics', async () => {
    const { service, repo, head } = createServiceWithRepo()

    const board = await getBoardCurrentProjection({
      repository: repo,
      snapshotHeadRepository: head,
    })

    expect(board.snapshotHeadVersion).toBe(0)
    expect(board.records).toEqual([])
    expect(board.blockedRecords).toEqual([])
    expect(board.diagnostics).toBeUndefined()
    expect(board.summary).toEqual({
      totalBaseRecords: 0,
      visibleCurrentRecords: 0,
      archivedRecords: 0,
      blockedRecords: 0,
      projectionStatus: 'empty',
    })
  })

  // 鈹€鈹€ Basic current records 鈹€鈹€

  it('base record without patches appears in current', async () => {
    const { service, repo, head } = createServiceWithRepo()

    await service.create({
      schema: 'CardBody',
      tags: ['status:todo'],
      body: { title: 'Visible record' },
    })

    const board = await getBoardCurrentProjection({
      repository: repo,
      snapshotHeadRepository: head,
    })

    expect(board.diagnostics).toBeUndefined()
    expect(board.records).toHaveLength(1)
    expect(board.records[0].body.tags).toEqual(['status:todo'])
    expect(board.records[0].body.body.title).toBe('Visible record')
    expect(board.records[0]).toHaveProperty('createdBy')
    expect(board.records[0]).toHaveProperty('createdAt')
    expect(board.records[0].body).not.toHaveProperty('createdBy')
    expect(board.records[0].body).not.toHaveProperty('createdAt')
    expect(board.summary.totalBaseRecords).toBe(1)
    expect(board.summary.visibleCurrentRecords).toBe(1)
    expect(board.summary.projectionStatus).toBe('clean')
  })

  it('complete patch chain produces replayed current state', async () => {
    const { service, repo, head } = createServiceWithRepo()

    const envelope = await service.create({
      schema: 'CardBody',
      tags: ['status:todo'],
      body: { title: 'Patched record' },
    })
    const recordId = envelope.body.id

    await service.createRecordPatch(recordId, {
      parentId: null,
      snapshotVersion: 0,
      tagChanges: { change: [{ namespace: 'status', from: 'status:todo', to: 'status:wip' }] },
      body: { description: 'Updated via patch' },
    })

    const board = await getBoardCurrentProjection({
      repository: repo,
      snapshotHeadRepository: head,
    })

    expect(board.records).toHaveLength(1)
    const current = board.records[0].body
    expect(current.tags).toEqual(['status:wip'])
    expect(current.body).toMatchObject({
      title: 'Patched record',
      description: 'Updated via patch',
    })
  })

  // Current-state filters

  it('filters tags against current replayed state with tagMatch=all by default', async () => {
    const { service, repo, head } = createServiceWithRepo()

    const envelope = await service.create({
      schema: 'CardBody',
      tags: ['status:todo', 'priority:urgent-important'],
      body: { title: 'Retagged record' },
    })

    await service.createRecordPatch(envelope.body.id, {
      parentId: null,
      snapshotVersion: 0,
      tagChanges: {
        change: [
          { namespace: 'status', from: 'status:todo', to: 'status:wip' },
        ],
      },
    })

    const wipBoard = await getBoardCurrentProjection({
      repository: repo,
      snapshotHeadRepository: head,
      query: {
        tags: ['status:wip', 'priority:urgent-important'],
        tagMatch: 'all',
      },
    })
    expect(wipBoard.records).toHaveLength(1)
    expect(wipBoard.summary.visibleCurrentRecords).toBe(1)

    const todoBoard = await getBoardCurrentProjection({
      repository: repo,
      snapshotHeadRepository: head,
      query: { tags: ['status:todo'] },
    })
    expect(todoBoard.records).toEqual([])
    expect(todoBoard.summary.visibleCurrentRecords).toBe(0)
  })

  it('supports tagMatch=any against current replayed tags', async () => {
    const { service, repo, head } = createServiceWithRepo()

    const first = await service.create({
      schema: 'CardBody',
      tags: ['status:todo'],
      body: { title: 'First' },
    })
    await service.createRecordPatch(first.body.id, {
      parentId: null,
      snapshotVersion: 0,
      tagChanges: { change: [{ namespace: 'status', from: 'status:todo', to: 'status:wip' }] },
    })

    await service.create({
      schema: 'CardBody',
      tags: ['status:todo'],
      body: { title: 'Second' },
    })

    const board = await getBoardCurrentProjection({
      repository: repo,
      snapshotHeadRepository: head,
      query: { tags: ['status:wip', 'status:todo'], tagMatch: 'any' },
    })

    expect(board.records.map((record) => record.body.body.title)).toEqual([
      'First',
      'Second',
    ])
    expect(board.summary.visibleCurrentRecords).toBe(2)
  })

  it('filters assignee, assetId, and relationTarget against current replayed state', async () => {
    const { service, repo, head } = createServiceWithRepo()

    const target = await service.create({
      schema: 'AssetBody',
      tags: ['status:todo'],
      body: { title: 'Target asset' },
    })
    const envelope = await service.create({
      schema: 'CardBody',
      tags: ['status:todo'],
      body: { title: 'Linked card' },
    })

    await service.createRecordPatch(envelope.body.id, {
      parentId: null,
      snapshotVersion: 0,
      assignee: 'member-current',
      assets: [target.body.id],
      relations: [{ constraint: 'blocks', target: target.body.id }],
    })

    for (const query of [
      { assignee: 'member-current' },
      { assetId: target.body.id },
      { relationTarget: target.body.id },
    ]) {
      const board = await getBoardCurrentProjection({
        repository: repo,
        snapshotHeadRepository: head,
        query,
      })
      expect(board.records.map((record) => record.body.id)).toEqual([
        envelope.body.id,
      ])
      expect(board.summary.visibleCurrentRecords).toBe(1)
    }

    const oldAssigneeBoard = await getBoardCurrentProjection({
      repository: repo,
      snapshotHeadRepository: head,
      query: { assignee: 'member-old' },
    })
    expect(oldAssigneeBoard.records).toEqual([])
  })

  it('searches q only against current body text', async () => {
    const { service, repo, head } = createServiceWithRepo()

    const target = await service.create({
      schema: 'AssetBody',
      tags: ['status:todo'],
      body: { title: 'Plain asset' },
    })
    const envelope = await service.create({
      schema: 'CardBody',
      assignee: 'member-hidden',
      tags: ['status:todo', 'asset:image'],
      assets: ['asset-hidden'],
      relations: [{ constraint: 'blocks', target: target.body.id }],
      body: {
        title: 'Old title',
        description: 'Old description',
      },
    })

    const firstPatch = await service.createRecordPatch(envelope.body.id, {
      parentId: null,
      snapshotVersion: 0,
      body: {
        title: 'Current visible title',
        description: 'Current visible description',
      },
      description: 'hidden patch description',
    })
    expect(firstPatch).not.toBeNull()

    const secondPatch = await service.createRecordPatch(envelope.body.id, {
      parentId: firstPatch!.patch.body.id,
      snapshotVersion: firstPatch!.newSnapshotVersion,
      body: { content: 'Current visible content' },
      description: 'hidden second patch description',
    })
    expect(secondPatch).not.toBeNull()

    for (const q of [
      'current visible title',
      'current visible description',
      'current visible content',
    ]) {
      const board = await getBoardCurrentProjection({
        repository: repo,
        snapshotHeadRepository: head,
        query: { q },
      })
      expect(board.records.map((record) => record.body.id)).toEqual([
        envelope.body.id,
      ])
    }

    for (const q of [
      'Old title',
      'Old description',
      'asset:image',
      'member-hidden',
      'asset-hidden',
      target.body.id,
      'CardBody',
      envelope.body.id,
      envelope.body.pid,
      'hidden patch description',
      firstPatch!.patch.body.targetId,
      secondPatch!.patch.body.parentId!,
      'hidden second patch description',
    ]) {
      const board = await getBoardCurrentProjection({
        repository: repo,
        snapshotHeadRepository: head,
        query: { q },
      })
      expect(board.records).toEqual([])
    }
  })

  // 鈹€鈹€ Archived records 鈹€鈹€

  it('archived current record is hidden by default', async () => {
    const { service, repo, head } = createServiceWithRepo()

    const envelope = await service.create({
      schema: 'CardBody',
      tags: ['status:todo'],
      body: { title: 'To archive' },
    })
    await service.delete(envelope.body.id)

    const board = await getBoardCurrentProjection({
      repository: repo,
      snapshotHeadRepository: head,
    })

    expect(board.records).toEqual([])
    expect(board.summary.totalBaseRecords).toBe(1)
    expect(board.summary.visibleCurrentRecords).toBe(0)
    expect(board.summary.archivedRecords).toBe(1)
    expect(board.summary.projectionStatus).toBe('partial')
  })

  it('includeArchived=true returns archived current records', async () => {
    const { service, repo, head } = createServiceWithRepo()

    const envelope = await service.create({
      schema: 'CardBody',
      tags: ['status:todo'],
      body: { title: 'Archived visible' },
    })
    await service.delete(envelope.body.id)

    const board = await getBoardCurrentProjection({
      repository: repo,
      snapshotHeadRepository: head,
      includeArchived: true,
    })

    expect(board.records).toHaveLength(1)
    expect(board.records[0].body.tags).toContain('status:archived')
    expect(board.summary.visibleCurrentRecords).toBe(1)
  })

  it('includeArchived=true keeps archivedRecords as a projection-level count when filters miss archived records', async () => {
    const { service, repo, head } = createServiceWithRepo()

    const envelope = await service.create({
      schema: 'CardBody',
      tags: ['status:todo'],
      body: { title: 'Archived filtered out' },
    })
    await service.delete(envelope.body.id)

    const board = await getBoardCurrentProjection({
      repository: repo,
      snapshotHeadRepository: head,
      query: { includeArchived: true, q: 'no matching text' },
    })

    expect(board.records).toEqual([])
    expect(board.summary.visibleCurrentRecords).toBe(0)
    expect(board.summary.visibleCurrentRecords).toBe(board.records.length)
    expect(board.summary.archivedRecords).toBe(1)
    expect(board.summary.projectionStatus).toBe('partial')
  })

  it('archived record tags come from replay finalState, not base tags', async () => {
    const { service, repo, head } = createServiceWithRepo()

    const envelope = await service.create({
      schema: 'CardBody',
      tags: ['status:todo'],
      body: { title: 'Patch then archive' },
    })
    const recordId = envelope.body.id

    await service.createRecordPatch(recordId, {
      parentId: null,
      snapshotVersion: 0,
      tagChanges: { change: [{ namespace: 'status', from: 'status:todo', to: 'status:wip' }] },
    })
    await service.delete(recordId)

    const board = await getBoardCurrentProjection({
      repository: repo,
      snapshotHeadRepository: head,
      includeArchived: true,
    })

    expect(board.records).toHaveLength(1)
    const tags = board.records[0].body.tags
    expect(tags).toEqual(
      expect.arrayContaining(['status:wip', 'status:archived'])
    )
    expect(tags).not.toContain('status:todo')
  })

  // 鈹€鈹€ Blocked records 鈹€鈹€

  it('conflicted record enters blocked diagnostics with top-level head error', async () => {
    const { service, repo, head } = createServiceWithRepo()

    const envelope = await service.create({
      schema: 'CardBody',
      tags: ['status:todo'],
      body: { title: 'Broken record' },
    })
    const recordId = envelope.body.id

    await repo.appendPatch(makePatchDoc('p1', recordId, null))
    await repo.appendPatch(makePatchDoc('p2', recordId, null))

    const board = await getBoardCurrentProjection({
      repository: repo,
      snapshotHeadRepository: head,
    })

    // Head is corrupted by the multi-root patches 鈥?top-level diagnostics
    expect(board.snapshotHeadVersion).toBe(-1)
    expect(board.diagnostics).toBeDefined()
    expect(board.diagnostics!.some(
      (d) => d.code === 'SNAPSHOT_HEAD_INTEGRITY_ERROR'
    )).toBe(true)
    expect(board.diagnostics![0].message).toContain('corrupted')

    // Per-record diagnostics still present
    expect(board.records).toEqual([])
    expect(board.blockedRecords).toHaveLength(1)
    expect(board.blockedRecords[0].recordId).toBe(recordId)
    expect(board.blockedRecords[0].status).toBe('conflicted')
    expect(board.blockedRecords[0].diagnostics.some(
      (d) => d.code === 'MULTIPLE_ROOTS'
    )).toBe(true)
    expect(board.summary.blockedRecords).toBe(1)
    // Has blocked records + corrupted head 鈫?blocked
    expect(board.summary.projectionStatus).toBe('blocked')
  })

  it('conflicted record enters blocked diagnostics, not normal records', async () => {
    const { service, repo, head } = createServiceWithRepo()

    const envelope = await service.create({
      schema: 'CardBody',
      tags: ['status:todo'],
      body: { title: 'Branched record' },
    })
    const recordId = envelope.body.id

    await repo.appendPatch(makePatchDoc('p1', recordId, null))
    await repo.appendPatch(makePatchDoc('p2', recordId, 'p1'))
    await repo.appendPatch(makePatchDoc('p3', recordId, 'p1'))

    const board = await getBoardCurrentProjection({
      repository: repo,
      snapshotHeadRepository: head,
    })

    expect(board.blockedRecords).toHaveLength(1)
    expect(board.blockedRecords[0].status).toBe('conflicted')
    // Top-level diagnostics from corrupted head
    expect(board.snapshotHeadVersion).toBe(-1)
    expect(board.diagnostics!.some(
      (d) => d.code === 'SNAPSHOT_HEAD_INTEGRITY_ERROR'
    )).toBe(true)
  })

  // 鈹€鈹€ Snapshot head integrity error 鈹€鈹€

  it('corrupted head with no base records: projectionStatus = blocked, not empty', async () => {
    const { repo, head } = createServiceWithRepo()

    // Inject broken patches to corrupt the head (no base records created)
    const fakeId = '00000000-0000-0000-0000-000000000001'
    await repo.appendPatch(makePatchDoc('corrupt-p1', fakeId, null))
    await repo.appendPatch(makePatchDoc('corrupt-p2', fakeId, null))

    const board = await getBoardCurrentProjection({
      repository: repo,
      snapshotHeadRepository: head,
    })

    expect(board.snapshotHeadVersion).toBe(-1)
    expect(board.diagnostics).toBeDefined()
    expect(board.diagnostics!.some(
      (d) => d.code === 'SNAPSHOT_HEAD_INTEGRITY_ERROR'
    )).toBe(true)
    expect(board.records).toEqual([])
    expect(board.blockedRecords).toEqual([])
    // No base records + corrupted head 鈫?blocked, not empty
    expect(board.summary.projectionStatus).toBe('blocked')
    expect(board.summary.totalBaseRecords).toBe(0)
  })

  it('corrupted head with visible records: projectionStatus = partial', async () => {
    const { service, repo, head } = createServiceWithRepo()

    // Create a normal record
    await service.create({
      schema: 'CardBody',
      tags: ['status:todo'],
      body: { title: 'Surviving record' },
    })

    // Inject broken patches for an unrelated target to corrupt the head
    const fakeId = '00000000-0000-0000-0000-000000000002'
    await repo.appendPatch(makePatchDoc('corrupt-p1', fakeId, null))
    await repo.appendPatch(makePatchDoc('corrupt-p2', fakeId, null))

    const board = await getBoardCurrentProjection({
      repository: repo,
      snapshotHeadRepository: head,
    })

    // Head corrupted, top-level diagnostics present
    expect(board.snapshotHeadVersion).toBe(-1)
    expect(board.diagnostics!.some(
      (d) => d.code === 'SNAPSHOT_HEAD_INTEGRITY_ERROR'
    )).toBe(true)
    // Surviving record still visible
    expect(board.records).toHaveLength(1)
    expect(board.records[0].body.body.title).toBe('Surviving record')
    // Has visible records but head corrupted 鈫?partial, not clean
    expect(board.summary.projectionStatus).toBe('partial')
    expect(board.summary.visibleCurrentRecords).toBe(1)
  })

  it('corrupted head does not replace per-record blocked diagnostics', async () => {
    const { service, repo, head } = createServiceWithRepo()

    const envelope = await service.create({
      schema: 'CardBody',
      tags: ['status:todo'],
      body: { title: 'Blocked record' },
    })
    const recordId = envelope.body.id

    // Injected broken patches for this record 鈫?both per-record blocked
    // AND top-level head corruption
    await repo.appendPatch(makePatchDoc('p1', recordId, null))
    await repo.appendPatch(makePatchDoc('p2', recordId, null))

    const board = await getBoardCurrentProjection({
      repository: repo,
      snapshotHeadRepository: head,
    })

    // Top-level has head integrity error
    expect(board.diagnostics!.some(
      (d) => d.code === 'SNAPSHOT_HEAD_INTEGRITY_ERROR'
    )).toBe(true)

    // Per-record diagnostics still present
    expect(board.blockedRecords).toHaveLength(1)
    expect(board.blockedRecords[0].diagnostics.some(
      (d) => d.code === 'MULTIPLE_ROOTS'
    )).toBe(true)
  })

  // 鈹€鈹€ Side-effect-free 鈹€鈹€

  it('board current does not modify snapshot head', async () => {
    const { service, repo, head } = createServiceWithRepo()

    await service.create({
      schema: 'CardBody',
      tags: ['status:todo'],
      body: { title: 'Stable test' },
    })

    const headBefore = await service.getSnapshotHead()
    const versionBefore = headBefore.version

    await getBoardCurrentProjection({
      repository: repo,
      snapshotHeadRepository: head,
    })

    const headAfter = await service.getSnapshotHead()
    expect(headAfter.version).toBe(versionBefore)
    expect(headAfter).toEqual(headBefore)
  })

  it('board current does not append patches', async () => {
    const { service, repo, head } = createServiceWithRepo()

    const envelope = await service.create({
      schema: 'CardBody',
      tags: ['status:todo'],
      body: { title: 'No leak test' },
    })

    const patchesBefore = (await service.listPatchesByTargetId(
      envelope.body.id
    )).length

    await getBoardCurrentProjection({
      repository: repo,
      snapshotHeadRepository: head,
    })

    const patchesAfter = (await service.listPatchesByTargetId(
      envelope.body.id
    )).length
    expect(patchesAfter).toBe(patchesBefore)
  })

  it('board current does not modify records collection', async () => {
    const { service, repo, head } = createServiceWithRepo()

    const envelope = await service.create({
      schema: 'CardBody',
      tags: ['status:todo'],
      body: { title: 'No mutation test' },
    })

    const recordBefore = structuredClone(
      await repo.findById(envelope.body.id)
    )

    await getBoardCurrentProjection({
      repository: repo,
      snapshotHeadRepository: head,
    })

    const recordAfter = await repo.findById(envelope.body.id)
    expect(recordAfter).toEqual(recordBefore)
  })

  // 鈹€鈹€ Summary counts 鈹€鈹€

  it('filter-empty healthy projection keeps projectionStatus as global health, not filter emptiness', async () => {
    const { service, repo, head } = createServiceWithRepo()

    await service.create({
      schema: 'CardBody',
      tags: ['status:todo'],
      body: { title: 'Healthy record' },
    })

    const board = await getBoardCurrentProjection({
      repository: repo,
      snapshotHeadRepository: head,
      query: { q: 'no matching text' },
    })

    expect(board.records).toEqual([])
    expect(board.blockedRecords).toEqual([])
    expect(board.diagnostics).toBeUndefined()
    expect(board.summary.visibleCurrentRecords).toBe(board.records.length)
    expect(board.summary.projectionStatus).toBe('clean')
  })

  it('filter-empty projection with blockedRecords does not become clean or empty', async () => {
    const { service, repo, head } = createServiceWithRepo()

    await service.create({
      schema: 'CardBody',
      tags: ['status:todo'],
      body: { title: 'Filtered healthy record' },
    })

    const blocked = await service.create({
      schema: 'CardBody',
      tags: ['status:todo'],
      body: { title: 'Blocked record' },
    })
    await repo.appendPatch(makePatchDoc('blocked-p1', blocked.body.id, null))
    await repo.appendPatch(makePatchDoc('blocked-p2', blocked.body.id, null))

    const board = await getBoardCurrentProjection({
      repository: repo,
      snapshotHeadRepository: head,
      query: { q: 'no matching text' },
    })

    expect(board.records).toEqual([])
    expect(board.blockedRecords).toHaveLength(1)
    expect(board.summary.visibleCurrentRecords).toBe(board.records.length)
    expect(board.summary.projectionStatus).not.toBe('clean')
    expect(board.summary.projectionStatus).not.toBe('empty')
  })

  it('filter-empty projection with top-level diagnostics does not become clean or empty', async () => {
    const { service, repo, head } = createServiceWithRepo()

    await service.create({
      schema: 'CardBody',
      tags: ['status:todo'],
      body: { title: 'Filtered healthy record' },
    })

    const fakeId = '00000000-0000-0000-0000-000000000003'
    await repo.appendPatch(makePatchDoc('diag-p1', fakeId, null))
    await repo.appendPatch(makePatchDoc('diag-p2', fakeId, null))

    const board = await getBoardCurrentProjection({
      repository: repo,
      snapshotHeadRepository: head,
      query: { q: 'no matching text' },
    })

    expect(board.records).toEqual([])
    expect(board.diagnostics).toBeDefined()
    expect(board.summary.visibleCurrentRecords).toBe(board.records.length)
    expect(board.summary.projectionStatus).not.toBe('clean')
    expect(board.summary.projectionStatus).not.toBe('empty')
  })

  it('summary counts are correct with mixed records', async () => {
    const { service, repo, head } = createServiceWithRepo()

    // Normal record
    await service.create({
      schema: 'CardBody',
      tags: ['status:todo'],
      body: { title: 'Normal' },
    })

    // Archived record
    const toArchive = await service.create({
      schema: 'CardBody',
      tags: ['status:todo'],
      body: { title: 'Archived' },
    })
    await service.delete(toArchive.body.id)

    // Broken record (will also corrupt head)
    const toBreak = await service.create({
      schema: 'CardBody',
      tags: ['status:todo'],
      body: { title: 'Broken' },
    })
    await repo.appendPatch(makePatchDoc('bp1', toBreak.body.id, null))
    await repo.appendPatch(makePatchDoc('bp2', toBreak.body.id, null))

    // Normal record #2
    await service.create({
      schema: 'CardBody',
      tags: ['status:todo'],
      body: { title: 'Normal 2' },
    })

    const board = await getBoardCurrentProjection({
      repository: repo,
      snapshotHeadRepository: head,
    })

    expect(board.summary.totalBaseRecords).toBe(4)
    expect(board.summary.visibleCurrentRecords).toBe(2)
    expect(board.summary.archivedRecords).toBe(1)
    expect(board.summary.blockedRecords).toBe(1)
    // Head was cached before broken patches were injected 鈥?    // the dedicated "corrupted head" tests cover the integrity error path.
    expect(board.summary.projectionStatus).toBe('partial')
  })
})
