/**
 * Mongo integration smoke test.
 *
 * **Disabled by default.** Set RUN_MONGO_SMOKE=true to enable.
 *
 * Requires a running MongoDB at the URI specified by MONGODB_URI
 * (defaults to mongodb://localhost:27017).
 *
 * Uses a dedicated test database that is cleaned before and after each run.
 * The database name MUST contain "smoke" or "test" 鈥?refuses to run otherwise.
 */
import { Hono } from 'hono'
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { type MongoClient, type Collection, type Document } from 'mongodb'
import { loadApiEnv } from './config/env.js'
import { createApiServices } from './services/index.js'
import { mountApiRoutes } from './routes/index.js'
import { ok } from './http/responses.js'
import type { SnapshotHeadRepository } from './repositories/snapshotHeadRepository.js'
import type { StoredPatchDoc } from './repositories/snapshotHeadRepository.js'

// 鈹€鈹€鈹€ Gating 鈹€鈹€鈹€

const RUN_SMOKE = process.env.RUN_MONGO_SMOKE === 'true'

// We must still export a valid test suite for vitest; skipped describe
// on the top level would still register. We use a conditional top-level
// describe that either contains the real suite or a single skipped test.

const MONGO_URI = process.env.MONGODB_URI ?? 'mongodb://localhost:27017'
const TEST_DB = `labour_board_smoke_${Date.now()}`

function assertSafeDbName(name: string): void {
  if (!name.includes('smoke') && !name.includes('test')) {
    throw new Error(
      `Refusing to run destructive Mongo smoke on database "${name}". ` +
        `Database name must contain "smoke" or "test".`
    )
  }
}

// 鈹€鈹€鈹€ Helpers 鈹€鈹€鈹€

let _client: MongoClient | null = null

async function getClient(): Promise<MongoClient> {
  if (!_client) {
    // Import mongodb directly to avoid the singleton cache in db/mongo.ts
    const { MongoClient } = await import('mongodb')
    _client = new MongoClient(MONGO_URI)
    await _client.connect()
  }
  return _client
}

async function createSmokeApp(): Promise<{
  app: Hono
  snapshotHeadRepository: SnapshotHeadRepository
}> {
  assertSafeDbName(TEST_DB)

  const env = loadApiEnv({
    MONGODB_URI: MONGO_URI,
    MONGODB_DB: TEST_DB,
    BOARD_CONFIG_OPTIONAL: 'true',
  })

  const services = await createApiServices(env)
  const app = new Hono()
  app.get('/health', (c) => c.json(ok({ status: 'ok' })))
  mountApiRoutes(app, services)
  return { app, snapshotHeadRepository: services.snapshotHeadRepository }
}

async function cleanDatabase(): Promise<void> {
  assertSafeDbName(TEST_DB)
  const client = await getClient()
  const db = client.db(TEST_DB)
  const collections = await db.listCollections().toArray()
  for (const col of collections) {
    await db.dropCollection(col.name)
  }
}

async function dropDatabase(): Promise<void> {
  assertSafeDbName(TEST_DB)
  const client = await getClient()
  await client.db(TEST_DB).dropDatabase()
}

// 鈹€鈹€鈹€ Test suite 鈹€鈹€鈹€

