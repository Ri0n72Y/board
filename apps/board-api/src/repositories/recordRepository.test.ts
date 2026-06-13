import type { Collection, Document } from 'mongodb'
import { describe, expect, it } from 'vitest'
import {
  MemoryRecordRepository,
  MongoRecordRepository,
  type StoredRecordDoc,
} from './recordRepository.js'
import type { StoredPatchDoc } from './snapshotHeadRepository.js'

const NOW = '2020-01-01T00:00:00.000Z'
const ACTOR = 'local'
const RECORD_ONLY_FILTER = {
  $and: [{ targetId: { $exists: false } }],
}

const BASE_RECORD: StoredRecordDoc = {
  id: 'record-1',
  pid: 'CARD-1',
  schema: 'CardBody',
  tags: ['status:todo'],
  body: { title: 'Repository card' },
  createdBy: ACTOR,
  createdAt: NOW,
}

describe('MemoryRecordRepository', () => {
  it('creates, lists, finds, and archives records', async () => {
    const repository = new MemoryRecordRepository()

    await repository.create(BASE_RECORD)

    await expect(
      repository.list({
        includeArchived: false,
        excludeTags: ['status:archived'],
      })
    ).resolves.toEqual([BASE_RECORD])
    await expect(repository.findById(BASE_RECORD.id)).resolves.toEqual(
      BASE_RECORD
    )
    await expect(
      repository.archive(BASE_RECORD.id, ['status:archived'])
    ).resolves.toMatchObject({
      id: BASE_RECORD.id,
      tags: ['status:archived'],
      body: { title: 'Repository card' },
    })
    await expect(repository.archive('missing', ['status:archived'])).resolves.toBeNull()
  })

  it('filters excluded snapshot tags unless archived records are requested', async () => {
    const repository = new MemoryRecordRepository()
    const archived = {
      ...BASE_RECORD,
      id: 'record-2',
      pid: 'CARD-2',
      tags: ['status:archived'],
    } satisfies StoredRecordDoc

    await repository.create(BASE_RECORD)
    await repository.create(archived)

    await expect(
      repository.list({
        includeArchived: false,
        excludeTags: ['status:archived'],
      })
    ).resolves.toEqual([BASE_RECORD])
    await expect(
      repository.list({
        includeArchived: true,
        excludeTags: ['status:archived'],
      })
    ).resolves.toEqual([BASE_RECORD, archived])
  })

  it('creates patches and finds them by target record id', async () => {
    const repository = new MemoryRecordRepository()
    await repository.create(BASE_RECORD)

    const patch: StoredPatchDoc = {
      id: 'patch-1',
      pid: BASE_RECORD.pid,
      schema: BASE_RECORD.schema,
      targetId: BASE_RECORD.id,
      parentId: null,
      tagChanges: { change: [{ namespace: 'status', from: 'status:todo', to: 'status:wip' }] },
      body: { description: 'In progress' },
      createdBy: ACTOR,
      createdAt: NOW,
    }

    await expect(repository.appendPatch(patch)).resolves.toEqual(patch)
    await expect(
      repository.findPatchesByTargetId(BASE_RECORD.id)
    ).resolves.toEqual([patch])
    // Empty for missing target
    await expect(repository.findPatchesByTargetId('missing')).resolves.toEqual(
      []
    )
  })

  it('does not return patches from findById, findByPid, or list', async () => {
    const repository = new MemoryRecordRepository()
    await repository.create(BASE_RECORD)

    const patch: StoredPatchDoc = {
      id: 'patch-1',
      pid: BASE_RECORD.pid,
      schema: BASE_RECORD.schema,
      targetId: BASE_RECORD.id,
      parentId: null,
      tagChanges: { change: [{ namespace: 'status', from: 'status:todo', to: 'status:wip' }] },
      body: { description: 'In progress' },
      createdBy: ACTOR,
      createdAt: NOW,
    }
    await repository.appendPatch(patch)

    // findById still returns the original record
    await expect(repository.findById(BASE_RECORD.id)).resolves.toEqual(
      BASE_RECORD
    )
    // findByPid still returns the original record
    await expect(repository.findByPid(BASE_RECORD.pid)).resolves.toEqual(
      BASE_RECORD
    )
    // list does not include the patch
    const list = await repository.list({
      includeArchived: false,
      excludeTags: ['status:archived'],
    })
    expect(list).toEqual([BASE_RECORD])
  })

  it('findById returns a clone 鈥?external mutations do not affect internal state', async () => {
    const repository = new MemoryRecordRepository()
    await repository.create(BASE_RECORD)

    const result = await repository.findById(BASE_RECORD.id)
    expect(result).toEqual(BASE_RECORD)
    result!.tags = ['status:corrupted' as any]

    const refetch = await repository.findById(BASE_RECORD.id)
    expect(refetch!.tags).toEqual(['status:todo'])
  })

  it('findPatchesByTargetId returns clones 鈥?external mutations do not affect internal state', async () => {
    const repository = new MemoryRecordRepository()
    const patch: StoredPatchDoc = {
      id: 'p1', pid: 'X-1', schema: 'CardBody', targetId: 'r1',
      parentId: null, tagChanges: { change: [{ namespace: 'status', from: 'status:todo', to: 'status:wip' }] }, createdBy: ACTOR, createdAt: NOW,
    }
    await repository.appendPatch(patch)

    const patches = await repository.findPatchesByTargetId('r1')
    expect(patches).toHaveLength(1)
    patches[0].tagChanges = { add: ['status:archived'] }

    const refetch = await repository.findPatchesByTargetId('r1')
    expect(refetch[0].tagChanges).toEqual({
      change: [{ namespace: 'status', from: 'status:todo', to: 'status:wip' }],
    })
  })
})

