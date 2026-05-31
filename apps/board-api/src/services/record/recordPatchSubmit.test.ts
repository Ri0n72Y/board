import { describe, expect, it } from 'vitest'
import { RecordService, RecordValidationError, SnapshotConflictError } from '../recordService.js'
import { createRecordService } from './recordTestUtils.js'

describe('RecordService patch submission (createRecordPatch)', () => {
  describe('basic flow', () => {
    it('creates a patch and returns patch + newSnapshotVersion', async () => {
      const service = createRecordService()
      const envelope = await service.create({
        schema: 'CardBody',
        tags: ['status:todo'],
        body: { title: 'Patch me' },
      })
      const record = envelope.body

      const result = await service.createRecordPatch(record.id, {
        parentId: null,
        snapshotVersion: 0,
        tags: ['status:wip'],
        body: { description: 'Patched description' },
        description: 'Moving to wip',
      })

      expect(result).not.toBeNull()
      expect(result!.patch).toHaveProperty('createdBy')
      expect(result!.patch).toHaveProperty('createdAt')
      expect(result!.patch.body).toMatchObject({
        targetId: record.id,
        parentId: null,
        tags: ['status:wip'],
        body: { description: 'Patched description' },
        description: 'Moving to wip',
      })
      expect(result!.patch.body).not.toHaveProperty('snapshotVersion')
      expect(result!.newSnapshotVersion).toBe(1)
      expect(result).not.toHaveProperty('current' as string)
    })

    it('returns null when target record does not exist', async () => {
      const service = createRecordService()
      await expect(
        service.createRecordPatch('missing', {
          parentId: null,
          snapshotVersion: 0,
          tags: ['status:wip'],
        })
      ).resolves.toBeNull()
    })

    it('does not return patch from list or findById after patch creation', async () => {
      const service = createRecordService()
      const envelope = await service.create({
        schema: 'CardBody',
        tags: ['status:todo'],
        body: { title: 'List patch test' },
      })

      await service.createRecordPatch(envelope.body.id, {
        parentId: null,
        snapshotVersion: 0,
        tags: ['status:wip'],
      })

      const list = await service.list({})
      expect(list).toHaveLength(1)
      expect(list[0].body.id).toBe(envelope.body.id)

      const found = await service.findById(envelope.body.id)
      expect(found).not.toBeNull()
      expect(found!.body.id).toBe(envelope.body.id)
      expect(found!.body.tags).toEqual(['status:todo'])
    })
  })

  describe('input validation', () => {
    it('rejects patch on archived record', async () => {
      const service = createRecordService()
      const envelope = await service.create({
        schema: 'CardBody',
        tags: ['status:todo'],
        body: { title: 'Archived patch test' },
      })
      await service.delete(envelope.body.id)

      await expect(
        service.createRecordPatch(envelope.body.id, {
          parentId: null,
          snapshotVersion: 0,
          tags: ['status:wip'],
        })
      ).rejects.toThrow(`Cannot patch archived record ${envelope.body.id}`)
    })

    it('rejects patch with unsupported tags', async () => {
      const service = createRecordService()
      const envelope = await service.create({
        schema: 'CardBody',
        tags: ['status:todo'],
        body: { title: 'Validation test' },
      })

      await expect(
        service.createRecordPatch(envelope.body.id, {
          parentId: null,
          snapshotVersion: 0,
          tags: ['status:not-configured'],
        })
      ).rejects.toThrow('Unsupported tag: status:not-configured')
    })

    it('rejects patch with unsupported relation constraints', async () => {
      const service = createRecordService()
      const envelope = await service.create({
        schema: 'CardBody',
        tags: ['status:todo'],
        body: { title: 'Relation test' },
      })

      await expect(
        service.createRecordPatch(envelope.body.id, {
          parentId: null,
          snapshotVersion: 0,
          relations: [{ constraint: 'invalidRelation', target: 'target-1' }],
        })
      ).rejects.toThrow('Unsupported relation constraint: invalidRelation')
    })

    it('rejects patch with no change content (empty patch)', async () => {
      const service = createRecordService()
      const envelope = await service.create({
        schema: 'CardBody',
        tags: ['status:todo'],
        body: { title: 'Empty test' },
      })

      await expect(
        service.createRecordPatch(envelope.body.id, {
          parentId: null,
          snapshotVersion: 0,
        })
      ).rejects.toThrow(
        'Patch must contain at least one change: body, tags, assignee, assets, relations, or description'
      )
    })

    it('rejects body: null with RecordValidationError', async () => {
      const service = createRecordService()
      const envelope = await service.create({
        schema: 'CardBody',
        tags: ['status:todo'],
        body: { title: 'Body null test' },
      })

      await expect(
        service.createRecordPatch(envelope.body.id, {
          parentId: null,
          snapshotVersion: 0,
          body: null as any,
        })
      ).rejects.toThrow(RecordValidationError)
    })
  })

  describe('content validation', () => {
    it('allows description-only patch', async () => {
      const service = createRecordService()
      const envelope = await service.create({
        schema: 'CardBody',
        tags: ['status:todo'],
        body: { title: 'Description test' },
      })

      const result = await service.createRecordPatch(envelope.body.id, {
        parentId: null,
        snapshotVersion: 0,
        description: 'A review note',
      })

      expect(result).not.toBeNull()
      expect(result!.patch.body.parentId).toBeNull()
      expect(result!.patch.body.description).toBe('A review note')
      expect(result!.patch.body.tags).toBeUndefined()
      expect(result!.patch.body.body).toBeUndefined()
    })

    it('treats assignee: null as valid patch content', async () => {
      const service = createRecordService()
      const envelope = await service.create({
        schema: 'CardBody',
        tags: ['status:todo'],
        body: { title: 'Assignee test' },
        assignee: 'member-1',
      })

      const result = await service.createRecordPatch(envelope.body.id, {
        parentId: null,
        snapshotVersion: 0,
        assignee: null,
      })

      expect(result).not.toBeNull()
      expect(result!.patch.body).toHaveProperty('assignee', null)
    })

    it('allows assets: [] as valid patch content', async () => {
      const service = createRecordService()
      const envelope = await service.create({
        schema: 'CardBody',
        tags: ['status:todo'],
        body: { title: 'Assets clear test' },
        assets: ['asset-1', 'asset-2'],
      })

      const result = await service.createRecordPatch(envelope.body.id, {
        parentId: null,
        snapshotVersion: 0,
        assets: [],
      })

      expect(result).not.toBeNull()
      expect(result!.patch.body.assets).toEqual([])
    })

    it('allows relations: [] as valid patch content', async () => {
      const service = createRecordService()
      const envelope = await service.create({
        schema: 'CardBody',
        tags: ['status:todo'],
        body: { title: 'Relations clear test' },
        relations: [{ constraint: 'blocks', target: 'other-1' }],
      })

      const result = await service.createRecordPatch(envelope.body.id, {
        parentId: null,
        snapshotVersion: 0,
        relations: [],
      })

      expect(result).not.toBeNull()
      expect(result!.patch.body.relations).toEqual([])
    })

    it('allows tags: [] as valid patch content', async () => {
      const service = createRecordService()
      const envelope = await service.create({
        schema: 'CardBody',
        tags: ['status:todo'],
        body: { title: 'Tags clear test' },
      })

      const result = await service.createRecordPatch(envelope.body.id, {
        parentId: null,
        snapshotVersion: 0,
        tags: [],
      })

      expect(result).not.toBeNull()
      expect(result!.patch.body.tags).toEqual([])
    })
  })

  describe('snapshot head / parent chain', () => {
    it('first patch has parentId: null and updates snapshot head', async () => {
      const service = createRecordService()
      const envelope = await service.create({
        schema: 'CardBody',
        tags: ['status:todo'],
        body: { title: 'Parent null test' },
      })

      const result = await service.createRecordPatch(envelope.body.id, {
        parentId: null,
        snapshotVersion: 0,
        tags: ['status:wip'],
      })

      expect(result).not.toBeNull()
      expect(result!.patch.body.parentId).toBeNull()

      const head = await service.getSnapshotHead()
      expect(head.version).toBe(1)
      expect(head.records[envelope.body.id]).toBeDefined()
      expect(head.records[envelope.body.id].lastPatchId).toBe(
        result!.patch.body.id
      )
    })

    it('second patch must reference first patch as parentId', async () => {
      const service = createRecordService()
      const envelope = await service.create({
        schema: 'CardBody',
        tags: ['status:todo'],
        body: { title: 'Chain test' },
      })

      const r1 = await service.createRecordPatch(envelope.body.id, {
        parentId: null,
        snapshotVersion: 0,
        tags: ['status:wip'],
      })

      const r2 = await service.createRecordPatch(envelope.body.id, {
        parentId: r1!.patch.body.id,
        snapshotVersion: 1,
        body: { description: 'Second' },
      })

      expect(r2).not.toBeNull()
      expect(r2!.patch.body.parentId).toBe(r1!.patch.body.id)

      const head = await service.getSnapshotHead()
      expect(head.version).toBe(2)
      expect(head.records[envelope.body.id].lastPatchId).toBe(r2!.patch.body.id)
    })

    it('throws SnapshotConflictError when snapshotVersion mismatches', async () => {
      const service = createRecordService()
      const envelope = await service.create({
        schema: 'CardBody',
        tags: ['status:todo'],
        body: { title: 'Version conflict test' },
      })

      await expect(
        service.createRecordPatch(envelope.body.id, {
          parentId: null,
          snapshotVersion: 5,
          tags: ['status:wip'],
        })
      ).rejects.toThrow(SnapshotConflictError)

      await expect(
        service.createRecordPatch(envelope.body.id, {
          parentId: null,
          snapshotVersion: 5,
          tags: ['status:wip'],
        })
      ).rejects.toThrow('Snapshot version mismatch')
    })

    it('throws SnapshotConflictError when parentId mismatches lastPatchId', async () => {
      const service = createRecordService()
      const envelope = await service.create({
        schema: 'CardBody',
        tags: ['status:todo'],
        body: { title: 'Parent conflict test' },
      })

      await service.createRecordPatch(envelope.body.id, {
        parentId: null,
        snapshotVersion: 0,
        tags: ['status:wip'],
      })

      await expect(
        service.createRecordPatch(envelope.body.id, {
          parentId: null,
          snapshotVersion: 1,
          tags: ['status:done'],
        })
      ).rejects.toThrow(SnapshotConflictError)

      await expect(
        service.createRecordPatch(envelope.body.id, {
          parentId: null,
          snapshotVersion: 1,
          tags: ['status:done'],
        })
      ).rejects.toThrow('Parent patch mismatch')
    })

    it('treats a non-head parentId as a snapshot conflict even when missing', async () => {
      const service = createRecordService()
      const envelope = await service.create({
        schema: 'CardBody',
        tags: ['status:todo'],
        body: { title: 'Missing parent conflict test' },
      })

      await service.createRecordPatch(envelope.body.id, {
        parentId: null,
        snapshotVersion: 0,
        tags: ['status:wip'],
      })

      await expect(
        service.createRecordPatch(envelope.body.id, {
          parentId: 'missing-patch-id',
          snapshotVersion: 1,
          tags: ['status:done'],
        })
      ).rejects.toThrow(SnapshotConflictError)

      await expect(
        service.createRecordPatch(envelope.body.id, {
          parentId: 'missing-patch-id',
          snapshotVersion: 1,
          tags: ['status:done'],
        })
      ).rejects.toThrow('Parent patch mismatch')
    })

    it('snapshotVersion is not persisted to patch body', async () => {
      const service = createRecordService()
      const envelope = await service.create({
        schema: 'CardBody',
        tags: ['status:todo'],
        body: { title: 'No snap in patch' },
      })

      const result = await service.createRecordPatch(envelope.body.id, {
        parentId: null,
        snapshotVersion: 0,
        tags: ['status:wip'],
      })

      expect(result!.patch.body).not.toHaveProperty('snapshotVersion')

      const found = await service.findPatchById(result!.patch.body.id)
      expect(found!.body).not.toHaveProperty('snapshotVersion')
    })
  })

  describe('patch query helpers', () => {
    it('findPatchById returns a patch and null for missing or record ids', async () => {
      const service = createRecordService()
      const envelope = await service.create({
        schema: 'CardBody',
        tags: ['status:todo'],
        body: { title: 'Find patch test' },
      })

      const result = await service.createRecordPatch(envelope.body.id, {
        parentId: null,
        snapshotVersion: 0,
        tags: ['status:wip'],
      })
      const patch = result!.patch

      const found = await service.findPatchById(patch.body.id)
      expect(found).not.toBeNull()
      expect(found!.body.id).toBe(patch.body.id)
      expect(found!.body.targetId).toBe(envelope.body.id)

      const missing = await service.findPatchById('non-existent')
      expect(missing).toBeNull()

      const recordAsPatch = await service.findPatchById(envelope.body.id)
      expect(recordAsPatch).toBeNull()
    })

    it('listPatchesByTargetId returns patches for a target', async () => {
      const service = createRecordService()
      const envelope = await service.create({
        schema: 'CardBody',
        tags: ['status:todo'],
        body: { title: 'List patches test' },
      })

      const r1 = await service.createRecordPatch(envelope.body.id, {
        parentId: null,
        snapshotVersion: 0,
        tags: ['status:wip'],
      })
      const r2 = await service.createRecordPatch(envelope.body.id, {
        parentId: r1!.patch.body.id,
        snapshotVersion: 1,
        body: { description: 'Second change' },
      })

      const patches = await service.listPatchesByTargetId(envelope.body.id)
      expect(patches).toHaveLength(2)
      expect(patches[0].body.targetId).toBe(envelope.body.id)
      expect(patches[1].body.targetId).toBe(envelope.body.id)
      expect(patches[0].body.parentId).toBeNull()
      expect(patches[1].body.parentId).toBe(r1!.patch.body.id)

      const empty = await service.listPatchesByTargetId('non-existent')
      expect(empty).toEqual([])
    })
  })

  describe('audit envelope', () => {
    it('create record returns envelope with createdBy and createdAt', async () => {
      const service = createRecordService()
      const envelope = await service.create({
        schema: 'CardBody',
        tags: ['status:todo'],
        body: { title: 'Audit test' },
      })

      expect(envelope).toHaveProperty('createdBy')
      expect(envelope).toHaveProperty('createdAt')
      expect(envelope).toHaveProperty('body')
      expect(new Date(envelope.createdAt).toISOString()).toBe(envelope.createdAt)
    })

    it('createdBy defaults to DEFAULT_ACTOR when not provided', async () => {
      const service = createRecordService()
      const envelope = await service.create({
        schema: 'CardBody',
        tags: ['status:todo'],
        body: { title: 'Default actor test' },
      })

      expect(envelope.createdBy).toBe('local')
    })

    it('createdBy defaults to DEFAULT_ACTOR when empty string provided', async () => {
      const service = createRecordService()
      const envelope = await service.create(
        {
          schema: 'CardBody',
          tags: ['status:todo'],
          body: { title: 'Empty actor test' },
        },
        '   '
      )

      expect(envelope.createdBy).toBe('local')
    })

    it('createdBy can be controlled via parameter', async () => {
      const service = createRecordService()
      const envelope = await service.create(
        {
          schema: 'CardBody',
          tags: ['status:todo'],
          body: { title: 'Actor control test' },
        },
        'admin-key-123'
      )

      expect(envelope.createdBy).toBe('admin-key-123')
    })

    it('patch envelope also has createdBy and createdAt', async () => {
      const service = createRecordService()
      const envelope = await service.create({
        schema: 'CardBody',
        tags: ['status:todo'],
        body: { title: 'Patch audit test' },
      })

      const result = await service.createRecordPatch(
        envelope.body.id,
        {
          parentId: null,
          snapshotVersion: 0,
          tags: ['status:wip'],
        },
        'reviewer-key'
      )

      expect(result!.patch.createdBy).toBe('reviewer-key')
      expect(result!.patch).toHaveProperty('createdAt')
      expect(result!.patch.body).toHaveProperty('targetId')
    })

    it('get record returns envelope with audit meta', async () => {
      const service = createRecordService()
      const created = await service.create({
        schema: 'CardBody',
        tags: ['status:todo'],
        body: { title: 'Get audit test' },
      })

      const found = await service.findById(created.body.id)
      expect(found).toHaveProperty('createdBy')
      expect(found).toHaveProperty('createdAt')
      expect(found!.body.id).toBe(created.body.id)
    })

    it('list records returns envelope array with audit meta', async () => {
      const service = createRecordService()
      const created = await service.create({
        schema: 'CardBody',
        tags: ['status:todo'],
        body: { title: 'List audit test' },
      })

      const list = await service.list({})
      expect(list).toHaveLength(1)
      expect(list[0]).toHaveProperty('createdBy')
      expect(list[0]).toHaveProperty('createdAt')
      expect(list[0].body.id).toBe(created.body.id)
    })

    it('create patch returns patch envelope with audit fields', async () => {
      const service = createRecordService()
      const created = await service.create({
        schema: 'CardBody',
        tags: ['status:todo'],
        body: { title: 'Patch audit test 2' },
      })

      const result = await service.createRecordPatch(created.body.id, {
        parentId: null,
        snapshotVersion: 0,
        description: 'Audit note',
      })

      expect(result!.patch).toHaveProperty('createdBy')
      expect(result!.patch).toHaveProperty('createdAt')
      expect(result!.patch.body.description).toBe('Audit note')
    })

    it('list patches by targetId returns envelope array', async () => {
      const service = createRecordService()
      const created = await service.create({
        schema: 'CardBody',
        tags: ['status:todo'],
        body: { title: 'List patches audit test' },
      })

      await service.createRecordPatch(created.body.id, {
        parentId: null,
        snapshotVersion: 0,
        tags: ['status:wip'],
      })

      const list = await service.listPatchesByTargetId(created.body.id)
      expect(list).toHaveLength(1)
      expect(list[0]).toHaveProperty('createdBy')
      expect(list[0]).toHaveProperty('createdAt')
      expect(list[0].body.targetId).toBe(created.body.id)
    })

    it('createdAt is server-generated (not from client)', async () => {
      const service = createRecordService()
      const before = new Date()

      const envelope = await service.create({
        schema: 'CardBody',
        tags: ['status:todo'],
        body: { title: 'Server timestamp test' },
      })

      const after = new Date()
      const createdAt = new Date(envelope.createdAt)

      expect(createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime() - 1000)
      expect(createdAt.getTime()).toBeLessThanOrEqual(after.getTime() + 1000)
    })

    it('patch createdAt is server-generated and cannot be overridden by client', async () => {
      const service = createRecordService()
      const envelope = await service.create({
        schema: 'CardBody',
        tags: ['status:todo'],
        body: { title: 'Patch timestamp test' },
      })

      const before = new Date()

      const result = await service.createRecordPatch(envelope.body.id, {
        parentId: null,
        snapshotVersion: 0,
        tags: ['status:wip'],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        createdAt: '2020-01-01T00:00:00.000Z',
      } as any)

      const after = new Date()
      const patchCreatedAt = new Date(result!.patch.createdAt)

      expect(patchCreatedAt.getTime()).toBeGreaterThanOrEqual(
        before.getTime() - 1000
      )
      expect(patchCreatedAt.getTime()).toBeLessThanOrEqual(after.getTime() + 1000)

      expect(result!.patch.createdAt).not.toBe('2020-01-01T00:00:00.000Z')
    })
  })
})