describe('Mongo smoke', () => {
  // Gate the entire suite
  if (!RUN_SMOKE) {
    it.skip('Mongo smoke disabled 鈥?set RUN_MONGO_SMOKE=true to enable', () => {})
    return
  }

  beforeAll(async () => {
    assertSafeDbName(TEST_DB)
  }, 15000)

  beforeEach(async () => {
    await cleanDatabase()
  }, 15000)

  afterAll(async () => {
    await dropDatabase()
    if (_client) {
      await _client.close()
      _client = null
    }
  }, 15000)

  // 鈹€鈹€ 1. Health check + board current route mounted 鈹€鈹€

  it('GET /health returns 200', async () => {
    const { app } = await createSmokeApp()
    const res = await app.request('/health')
    expect(res.status).toBe(200)
    const payload = await res.json()
    expect(payload.ok).toBe(true)
  })

  it('GET /api/v0/board/current returns empty projection', async () => {
    const { app } = await createSmokeApp()
    const res = await app.request('/api/v0/board/current')
    expect(res.status).toBe(200)

    const payload = await res.json()
    expect(payload.ok).toBe(true)
    expect(payload.data.snapshotHeadVersion).toBe(0)
    expect(payload.data.records).toEqual([])
    expect(payload.data.summary.projectionStatus).toBe('empty')
  })

  // 鈹€鈹€ 2. Record 鈫?patch 鈫?board current 鈹€鈹€

  it('record 鈫?patch 鈫?board current shows replayed state', async () => {
    const { app } = await createSmokeApp()

    // Create record
    const createRes = await app.request('/api/v0/records', {
      method: 'POST',
      body: JSON.stringify({
        schema: 'CardBody',
        tags: ['status:todo'],
        body: { title: 'Mongo smoke record' },
      }),
      headers: { 'content-type': 'application/json' },
    })
    expect(createRes.status).toBe(201)
    const createPayload = await createRes.json()
    const recordId: string = createPayload.data.body.id

    // Create patch
    const patchRes = await app.request(`/api/v0/records/${recordId}/patches`, {
      method: 'POST',
      body: JSON.stringify({
        parentId: null,
        currentVersion: 0,
        tagChanges: {
          change: [
            { namespace: 'status', from: 'status:todo', to: 'status:done' },
          ],
        },
        body: { description: 'Mongo patch' },
      }),
      headers: { 'content-type': 'application/json' },
    })
    expect(patchRes.status).toBe(201)

    // Board current
    const boardRes = await app.request('/api/v0/board/current')
    expect(boardRes.status).toBe(200)
    const boardPayload = await boardRes.json()

    expect(boardPayload.data.records).toHaveLength(1)
    const current = boardPayload.data.records[0].body
    expect(current.tags).toEqual(['status:done'])
    expect(current.body).toMatchObject({
      title: 'Mongo smoke record',
      description: 'Mongo patch',
    })
    expect(current.tags).not.toContain('status:todo')
  })

  // 鈹€鈹€ 3. Snapshot head in Mongo 鈹€鈹€

  it('GET /api/v0/records/:id/head reflects patch advancement', async () => {
    const { app } = await createSmokeApp()

    const createRes = await app.request('/api/v0/records', {
      method: 'POST',
      body: JSON.stringify({
        schema: 'CardBody',
        tags: ['status:todo'],
        body: { title: 'Head test' },
      }),
      headers: { 'content-type': 'application/json' },
    })
    const recordId: string = (await createRes.json()).data.body.id

    // Snapshot head initially at version 0
    const head0Res = await app.request(`/api/v0/records/${recordId}/head`)
    const head0 = await head0Res.json()
    expect(head0.data.currentVersion).toBe(0)
    expect(head0.data.lastPatchId).toBeNull()

    // Apply a patch
    const patchRes = await app.request(`/api/v0/records/${recordId}/patches`, {
      method: 'POST',
      body: JSON.stringify({
        parentId: null,
        currentVersion: head0.data.currentVersion,
        tagChanges: {
          change: [
            { namespace: 'status', from: 'status:todo', to: 'status:done' },
          ],
        },
      }),
      headers: { 'content-type': 'application/json' },
    })
    expect(patchRes.status).toBe(201)
    const patchPayload = await patchRes.json()
    const patchId: string = patchPayload.data.patch.body.id

    // Snapshot head advanced
    const head1Res = await app.request(`/api/v0/records/${recordId}/head`)
    const head1 = await head1Res.json()
    expect(head1.data.currentVersion).toBe(1)
    expect(head1.data.lastPatchId).toBe(patchId)

    // Verify snapshot head is NOT in records collection
    const client = await getClient()
    const recordsCount = await client
      .db(TEST_DB)
      .collection('records')
      .countDocuments({ kind: 'snapshotHead' })
    expect(recordsCount).toBe(0)
  })

  // 鈹€鈹€ 4. History replay in Mongo 鈹€鈹€

  it('GET /api/v0/records/:id/history returns complete replay', async () => {
    const { app } = await createSmokeApp()

    const createRes = await app.request('/api/v0/records', {
      method: 'POST',
      body: JSON.stringify({
        schema: 'CardBody',
        tags: ['status:todo'],
        body: { title: 'History test' },
      }),
      headers: { 'content-type': 'application/json' },
    })
    const recordId: string = (await createRes.json()).data.body.id

    await app.request(`/api/v0/records/${recordId}/patches`, {
      method: 'POST',
      body: JSON.stringify({
        parentId: null,
        currentVersion: 0,
        tagChanges: {
          change: [
            { namespace: 'status', from: 'status:todo', to: 'status:done' },
          ],
        },
      }),
      headers: { 'content-type': 'application/json' },
    })

    const historyRes = await app.request(`/api/v0/records/${recordId}/history`)
    expect(historyRes.status).toBe(200)
    const historyPayload = await historyRes.json()

    expect(historyPayload.data.status).toBe('complete')
    expect(historyPayload.data.patches).toHaveLength(1)
    expect(historyPayload.data.replay).toBeDefined()
    expect(historyPayload.data.replay.finalState.tags).toEqual(['status:done'])
  })

  // 鈹€鈹€ 5. Archive patch in Mongo 鈹€鈹€

  it('archive patch hides record and board current reflects archived state', async () => {
    const { app } = await createSmokeApp()

    const createRes = await app.request('/api/v0/records', {
      method: 'POST',
      body: JSON.stringify({
        schema: 'CardBody',
        tags: ['status:todo'],
        body: { title: 'Archive test' },
      }),
      headers: { 'content-type': 'application/json' },
    })
    const recordId: string = (await createRes.json()).data.body.id

    // Patch to status:done then archive
    await app.request(`/api/v0/records/${recordId}/patches`, {
      method: 'POST',
      body: JSON.stringify({
        parentId: null,
        currentVersion: 0,
        tagChanges: {
          change: [
            { namespace: 'status', from: 'status:todo', to: 'status:done' },
          ],
        },
      }),
      headers: { 'content-type': 'application/json' },
    })

    const archiveHeadRes = await app.request(`/api/v0/records/${recordId}/head`)
    const archiveHead = await archiveHeadRes.json()
    const archiveResponse = await app.request(
      `/api/v0/records/${recordId}/patches`,
      {
        method: 'POST',
        body: JSON.stringify({
          parentId: archiveHead.data.lastPatchId,
          currentVersion: archiveHead.data.currentVersion,
          tagChanges: { add: ['status:archived'] },
          description: 'Archive record',
        }),
        headers: { 'content-type': 'application/json' },
      }
    )
    expect(archiveResponse.status).toBe(201)

    // Board current: archived hidden by default
    const boardRes = await app.request('/api/v0/board/current')
    const boardPayload = await boardRes.json()
    expect(boardPayload.data.records).toEqual([])
    expect(boardPayload.data.summary.archivedRecords).toBe(1)

    // includeArchived=true shows it with replay tags
    const archivedRes = await app.request(
      '/api/v0/board/current?includeArchived=true'
    )
    const archivedPayload = await archivedRes.json()
    expect(archivedPayload.data.records).toHaveLength(1)

    const tags: string[] = archivedPayload.data.records[0].body.tags
    expect(tags).toEqual(
      expect.arrayContaining(['status:done', 'status:archived'])
    )
    expect(tags).not.toContain('status:todo')
  })

  // 鈹€鈹€ 6. Board current has no write side effects 鈹€鈹€

  it('GET /api/v0/board/current does not mutate snapshot head or records', async () => {
    const { app } = await createSmokeApp()

    const createRes = await app.request('/api/v0/records', {
      method: 'POST',
      body: JSON.stringify({
        schema: 'CardBody',
        tags: ['status:todo'],
        body: { title: 'No side effect test' },
      }),
      headers: { 'content-type': 'application/json' },
    })
    const recordId: string = (await createRes.json()).data.body.id

    await app.request(`/api/v0/records/${recordId}/patches`, {
      method: 'POST',
      body: JSON.stringify({
        parentId: null,
        currentVersion: 0,
        tagChanges: {
          change: [
            { namespace: 'status', from: 'status:todo', to: 'status:done' },
          ],
        },
      }),
      headers: { 'content-type': 'application/json' },
    })

    // Capture state before board current
    const boardBeforeRes = await app.request('/api/v0/board/current')
    const boardBefore = await boardBeforeRes.json()

    const patchesBefore = await app.request(
      `/api/v0/records/${recordId}/history`
    )
    const patchesBeforePayload = await patchesBefore.json()
    const patchesBeforeCount = patchesBeforePayload.data.patches.length

    // Call board current
    await app.request('/api/v0/board/current')

    // Verify nothing changed
    const boardAfterRes = await app.request('/api/v0/board/current')
    const boardAfter = await boardAfterRes.json()
    expect(boardAfter.data.snapshotHeadVersion).toBe(
      boardBefore.data.snapshotHeadVersion
    )

    const patchesAfter = await app.request(
      `/api/v0/records/${recordId}/history`
    )
    const patchesAfterPayload = await patchesAfter.json()
    expect(patchesAfterPayload.data.patches.length).toBe(patchesBeforeCount)
  })

  // 鈹€鈹€ 7. stale currentVersion conflict 鈹€鈹€
  //
  // Client A succeeds; Client B reuses the same currentVersion and
  // fails at validation (parentId mismatch) 鈥?no insert, no orphan.

  it('stale currentVersion conflict does not append patch', async () => {
    const { app } = await createSmokeApp()

    const createRes = await app.request('/api/v0/records', {
      method: 'POST',
      body: JSON.stringify({
        schema: 'CardBody',
        tags: ['status:todo'],
        body: { title: 'Stale version test' },
      }),
      headers: { 'content-type': 'application/json' },
    })
    const recordId: string = (await createRes.json()).data.body.id

    // Client A succeeds
    const resA = await app.request(`/api/v0/records/${recordId}/patches`, {
      method: 'POST',
      body: JSON.stringify({
        parentId: null,
        currentVersion: 0,
        tagChanges: {
          change: [
            { namespace: 'status', from: 'status:todo', to: 'status:done' },
          ],
        },
      }),
      headers: { 'content-type': 'application/json' },
    })
    expect(resA.status).toBe(201)

    // Client B retries with same stale currentVersion 鈫?409
    const resB = await app.request(`/api/v0/records/${recordId}/patches`, {
      method: 'POST',
      body: JSON.stringify({
        parentId: null,
        currentVersion: 0,
        tagChanges: {
          change: [
            { namespace: 'status', from: 'status:todo', to: 'status:done' },
          ],
        },
      }),
      headers: { 'content-type': 'application/json' },
    })
    expect(resB.status).toBe(409)

    // Only one patch in collection
    const client = await getClient()
    const recordsCol = client.db(TEST_DB).collection('records')
    const patches = await recordsCol
      .find({ targetId: recordId, parentId: { $exists: true } })
      .toArray()
    expect(patches).toHaveLength(1)
  })

  // 鈹€鈹€ 8. Deterministic CAS failure 鈫?orphan cleanup 鈹€鈹€
  //
  // Uses a proxied collection so that findOneAndReplace returns null
  // (simulating a concurrent snapshot head update between validate and
  // CAS).  The test verifies that the just-inserted patch is deleted.

  it('standalone CAS failure cleans up orphan patch', async () => {
    const { app, snapshotHeadRepository } = await createSmokeApp()

    // Create a record with one patch so the head exists at version 1.
    const createRes = await app.request('/api/v0/records', {
      method: 'POST',
      body: JSON.stringify({
        schema: 'CardBody',
        tags: ['status:todo'],
        body: { title: 'CAS cleanup test' },
      }),
      headers: { 'content-type': 'application/json' },
    })
    const recordId: string = (await createRes.json()).data.body.id

    const patchRes = await app.request(`/api/v0/records/${recordId}/patches`, {
      method: 'POST',
      body: JSON.stringify({
        parentId: null,
        currentVersion: 0,
        tagChanges: {
          change: [
            { namespace: 'status', from: 'status:todo', to: 'status:done' },
          ],
        },
      }),
      headers: { 'content-type': 'application/json' },
    })
    expect(patchRes.status).toBe(201)
    const firstPatchId: string = (await patchRes.json()).data.patch.body.id

    // Read the current head to get lastPatchId for our next append.
    const client = await getClient()
    const snapshotsCol = client.db(TEST_DB).collection('snapshots')
    const headBefore = await snapshotsCol.findOne({ kind: 'snapshotHead' })
    expect(headBefore).toBeTruthy()

    // Build a second patch that would pass validation on the current
    // head (same lastPatchId, correct currentVersion).
    const secondPatch: StoredPatchDoc = {
      id: crypto.randomUUID(),
      pid:
        (headBefore! as Record<string, unknown>).records &&
        (headBefore! as any).records[recordId]
          ? (headBefore! as any).records[recordId].lastPatchId
          : 'missing',
      targetId: recordId,
      parentId: firstPatchId,
      schema: 'CardBody',
      tagChanges: {
        change: [
          { namespace: 'status', from: 'status:todo', to: 'status:done' },
        ],
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any

    // Proxy the snapshots collection so findOneAndReplace returns null
    // (CAS failure), and the records collection to spy on deleteOne.
    const repo = snapshotHeadRepository as unknown as {
      recordsCollection: Collection<Document>
      snapshotsCollection: Collection<Document>
    }
    const origRecordsCol = repo.recordsCollection
    const origSnapshotsCol = repo.snapshotsCollection
    let findOneAndReplaceCalled = false
    let deleteOneCalled = false

    const proxiedSnapshots = new Proxy(origSnapshotsCol, {
      get(target, prop, receiver) {
        const orig = Reflect.get(target, prop, receiver)
        if (prop === 'findOneAndReplace') {
          return async (...args: unknown[]) => {
            findOneAndReplaceCalled = true
            return null // CAS failure
          }
        }
        if (typeof orig === 'function') return orig.bind(target)
        return orig
      },
    })

    const proxiedRecords = new Proxy(origRecordsCol, {
      get(target, prop, receiver) {
        const orig = Reflect.get(target, prop, receiver)
        if (prop === 'deleteOne') {
          return async (...args: unknown[]) => {
            deleteOneCalled = true
            return orig.bind(target)(...args)
          }
        }
        if (typeof orig === 'function') return orig.bind(target)
        return orig
      },
    })

    repo.snapshotsCollection = proxiedSnapshots
    repo.recordsCollection = proxiedRecords

    try {
      const result = await snapshotHeadRepository.appendPatchAndAdvanceHead({
        targetId: recordId,
        patch: secondPatch,
        expectedParentId: firstPatchId,
        expectedSnapshotVersion: headBefore!.version as number,
      })

      // CAS failed 鈫?should return currentVersionMismatch
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.reason).toBe('currentVersionMismatch')
      }

      // Cleanup must have been triggered
      expect(findOneAndReplaceCalled).toBe(true)
      expect(deleteOneCalled).toBe(true)

      // Verify the orphan patch is NOT in the collection
      const recordsCol = client.db(TEST_DB).collection('records')
      const patches = await recordsCol
        .find({ targetId: recordId, parentId: { $exists: true } })
        .toArray()
      expect(patches).toHaveLength(1)
      expect(patches[0].id).toBe(firstPatchId)
    } finally {
      repo.snapshotsCollection = origSnapshotsCol
      repo.recordsCollection = origRecordsCol
    }
  })

  // 鈹€鈹€ 9. Cleanup failure throws 鈹€鈹€
  //
  // Same proxy approach, but deleteOne also throws.  The repository
  // must propagate the cleanup error rather than returning a conflict
  // result.

  it('standalone CAS failure + cleanup delete error throws', async () => {
    const { app, snapshotHeadRepository } = await createSmokeApp()

    const createRes = await app.request('/api/v0/records', {
      method: 'POST',
      body: JSON.stringify({
        schema: 'CardBody',
        tags: ['status:todo'],
        body: { title: 'Cleanup error test' },
      }),
      headers: { 'content-type': 'application/json' },
    })
    const recordId: string = (await createRes.json()).data.body.id

    const patchRes = await app.request(`/api/v0/records/${recordId}/patches`, {
      method: 'POST',
      body: JSON.stringify({
        parentId: null,
        currentVersion: 0,
        tagChanges: {
          change: [
            { namespace: 'status', from: 'status:todo', to: 'status:done' },
          ],
        },
      }),
      headers: { 'content-type': 'application/json' },
    })
    expect(patchRes.status).toBe(201)
    const firstPatchId: string = (await patchRes.json()).data.patch.body.id

    const client = await getClient()
    const snapshotsCol = client.db(TEST_DB).collection('snapshots')
    const headBefore = await snapshotsCol.findOne({ kind: 'snapshotHead' })
    expect(headBefore).toBeTruthy()

    const secondPatch: StoredPatchDoc = {
      id: crypto.randomUUID(),
      pid: (headBefore! as any).records?.[recordId]?.lastPatchId ?? 'missing',
      targetId: recordId,
      parentId: firstPatchId,
      schema: 'CardBody',
      tagChanges: {
        change: [
          { namespace: 'status', from: 'status:todo', to: 'status:done' },
        ],
      },
    } as any

    const repo = snapshotHeadRepository as unknown as {
      recordsCollection: Collection<Document>
      snapshotsCollection: Collection<Document>
    }
    const origRecordsCol = repo.recordsCollection
    const origSnapshotsCol = repo.snapshotsCollection

    const cleanupError = new Error('Simulated deleteOne failure')

    const proxiedSnapshots = new Proxy(origSnapshotsCol, {
      get(target, prop, receiver) {
        const orig = Reflect.get(target, prop, receiver)
        if (prop === 'findOneAndReplace') return async () => null // CAS failure
        if (typeof orig === 'function') return orig.bind(target)
        return orig
      },
    })

    const proxiedRecords = new Proxy(origRecordsCol, {
      get(target, prop, receiver) {
        const orig = Reflect.get(target, prop, receiver)
        if (prop === 'deleteOne') {
          return async () => {
            throw cleanupError
          }
        }
        if (typeof orig === 'function') return orig.bind(target)
        return orig
      },
    })

    repo.snapshotsCollection = proxiedSnapshots
    repo.recordsCollection = proxiedRecords

    try {
      await snapshotHeadRepository.appendPatchAndAdvanceHead({
        targetId: recordId,
        patch: secondPatch,
        expectedParentId: firstPatchId,
        expectedSnapshotVersion: headBefore!.version as number,
      })
      // Must not reach here 鈥?cleanup should have thrown.
      expect.unreachable('Expected cleanup error to be thrown')
    } catch (caught) {
      expect(String(caught)).toContain('Orphan patch cleanup failed')
      expect(String(caught)).toContain(secondPatch.id)
      expect(String(caught)).toContain('compensating delete')
    } finally {
      repo.snapshotsCollection = origSnapshotsCol
      repo.recordsCollection = origRecordsCol
    }
  })
})