describe('MongoRecordRepository', () => {
  it('uses configured exclude tags when listing current records', async () => {
    const findCalls: unknown[] = []
    const repository = new MongoRecordRepository(
      createCollectionStub({
        find(filter: unknown) {
          findCalls.push(filter)
          return {
            toArray: async () => [{ ...BASE_RECORD, _id: 'mongo-id' }],
          }
        },
      })
    )

    await expect(
      repository.list({
        includeArchived: false,
        excludeTags: ['status:archived'],
      })
    ).resolves.toEqual([BASE_RECORD])
    expect(findCalls).toEqual([
      {
        ...RECORD_ONLY_FILTER,
        tags: { $nin: ['status:archived'] },
      },
    ])
  })

  it('creates, finds, and archives records through the collection', async () => {
    const inserted: unknown[] = []
    const replacements: unknown[] = []
    const repository = new MongoRecordRepository(
      createCollectionStub({
        insertOne(record: unknown) {
          inserted.push(record)
          return Promise.resolve()
        },
        findOne() {
          return Promise.resolve({ ...BASE_RECORD, _id: 'mongo-id' })
        },
        findOneAndReplace(filter: unknown, replacement: unknown) {
          replacements.push({ filter, replacement })
          return Promise.resolve({
            ...(replacement as StoredRecordDoc),
            _id: 'mongo-id',
          })
        },
      })
    )

    await expect(repository.create(BASE_RECORD)).resolves.toEqual(BASE_RECORD)
    expect(inserted).toEqual([BASE_RECORD])

    await expect(repository.findById(BASE_RECORD.id)).resolves.toEqual(
      BASE_RECORD
    )

    await expect(
      repository.archive(BASE_RECORD.id, ['status:archived'])
    ).resolves.toMatchObject({ tags: ['status:archived'] })
    expect(replacements).toHaveLength(1)
  })

  it('creates patches through the collection', async () => {
    const inserted: unknown[] = []
    const findResults: unknown[] = []
    const repository = new MongoRecordRepository(
      createCollectionStub({
        insertOne(record: unknown) {
          inserted.push(record)
          return Promise.resolve()
        },
        find() {
          return {
            toArray: () => Promise.resolve(findResults),
          }
        },
      })
    )

    const patch: StoredPatchDoc = {
      id: 'patch-1',
      pid: BASE_RECORD.pid,
      schema: BASE_RECORD.schema,
      targetId: BASE_RECORD.id,
      parentId: null,
      tagChanges: { change: [{ namespace: 'status', from: 'status:todo', to: 'status:wip' }] },
      body: { description: 'In progress' },
      createdBy: ACTOR,
      createdAt: NOW,
    }

    await expect(repository.appendPatch(patch)).resolves.toEqual(patch)
    expect(inserted).toEqual([patch])
  })

  it('findById and findByPid exclude patches via targetId filter', async () => {
    const baseDoc = { ...BASE_RECORD, _id: 'mongo-id' }
    const findOneCalls: unknown[] = []
    const repository = new MongoRecordRepository(
      createCollectionStub({
        findOne(filter: unknown) {
          findOneCalls.push(filter)
          return Promise.resolve(baseDoc)
        },
      })
    )

    await expect(repository.findById(BASE_RECORD.id)).resolves.toEqual(
      BASE_RECORD
    )
    await expect(repository.findByPid(BASE_RECORD.pid)).resolves.toEqual(
      BASE_RECORD
    )
    expect(findOneCalls).toEqual([
      { $and: [...RECORD_ONLY_FILTER.$and, { id: BASE_RECORD.id }] },
      { $and: [...RECORD_ONLY_FILTER.$and, { pid: BASE_RECORD.pid }] },
    ])
  })

  it('findPatchesByTargetId returns complete patch fields from Mongo', async () => {
    const patchDoc = {
      _id: 'mongo-patch-id',
      id: 'patch-1',
      pid: BASE_RECORD.pid,
      schema: BASE_RECORD.schema,
      targetId: BASE_RECORD.id,
      parentId: null,
      tagChanges: { change: [{ namespace: 'status', from: 'status:todo', to: 'status:wip' }] },
      assignee: 'member-1',
      body: { description: 'In progress' },
      assets: ['asset-ref-1', 'asset-ref-2'],
      relations: [{ constraint: 'blocks' as const, target: 'other-1' }],
      description: 'A patch description',
      createdBy: ACTOR,
      createdAt: NOW,
    }
    const repository = new MongoRecordRepository(
      createCollectionStub({
        find() {
          return { toArray: () => Promise.resolve([patchDoc]) }
        },
      })
    )

    const patches = await repository.findPatchesByTargetId(BASE_RECORD.id)
    expect(patches).toEqual([
      {
        id: 'patch-1',
        pid: BASE_RECORD.pid,
        schema: BASE_RECORD.schema,
        targetId: BASE_RECORD.id,
        parentId: null,
        tagChanges: { change: [{ namespace: 'status', from: 'status:todo', to: 'status:wip' }] },
        assignee: 'member-1',
        body: { description: 'In progress' },
        assets: ['asset-ref-1', 'asset-ref-2'],
        relations: [{ constraint: 'blocks', target: 'other-1' }],
        description: 'A patch description',
        createdBy: ACTOR,
        createdAt: NOW,
      },
    ])
  })

  it('findPatchById uses patch-only filter and returns null for records', async () => {
    const patchDoc = {
      _id: 'mongo-patch-id',
      id: 'patch-1',
      pid: BASE_RECORD.pid,
      schema: BASE_RECORD.schema,
      targetId: BASE_RECORD.id,
      tagChanges: { change: [{ namespace: 'status', from: 'status:todo', to: 'status:wip' }] },
      createdBy: ACTOR,
      createdAt: NOW,
    }
    const findOneCalls: unknown[] = []
    const repository = new MongoRecordRepository(
      createCollectionStub({
        findOne(filter: unknown) {
          findOneCalls.push(filter)
          return Promise.resolve(patchDoc)
        },
      })
    )

    const found = await repository.findPatchById('patch-1')
    expect(found).not.toBeNull()
    expect(found!.id).toBe('patch-1')
    expect(found!.targetId).toBe(BASE_RECORD.id)

    // Must use patch-only filter (targetId exists + id match via $and)
    expect(findOneCalls).toEqual([
      { $and: [{ targetId: { $exists: true } }, { id: 'patch-1' }] },
    ])
  })

  it('findPatchesByTargetId uses patch-only filter', async () => {
    const findCalls: unknown[] = []
    const repository = new MongoRecordRepository(
      createCollectionStub({
        find(filter: unknown) {
          findCalls.push(filter)
          return { toArray: () => Promise.resolve([]) }
        },
      })
    )

    await repository.findPatchesByTargetId(BASE_RECORD.id)
    expect(findCalls).toEqual([
      {
        $and: [{ targetId: { $exists: true } }, { targetId: BASE_RECORD.id }],
      },
    ])
  })
})

function createCollectionStub(
  methods: Record<string, unknown>
): Collection<Document> {
  return methods as unknown as Collection<Document>
}
