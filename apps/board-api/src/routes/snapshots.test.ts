import { Hono } from 'hono'
import { DEFAULT_BOARD_CONFIG } from '@labour-board/shared'
import { describe, expect, it } from 'vitest'
import { MemoryRecordRepository } from '../repositories/recordRepository.js'
import {
  MemorySnapshotHeadRepository,
  SnapshotHeadIntegrityError,
  type SnapshotHeadRepository,
  type SnapshotHead,
} from '../repositories/snapshotHeadRepository.js'
import { MemorySnapshotRepository } from '../repositories/snapshotRepository.js'
import { RecordService } from '../services/recordService.js'
import { SnapshotService } from '../services/snapshot/snapshotService.js'
import { createRecordsRoute } from './records.js'
import { createSnapshotsRoute } from './snapshots.js'

function createApp(): {
  app: Hono
  recordService: RecordService
  snapshotHeadRepository: SnapshotHeadRepository
} {
  const app = new Hono()
  const repo = new MemoryRecordRepository()
  const snapshotHeadRepository = new MemorySnapshotHeadRepository(repo)
  const recordService = new RecordService(
    repo,
    snapshotHeadRepository,
    structuredClone(DEFAULT_BOARD_CONFIG)
  )
  const snapshotService = new SnapshotService(
    repo,
    snapshotHeadRepository,
    new MemorySnapshotRepository()
  )

  app.route('/api/v0/records', createRecordsRoute(recordService))
  app.route('/api/v0/snapshots', createSnapshotsRoute(snapshotService))

  return { app, recordService, snapshotHeadRepository }
}

