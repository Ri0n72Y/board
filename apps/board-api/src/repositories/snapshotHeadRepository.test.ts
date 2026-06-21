import { describe, expect, it } from 'vitest'
import { MemoryRecordRepository } from './recordRepository.js'
import {
  MemorySnapshotHeadRepository,
  MongoSnapshotHeadRepository,
  SnapshotHeadIntegrityError,
  type SnapshotHead,
  type StoredPatchDoc,
} from './snapshotHeadRepository.js'

const NOW = '2020-01-01T00:00:00.000Z'
const ACTOR = 'local'

function patch(
  id: string,
  targetId = 'record-1',
  parentId: string | null = null
): StoredPatchDoc {
  return {
    id,
    pid: 'CARD-1',
    schema: 'CardBody',
    targetId,
    parentId,
    tagChanges: { change: [{ namespace: 'status', from: 'status:todo', to: 'status:wip' }] },
    createdBy: ACTOR,
    createdAt: NOW,
  }
}

describe('MemorySnapshotHeadRepository', () => {
  it('returns version 0 when no head and no patches exist', async () => {
    const records = new MemoryRecordRepository()
    const snapshots = new MemorySnapshotHeadRepository(records)

    await expect(snapshots.loadSnapshotHead()).resolves.toEqual({
      kind: 'snapshotHead',
      version: 0,
      records: {},
    })
  })

  it('rebuilds head from a valid patch chain when head is missing', async () => {
    const records = new MemoryRecordRepository()
    await records.appendPatch(patch('patch-1'))
    await records.appendPatch(patch('patch-2', 'record-1', 'patch-1'))
    const snapshots = new MemorySnapshotHeadRepository(records)

    await expect(snapshots.loadSnapshotHead()).resolves.toEqual({
      kind: 'snapshotHead',
      version: 2,
      records: { 'record-1': { lastPatchId: 'patch-2' } },
    })
  })

  it('fails rebuild for multiple root patches per target', () => {
    const snapshots = new MemorySnapshotHeadRepository(
      new MemoryRecordRepository()
    )

    expect(() =>
      snapshots.rebuildSnapshotHeadFromPatches([patch('patch-1'), patch('patch-2')])
    ).toThrow(SnapshotHeadIntegrityError)
  })

  it('fails rebuild when parent does not exist', () => {
    const snapshots = new MemorySnapshotHeadRepository(
      new MemoryRecordRepository()
    )

    expect(() =>
      snapshots.rebuildSnapshotHeadFromPatches([
        patch('patch-1', 'record-1', 'missing-patch'),
      ])
    ).toThrow(SnapshotHeadIntegrityError)
  })

  it('fails rebuild when parent points to another target', () => {
    const snapshots = new MemorySnapshotHeadRepository(
      new MemoryRecordRepository()
    )

    expect(() =>
      snapshots.rebuildSnapshotHeadFromPatches([
        patch('patch-1', 'record-1', null),
        patch('patch-2', 'record-2', 'patch-1'),
      ])
    ).toThrow(SnapshotHeadIntegrityError)
  })

  it('fails rebuild when one parent has multiple children', () => {
    const snapshots = new MemorySnapshotHeadRepository(
      new MemoryRecordRepository()
    )

    expect(() =>
      snapshots.rebuildSnapshotHeadFromPatches([
        patch('patch-1', 'record-1', null),
        patch('patch-2', 'record-1', 'patch-1'),
        patch('patch-3', 'record-1', 'patch-1'),
      ])
    ).toThrow(SnapshotHeadIntegrityError)
  })

  it('appends patch and advances head atomically on success', async () => {
    const records = new MemoryRecordRepository()
    const snapshots = new MemorySnapshotHeadRepository(records)
    const root = patch('patch-1')

    await expect(
      snapshots.appendPatchAndAdvanceHead({
        targetId: 'record-1',
        patch: root,
        expectedSnapshotVersion: 0,
        expectedParentId: null,
      })
    ).resolves.toEqual({
      ok: true,
      patch: root,
      newSnapshotVersion: 1,
    })
    await expect(records.findPatchById('patch-1')).resolves.toEqual(root)
    await expect(snapshots.loadSnapshotHead()).resolves.toMatchObject({
      version: 1,
      records: { 'record-1': { lastPatchId: 'patch-1' } },
    })
  })

  it('does not insert patch on snapshot version conflict', async () => {
    const records = new MemoryRecordRepository()
    const snapshots = new MemorySnapshotHeadRepository(records)

    await snapshots.appendPatchAndAdvanceHead({
      targetId: 'record-1',
      patch: patch('patch-1'),
      expectedSnapshotVersion: 0,
      expectedParentId: null,
    })
    const result = await snapshots.appendPatchAndAdvanceHead({
      targetId: 'record-1',
      patch: patch('patch-2', 'record-1', 'patch-1'),
      expectedSnapshotVersion: 0,
      expectedParentId: 'patch-1',
    })

    expect(result).toMatchObject({ ok: false, reason: 'currentVersionMismatch' })
    await expect(records.findPatchById('patch-2')).resolves.toBeNull()
  })

  it('does not insert patch on parent mismatch', async () => {
    const records = new MemoryRecordRepository()
    const snapshots = new MemorySnapshotHeadRepository(records)

    await snapshots.appendPatchAndAdvanceHead({
      targetId: 'record-1',
      patch: patch('patch-1'),
      expectedSnapshotVersion: 0,
      expectedParentId: null,
    })
    const result = await snapshots.appendPatchAndAdvanceHead({
      targetId: 'record-1',
      patch: patch('patch-2', 'record-1', null),
      expectedSnapshotVersion: 1,
      expectedParentId: null,
    })

    expect(result).toMatchObject({ ok: false, reason: 'parentMismatch' })
    await expect(records.findPatchById('patch-2')).resolves.toBeNull()
  })
})

