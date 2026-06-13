import { describe, expect, it } from 'vitest'
import {
  CurrentHeadConflictError,
  RecordService,
  RecordValidationError,
} from '../recordService.js'
import { MemoryRecordRepository } from '../../repositories/recordRepository.js'
import { MemorySnapshotHeadRepository } from '../../repositories/snapshotHeadRepository.js'
import {
  cloneDefaultBoardConfig,
  createRecordService,
} from './recordTestUtils.js'

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
        tagChanges: { change: [{ namespace: 'status', from: 'status:todo', to: 'status:wip' }] },
        body: { description: 'Patched description' },
        description: 'Moving to wip',
      })

      expect(result).not.toBeNull()
      expect(result!.patch).toHaveProperty('createdBy')
      expect(result!.patch).toHaveProperty('createdAt')
      expect(result!.patch.body).toMatchObject({
        targetId: record.id,
        parentId: null,
        tagChanges: { change: [{ namespace: 'status', from: 'status:todo', to: 'status:wip' }] },
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
          tagChanges: { change: [{ namespace: 'status', from: 'status:todo', to: 'status:wip' }] },
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
        tagChanges: { change: [{ namespace: 'status', from: 'status:todo', to: 'status:wip' }] },
      })

      const list = await service.list({})
      expect(list).toHaveLength(1)
      expect(list[0].body.id).toBe(envelope.body.id)

      const found = await service.findById(envelope.body.id)
      expect(found).not.toBeNull()
      expect(found!.body.id).toBe(envelope.body.id)
      expect(found!.body.tags).toEqual(['status:wip'])
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
      const head = await service.getRecordCurrentHead(envelope.body.id)
      expect(head).not.toBeNull()

      await expect(
        service.createRecordPatch(envelope.body.id, {
          parentId: head!.lastPatchId,
          currentVersion: head!.currentVersion,
          tagChanges: { change: [{ namespace: 'status', from: 'status:todo', to: 'status:wip' }] },
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
          tagChanges: {
            add: ['status:not-configured'],
          },
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
        'Patch must contain at least one change: body, tagChanges, assignee, assets, relations, or description'
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

    it('rejects full tags array patch content', async () => {
      const service = createRecordService()
      const envelope = await service.create({
        schema: 'CardBody',
        tags: ['status:todo'],
        body: { title: 'Tags clear test' },
      })

      await expect(
        service.createRecordPatch(envelope.body.id, {
          parentId: null,
          snapshotVersion: 0,
          tags: [],
        } as any)
      ).rejects.toThrow(
        'tags must not be provided in patch records; use tagChanges instead'
      )
    })
  })

  describe('tagChanges semantics', () => {
    it('persists priority change as tagChanges.change without full tags', async () => {
      const service = createConfiguredTagService()
      const envelope = await service.create({
        schema: 'CardBody',
        tags: ['status:todo', 'priority:p3'],
        body: { title: 'Priority change' },
      })

      const result = await service.createRecordPatch(envelope.body.id, {
        parentId: null,
        snapshotVersion: 0,
        tagChanges: {
          change: [
            { namespace: 'priority', from: 'priority:p3', to: 'priority:p0' },
          ],
        },
      })

      expect(result!.patch.body.tagChanges).toEqual({
        change: [
          { namespace: 'priority', from: 'priority:p3', to: 'priority:p0' },
        ],
      })
      expect(result!.patch.body).not.toHaveProperty('tags')
    })

    it('persists epic change as tagChanges.change', async () => {
      const service = createConfiguredTagService()
      const envelope = await service.create({
        schema: 'CardBody',
        tags: ['status:todo', 'epic:1'],
        body: { title: 'Epic change' },
      })

      const result = await service.createRecordPatch(envelope.body.id, {
        parentId: null,
        snapshotVersion: 0,
        tagChanges: {
          change: [{ namespace: 'epic', from: 'epic:1', to: 'epic:2' }],
        },
      })

      expect(result!.patch.body.tagChanges).toEqual({
        change: [{ namespace: 'epic', from: 'epic:1', to: 'epic:2' }],
      })
    })

    it('persists scope add and remove as tagChanges.add/remove', async () => {
      const service = createConfiguredTagService()
      const envelope = await service.create({
        schema: 'CardBody',
        tags: ['status:todo', 'scope:shop'],
        body: { title: 'Scope change' },
      })

      const result = await service.createRecordPatch(envelope.body.id, {
        parentId: null,
        snapshotVersion: 0,
        tagChanges: {
          add: ['scope:combat'],
          remove: ['scope:shop'],
        },
      })

      expect(result!.patch.body.tagChanges).toEqual({
        add: ['scope:combat'],
        remove: ['scope:shop'],
      })
    })

    it('rejects unknown add tag epic:999', async () => {
      const service = createConfiguredTagService()
      const envelope = await service.create({
        schema: 'CardBody',
        tags: ['status:todo'],
        body: { title: 'Unknown add' },
      })

      await expect(
        service.createRecordPatch(envelope.body.id, {
          parentId: null,
          snapshotVersion: 0,
          tagChanges: { add: ['epic:999'] },
        })
      ).rejects.toThrow('Unsupported tag: epic:999')
    })

    it('rejects unknown change target status:unknown', async () => {
      const service = createConfiguredTagService()
      const envelope = await service.create({
        schema: 'CardBody',
        tags: ['status:todo'],
        body: { title: 'Unknown status' },
      })

      await expect(
        service.createRecordPatch(envelope.body.id, {
          parentId: null,
          snapshotVersion: 0,
          tagChanges: {
            change: [
              { namespace: 'status', from: 'status:todo', to: 'status:unknown' },
            ],
          },
        })
      ).rejects.toThrow('Unsupported tag: status:unknown')
    })

    it('rejects tagChanges conflicts with a clear error', async () => {
      const service = createConfiguredTagService()
      const envelope = await service.create({
        schema: 'CardBody',
        tags: ['status:todo', 'scope:shop'],
        body: { title: 'Conflict' },
      })

      await expect(
        service.createRecordPatch(envelope.body.id, {
          parentId: null,
          snapshotVersion: 0,
          tagChanges: {
            add: ['scope:shop'],
            remove: ['scope:shop'],
          },
        })
      ).rejects.toThrow(
        'Tag change conflict: scope:shop appears in both add and remove'
      )
    })
  })

  describe('snapshot head / parent chain', () => {
    it('first patch has parentId: null and updates current head', async () => {
      const service = createRecordService()
      const envelope = await service.create({
        schema: 'CardBody',
        tags: ['status:todo'],
        body: { title: 'Parent null test' },
      })

      const result = await service.createRecordPatch(envelope.body.id, {
        parentId: null,
        snapshotVersion: 0,
        tagChanges: { change: [{ namespace: 'status', from: 'status:todo', to: 'status:wip' }] },
      })

      expect(result).not.toBeNull()
      expect(result!.patch.body.parentId).toBeNull()

      const head = await service.getRecordCurrentHead(envelope.body.id)
      expect(head).toMatchObject({
        recordId: envelope.body.id,
        exists: true,
        currentVersion: 2,
        lastPatchId: result!.patch.body.id,
      })
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
        tagChanges: { change: [{ namespace: 'status', from: 'status:todo', to: 'status:wip' }] },
      })

      const r2 = await service.createRecordPatch(envelope.body.id, {
        parentId: r1!.patch.body.id,
        snapshotVersion: 1,
        body: { description: 'Second' },
      })

      expect(r2).not.toBeNull()
      expect(r2!.patch.body.parentId).toBe(r1!.patch.body.id)

      const head = await service.getRecordCurrentHead(envelope.body.id)
      expect(head).toMatchObject({
        recordId: envelope.body.id,
        exists: true,
        currentVersion: 3,
        lastPatchId: r2!.patch.body.id,
      })
    })

    it('throws CurrentHeadConflictError when currentVersion mismatches', async () => {
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
          tagChanges: { change: [{ namespace: 'status', from: 'status:todo', to: 'status:wip' }] },
        })
      ).rejects.toThrow(CurrentHeadConflictError)

      await expect(
        service.createRecordPatch(envelope.body.id, {
          parentId: null,
          snapshotVersion: 5,
          tagChanges: { change: [{ namespace: 'status', from: 'status:todo', to: 'status:wip' }] },
        })
      ).rejects.toThrow('Current version mismatch')
    })

    it('throws CurrentHeadConflictError when parentId mismatches lastPatchId', async () => {
      const service = createRecordService()
      const envelope = await service.create({
        schema: 'CardBody',
        tags: ['status:todo'],
        body: { title: 'Parent conflict test' },
      })

      await service.createRecordPatch(envelope.body.id, {
        parentId: null,
        snapshotVersion: 0,
        tagChanges: { change: [{ namespace: 'status', from: 'status:todo', to: 'status:wip' }] },
      })

      await expect(
        service.createRecordPatch(envelope.body.id, {
          parentId: null,
          snapshotVersion: 1,
          tagChanges: { change: [{ namespace: 'status', from: 'status:todo', to: 'status:done' }] },
        })
      ).rejects.toThrow(CurrentHeadConflictError)

      await expect(
        service.createRecordPatch(envelope.body.id, {
          parentId: null,
          snapshotVersion: 1,
          tagChanges: { change: [{ namespace: 'status', from: 'status:todo', to: 'status:done' }] },
        })
      ).rejects.toThrow('Parent patch mismatch')
    })

    it('treats a non-head parentId as a current-head conflict even when missing', async () => {
      const service = createRecordService()
      const envelope = await service.create({
        schema: 'CardBody',
        tags: ['status:todo'],
        body: { title: 'Missing parent conflict test' },
      })

      await service.createRecordPatch(envelope.body.id, {
        parentId: null,
        snapshotVersion: 0,
        tagChanges: { change: [{ namespace: 'status', from: 'status:todo', to: 'status:wip' }] },
      })

      await expect(
        service.createRecordPatch(envelope.body.id, {
          parentId: 'missing-patch-id',
          snapshotVersion: 1,
          tagChanges: { change: [{ namespace: 'status', from: 'status:todo', to: 'status:done' }] },
        })
      ).rejects.toThrow(CurrentHeadConflictError)

      await expect(
        service.createRecordPatch(envelope.body.id, {
          parentId: 'missing-patch-id',
          snapshotVersion: 1,
          tagChanges: { change: [{ namespace: 'status', from: 'status:todo', to: 'status:done' }] },
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
        tagChanges: { change: [{ namespace: 'status', from: 'status:todo', to: 'status:wip' }] },
      })

      expect(result!.patch.body).not.toHaveProperty('snapshotVersion')

      const found = await service.findPatchById(result!.patch.body.id)
      expect(found!.body).not.toHaveProperty('snapshotVersion')
    })

    it('atomically rejects concurrent patches with the same parent and currentVersion', async () => {
      const service = createRecordService()
      const envelope = await service.create({
        schema: 'CardBody',
        tags: ['status:todo'],
        body: { title: 'Concurrent patch test' },
      })
      const head = await service.getRecordCurrentHead(envelope.body.id)
      expect(head).not.toBeNull()

      const submissions = await Promise.allSettled([
        service.createRecordPatch(envelope.body.id, {
          parentId: head!.lastPatchId,
          currentVersion: head!.currentVersion,
          body: { description: 'First concurrent patch' },
        }),
        service.createRecordPatch(envelope.body.id, {
          parentId: head!.lastPatchId,
          currentVersion: head!.currentVersion,
          body: { content: 'Second concurrent patch' },
        }),
      ])

      const fulfilled = submissions.filter(
        (result): result is PromiseFulfilledResult<NonNullable<Awaited<ReturnType<RecordService['createRecordPatch']>>>> =>
          result.status === 'fulfilled' && result.value !== null
      )
      const rejected = submissions.filter(
        (result): result is PromiseRejectedResult => result.status === 'rejected'
      )
      expect(fulfilled).toHaveLength(1)
      expect(rejected).toHaveLength(1)
      expect(rejected[0].reason).toBeInstanceOf(CurrentHeadConflictError)

      const patches = await service.listPatchesByTargetId(envelope.body.id)
      expect(patches).toHaveLength(1)
      expect(patches[0].body.id).toBe(fulfilled[0].value.patch.body.id)

      const history = await service.getRecordHistory(envelope.body.id)
      expect(history!.status).toBe('complete')
      expect(history!.patches).toHaveLength(1)
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
        tagChanges: { change: [{ namespace: 'status', from: 'status:todo', to: 'status:wip' }] },
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
        tagChanges: { change: [{ namespace: 'status', from: 'status:todo', to: 'status:wip' }] },
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
          tagChanges: { change: [{ namespace: 'status', from: 'status:todo', to: 'status:wip' }] },
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
        tagChanges: { change: [{ namespace: 'status', from: 'status:todo', to: 'status:wip' }] },
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
        tagChanges: { change: [{ namespace: 'status', from: 'status:todo', to: 'status:wip' }] },
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

function createConfiguredTagService(): RecordService {
  const repository = new MemoryRecordRepository()
  const config = cloneDefaultBoardConfig()
  config.tags.status.custom = [
    { id: 'status:doing', displayName: 'doing' },
  ]
  config.tags.priority.custom = [
    { id: 'priority:p0', displayName: 'P0' },
    { id: 'priority:p3', displayName: 'P3' },
  ]
  config.tags.custom = [
    { id: 'epic:1', displayName: 'Epic 1' },
    { id: 'epic:2', displayName: 'Epic 2' },
    { id: 'scope:combat', displayName: 'Combat' },
    { id: 'scope:shop', displayName: 'Shop' },
  ]
  return new RecordService(
    repository,
    new MemorySnapshotHeadRepository(repository),
    config
  )
}