describe('createSnapshotsRoute', () => {
  it('creates, lists, and gets a manual snapshot detail', async () => {
    const { app } = createApp()
    const record = await createCard(app, 'Snapshot smoke', ['status:todo'])

    const createResponse = await app.request('/api/v0/snapshots', {
      method: 'POST',
      body: JSON.stringify({ reason: 'Manual checkpoint' }),
      headers: {
        'content-type': 'application/json',
        'x-actor-id': 'snapshotter',
      },
    })
    const createPayload = await createResponse.json()

    expect(createResponse.status).toBe(201)
    expect(createPayload.ok).toBe(true)
    expect(createPayload.data.snapshot).toMatchObject({
      createdBy: 'snapshotter',
      reason: 'Manual checkpoint',
      recordCount: 1,
      patchCount: 0,
      source: 'manual',
      projectionStatus: 'clean',
    })
    expect(createPayload.data.snapshot.projection.records[0].body.id).toBe(
      record.id
    )

    const listResponse = await app.request('/api/v0/snapshots')
    const listPayload = await listResponse.json()
    expect(listPayload.data.snapshots).toHaveLength(1)
    expect(listPayload.data.snapshots[0]).not.toHaveProperty('projection')
    expect(listPayload.data.snapshots[0].id).toBe(
      createPayload.data.snapshot.id
    )

    const detailResponse = await app.request(
      `/api/v0/snapshots/${createPayload.data.snapshot.id}`
    )
    const detailPayload = await detailResponse.json()
    expect(detailPayload.data.snapshot.projection.records[0].body.body.title)
      .toBe('Snapshot smoke')
  })

  it('keeps old snapshot static after later create and patch', async () => {
    const { app } = createApp()
    const record = await createCard(app, 'Static before', ['status:todo'])

    const firstSnapshot = await createSnapshot(app, 'Before changes')
    expect(firstSnapshot.projection.records).toHaveLength(1)

    await createCard(app, 'Created later', ['status:todo'])
    await postPatch(app, record.id, {
      parentId: null,
      currentVersion: 2,
      tags: ['status:done'],
      body: { title: 'Static after' },
    })

    const oldDetailResponse = await app.request(
      `/api/v0/snapshots/${firstSnapshot.id}`
    )
    const oldDetail = await oldDetailResponse.json()
    expect(oldDetail.data.snapshot.recordCount).toBe(1)
    expect(oldDetail.data.snapshot.projection.records[0].body.body.title).toBe(
      'Static before'
    )
    expect(oldDetail.data.snapshot.projection.records[0].body.tags).toEqual([
      'status:todo',
    ])

    const secondSnapshot = await createSnapshot(app, 'After changes')
    expect(secondSnapshot.recordCount).toBe(2)
    const updated = secondSnapshot.projection.records.find(
      (item: { body: { id: string } }) => item.body.id === record.id
    )
    expect(updated?.body.body.title).toBe('Static after')
    expect(updated?.body.tags).toEqual(['status:done'])
  })

  it('does not affect record-head or patch submit', async () => {
    const { app, recordService } = createApp()
    const record = await createCard(app, 'Head unaffected', ['status:todo'])
    const headBefore = await recordService.getRecordCurrentHead(record.id)

    await createSnapshot(app, 'Head check')
    const headAfterSnapshot = await recordService.getRecordCurrentHead(record.id)
    expect(headAfterSnapshot).toEqual(headBefore)

    const patchResponse = await postPatch(app, record.id, {
      parentId: headAfterSnapshot?.lastPatchId ?? null,
      currentVersion: headAfterSnapshot?.currentVersion,
      tags: ['status:done'],
    })
    expect(patchResponse.status).toBe(201)
  })

  it('returns 404 for missing snapshot detail', async () => {
    const { app } = createApp()

    const response = await app.request('/api/v0/snapshots/missing')
    const payload = await response.json()

    expect(response.status).toBe(404)
    expect(payload.ok).toBe(false)
    expect(payload.error.code).toBe('NOT_FOUND')
  })

  it('stores projection diagnostics and status at creation time', async () => {
    const repo = new MemoryRecordRepository()
    const corruptHead = new CorruptSnapshotHeadRepository()
    const recordService = new RecordService(
      repo,
      corruptHead,
      structuredClone(DEFAULT_BOARD_CONFIG)
    )
    await recordService.create({
      schema: 'CardBody',
      tags: ['status:todo'],
      body: { title: 'Diagnostic snapshot' },
    })

    const snapshotService = new SnapshotService(
      repo,
      corruptHead,
      new MemorySnapshotRepository()
    )
    const snapshot = await snapshotService.createManualSnapshot({}, 'local')

    expect(snapshot.projectionStatus).toBe('partial')
    expect(snapshot.projection.diagnostics?.[0]).toMatchObject({
      code: 'SNAPSHOT_HEAD_INTEGRITY_ERROR',
    })
  })
})

async function createCard(app: Hono, title: string, tags: string[]) {
  const response = await app.request('/api/v0/records', {
    method: 'POST',
    body: JSON.stringify({
      schema: 'CardBody',
      tags,
      body: { title },
    }),
    headers: { 'content-type': 'application/json' },
  })
  const payload = await response.json()
  expect(response.status).toBe(201)
  return payload.data.body
}

async function createSnapshot(app: Hono, reason: string) {
  const response = await app.request('/api/v0/snapshots', {
    method: 'POST',
    body: JSON.stringify({ reason }),
    headers: { 'content-type': 'application/json' },
  })
  const payload = await response.json()
  expect(response.status).toBe(201)
  return payload.data.snapshot
}

async function postPatch(
  app: Hono,
  recordId: string,
  body: Record<string, unknown>
) {
  return app.request(`/api/v0/records/${recordId}/patches`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

class CorruptSnapshotHeadRepository implements SnapshotHeadRepository {
  async loadSnapshotHead(): Promise<SnapshotHead> {
    throw new SnapshotHeadIntegrityError('test corruption')
  }

  rebuildSnapshotHeadFromPatches(): SnapshotHead {
    return { kind: 'snapshotHead', version: 0, records: {} }
  }

  async appendPatchAndAdvanceHead() {
    return {
      ok: false as const,
      reason: 'snapshotVersionMismatch' as const,
      currentVersion: -1,
    }
  }
}