describe('MongoSnapshotHeadRepository transaction abort', () => {
  function testPatch(
    id = 'patch-1',
    targetId = 'record-1',
    parentId: string | null = null
  ): StoredPatchDoc {
    return {
      id,
      pid: 'CARD-1',
      schema: 'CardBody',
      targetId,
      parentId,
      tagChanges: { change: [{ namespace: 'status', from: 'status:todo', to: 'status:wip' }] },
      createdBy: ACTOR,
      createdAt: NOW,
    }
  }

  function snapshotDoc(
    version: number,
    records: Record<string, { lastPatchId: string | null }> = {}
  ): Record<string, unknown> {
    return { kind: 'snapshotHead', version, records }
  }

  function createFakeMongoTransaction(opts: {
    storedHead?: Record<string, unknown> | null
    findOneAndReplaceResult?: Record<string, unknown> | null
    existingPatches?: Record<string, unknown>[]
  } = {}) {
    let sessionAborted = false
    let sessionCommitted = false
    const recordsInsertCalls: Record<string, unknown>[] = []
    const snapshotsInsertCalls: Record<string, unknown>[] = []
    const findOneAndReplaceFilters: Record<string, unknown>[] = []

    const fakeSession = {
      withTransaction: async (cb: () => Promise<unknown>) => {
        try {
          const result = await cb()
          sessionCommitted = true
          return result
        } catch (e) {
          sessionAborted = true
          throw e
        }
      },
      endSession: async () => {},
    }

    const fakeClient = { startSession: () => fakeSession }

    const fakeRecordsCollection = {
      findOne: async (filter: any) => {
        const idFilter = filter?.$and?.[1]?.id
        if (idFilter && opts.existingPatches) {
          return (
            opts.existingPatches.find((p) => p.id === idFilter) ?? null
          )
        }
        return null
      },
      insertOne: async (doc: any) => {
        recordsInsertCalls.push(doc)
      },
      find: () => ({
        toArray: async () => opts.existingPatches ?? [],
      }),
    }

    const fakeSnapshotsCollection = {
      findOne: async () => opts.storedHead ?? null,
      insertOne: async (doc: any) => {
        snapshotsInsertCalls.push(doc)
      },
      findOneAndReplace: async (filter: any) => {
        findOneAndReplaceFilters.push(filter)
        return opts.findOneAndReplaceResult !== undefined
          ? opts.findOneAndReplaceResult
          : null
      },
    }

    const repo = new MongoSnapshotHeadRepository(
      fakeClient as any,
      fakeRecordsCollection as any,
      fakeSnapshotsCollection as any
    )

    return {
      repo,
      getSessionAborted: () => sessionAborted,
      getSessionCommitted: () => sessionCommitted,
      getRecordsInsertCalls: () => recordsInsertCalls,
      getSnapshotsInsertCalls: () => snapshotsInsertCalls,
      getFindOneAndReplaceFilters: () => findOneAndReplaceFilters,
    }
  }

  it('aborts transaction when CAS fails and does not leave orphan patch', async () => {
    const {
      repo,
      getSessionAborted,
      getSessionCommitted,
      getRecordsInsertCalls,
    } = createFakeMongoTransaction({
      storedHead: snapshotDoc(0),
      findOneAndReplaceResult: null, // CAS failure
    })

    const result = await repo.appendPatchAndAdvanceHead({
      targetId: 'record-1',
      patch: testPatch('patch-1'),
      expectedSnapshotVersion: 0,
      expectedParentId: null,
    })

    expect(result).toMatchObject({
      ok: false,
      reason: 'currentVersionMismatch',
    })
    expect(getSessionAborted()).toBe(true)
    expect(getSessionCommitted()).toBe(false)
    // Patch insert was attempted in transaction callback but rolled back
    expect(getRecordsInsertCalls()).toHaveLength(1)
  })

  it('aborts on snapshot version mismatch without committing patch', async () => {
    const { repo, getSessionAborted, getSessionCommitted } =
      createFakeMongoTransaction({
        storedHead: snapshotDoc(0),
      })

    const result = await repo.appendPatchAndAdvanceHead({
      targetId: 'record-1',
      patch: testPatch('patch-1'),
      expectedSnapshotVersion: 5, // mismatched
      expectedParentId: null,
    })

    expect(result).toMatchObject({
      ok: false,
      reason: 'currentVersionMismatch',
      currentVersion: 0,
    })
    expect(getSessionAborted()).toBe(true)
    expect(getSessionCommitted()).toBe(false)
  })

  it('aborts on parent mismatch without committing patch', async () => {
    const { repo, getSessionAborted, getSessionCommitted } =
      createFakeMongoTransaction({
        storedHead: snapshotDoc(1, {
          'record-1': { lastPatchId: 'patch-1' },
        }),
      })

    const result = await repo.appendPatchAndAdvanceHead({
      targetId: 'record-1',
      patch: testPatch('patch-2', 'record-1', null),
      expectedSnapshotVersion: 1,
      expectedParentId: null,
    })

    expect(result).toMatchObject({
      ok: false,
      reason: 'parentMismatch',
      currentParentId: 'patch-1',
    })
    expect(getSessionAborted()).toBe(true)
    expect(getSessionCommitted()).toBe(false)
  })

  it('aborts on parent patch missing', async () => {
    const { repo, getSessionAborted, getSessionCommitted } =
      createFakeMongoTransaction({
        storedHead: snapshotDoc(1, {
          'record-1': { lastPatchId: 'missing-patch' },
        }),
        existingPatches: [],
      })

    const result = await repo.appendPatchAndAdvanceHead({
      targetId: 'record-1',
      patch: testPatch('patch-2', 'record-1', 'missing-patch'),
      expectedSnapshotVersion: 1,
      expectedParentId: 'missing-patch',
    })

    expect(result).toMatchObject({
      ok: false,
      reason: 'parentPatchMissing',
      parentId: 'missing-patch',
    })
    expect(getSessionAborted()).toBe(true)
    expect(getSessionCommitted()).toBe(false)
  })

  it('aborts on parent patch target mismatch', async () => {
    const { repo, getSessionAborted, getSessionCommitted } =
      createFakeMongoTransaction({
        storedHead: snapshotDoc(1, {
          'record-1': { lastPatchId: 'patch-1' },
        }),
        existingPatches: [{ id: 'patch-1', targetId: 'record-2' }],
      })

    const result = await repo.appendPatchAndAdvanceHead({
      targetId: 'record-1',
      patch: testPatch('patch-2', 'record-1', 'patch-1'),
      expectedSnapshotVersion: 1,
      expectedParentId: 'patch-1',
    })

    expect(result).toMatchObject({
      ok: false,
      reason: 'parentPatchTargetMismatch',
      parentId: 'patch-1',
      parentTargetId: 'record-2',
    })
    expect(getSessionAborted()).toBe(true)
    expect(getSessionCommitted()).toBe(false)
  })

  it('does not initialize head when append fails in transaction', async () => {
    const {
      repo,
      getSessionAborted,
      getSessionCommitted,
      getSnapshotsInsertCalls,
    } = createFakeMongoTransaction({
      storedHead: null,
      existingPatches: [],
    })

    const result = await repo.appendPatchAndAdvanceHead({
      targetId: 'record-1',
      patch: testPatch('patch-1'),
      expectedSnapshotVersion: 5,
      expectedParentId: null,
    })

    expect(result).toMatchObject({
      ok: false,
      reason: 'currentVersionMismatch',
      currentVersion: 0,
    })
    expect(getSessionAborted()).toBe(true)
    expect(getSessionCommitted()).toBe(false)
    // Initial head insert was attempted but must be rolled back
    expect(getSnapshotsInsertCalls()).toHaveLength(1)
  })

  it('commits transaction on success path', async () => {
    const { repo, getSessionAborted, getSessionCommitted } =
      createFakeMongoTransaction({
        storedHead: snapshotDoc(0),
        findOneAndReplaceResult: snapshotDoc(0), // CAS success
      })

    const result = await repo.appendPatchAndAdvanceHead({
      targetId: 'record-1',
      patch: testPatch('patch-1'),
      expectedSnapshotVersion: 0,
      expectedParentId: null,
    })

    expect(result).toMatchObject({ ok: true, newSnapshotVersion: 1 })
    expect(getSessionCommitted()).toBe(true)
    expect(getSessionAborted()).toBe(false)
  })

  it('aborts on parent mismatch when head is rebuilt from existing patches', async () => {
    const { repo, getSessionAborted, getSessionCommitted } =
      createFakeMongoTransaction({
        storedHead: null,
        existingPatches: [
          { id: 'patch-1', targetId: 'record-1', parentId: null },
          { id: 'patch-2', targetId: 'record-1', parentId: 'patch-1' },
        ],
      })

    const result = await repo.appendPatchAndAdvanceHead({
      targetId: 'record-1',
      patch: testPatch('patch-3', 'record-1', null),
      expectedSnapshotVersion: 2,
      expectedParentId: null,
    })

    expect(result).toMatchObject({
      ok: false,
      reason: 'parentMismatch',
      currentParentId: 'patch-2',
    })
    expect(getSessionAborted()).toBe(true)
    expect(getSessionCommitted()).toBe(false)
  })

  it('CAS filter does not include records object', async () => {
    const { repo, getSessionCommitted, getFindOneAndReplaceFilters } =
      createFakeMongoTransaction({
        storedHead: snapshotDoc(0),
        findOneAndReplaceResult: snapshotDoc(0), // CAS success
      })

    await repo.appendPatchAndAdvanceHead({
      targetId: 'record-1',
      patch: testPatch('patch-1'),
      expectedSnapshotVersion: 0,
      expectedParentId: null,
    })

    expect(getSessionCommitted()).toBe(true)
    // The filter used for findOneAndReplace must NOT contain records
    const filter = getFindOneAndReplaceFilters()[0]
    expect(filter).toHaveProperty('kind', 'snapshotHead')
    expect(filter).toHaveProperty('version', 0)
    expect(filter).not.toHaveProperty('records')
  })
})

describe('MemorySnapshotHeadRepository concurrent append lock', () => {
  it('serializes concurrent appends and only lets one succeed on same version', async () => {
    const records = new MemoryRecordRepository()
    const snapshots = new MemorySnapshotHeadRepository(records)

    // Fire two concurrent appends with same version/parentId
    const results = await Promise.all([
      snapshots.appendPatchAndAdvanceHead({
        targetId: 'record-1',
        patch: patch('patch-a', 'record-1', null),
        expectedSnapshotVersion: 0,
        expectedParentId: null,
      }),
      snapshots.appendPatchAndAdvanceHead({
        targetId: 'record-1',
        patch: patch('patch-b', 'record-1', null),
        expectedSnapshotVersion: 0,
        expectedParentId: null,
      }),
    ])

    // One must succeed
    const ok = results.filter((r) => r.ok === true)
    const conflict = results.filter((r) => r.ok === false)
    expect(ok).toHaveLength(1)
    expect(conflict).toHaveLength(1)
    expect(conflict[0]).toMatchObject({
      ok: false,
      reason: 'currentVersionMismatch',
    })

    // Only one patch exists in the records collection
    const allPatches = await records.listPatches()
    expect(allPatches).toHaveLength(1)

    // Snapshot head version should be 1
    const head = await snapshots.loadSnapshotHead()
    expect(head.version).toBe(1)
    expect(head.records['record-1'].lastPatchId).toBe(
      (ok[0] as Extract<typeof ok[0], { ok: true }>).patch.id
    )
  })

  it('allows sequential chain append without corruption under lock', async () => {
    const records = new MemoryRecordRepository()
    const snapshots = new MemorySnapshotHeadRepository(records)

    // First patch
    const r1 = await snapshots.appendPatchAndAdvanceHead({
      targetId: 'record-1',
      patch: patch('patch-1', 'record-1', null),
      expectedSnapshotVersion: 0,
      expectedParentId: null,
    })
    expect(r1).toMatchObject({ ok: true, newSnapshotVersion: 1 })

    // Second patch chains on first
    const r2 = await snapshots.appendPatchAndAdvanceHead({
      targetId: 'record-1',
      patch: patch('patch-2', 'record-1', 'patch-1'),
      expectedSnapshotVersion: 1,
      expectedParentId: 'patch-1',
    })
    expect(r2).toMatchObject({ ok: true, newSnapshotVersion: 2 })

    // Snapshot head version is 2
    const head = await snapshots.loadSnapshotHead()
    expect(head.version).toBe(2)
    expect(head.records['record-1'].lastPatchId).toBe('patch-2')

    // Two patch facts exist
    const allPatches = await records.listPatches()
    expect(allPatches).toHaveLength(2)

    // Parent chain is correct
    const p1 = await records.findPatchById('patch-1')
    const p2 = await records.findPatchById('patch-2')
    expect(p1!.parentId).toBeNull()
    expect(p2!.parentId).toBe('patch-1')
    expect(p2!.targetId).toBe('record-1')
  })
})
