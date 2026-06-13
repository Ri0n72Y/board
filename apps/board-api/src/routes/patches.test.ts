import { Hono } from 'hono'
import { DEFAULT_BOARD_CONFIG } from '@labour-board/shared'
import { describe, expect, it } from 'vitest'
import { MemoryRecordRepository } from '../repositories/recordRepository.js'
import { MemorySnapshotHeadRepository } from '../repositories/snapshotHeadRepository.js'
import { RecordService } from '../services/recordService.js'
import { createPatchesRoute } from './patches.js'

function createFullApp(): { app: Hono; service: RecordService } {
  const repo = new MemoryRecordRepository()
  const service = new RecordService(
    repo,
    new MemorySnapshotHeadRepository(repo),
    structuredClone(DEFAULT_BOARD_CONFIG)
  )
  const app = new Hono()
  return { app, service }
}

async function mountAll(app: Hono, service: RecordService): Promise<void> {
  const { createRecordsRoute } = await import('./records.js')
  app.route('/api/v0/records', createRecordsRoute(service))
  app.route('/api/v0/patches', createPatchesRoute(service))
}

async function createCard(app: Hono): Promise<{ id: string; pid: string }> {
  const response = await app.request('/api/v0/records', {
    method: 'POST',
    body: JSON.stringify({
      schema: 'CardBody',
      tags: ['status:todo'],
      body: { title: 'Patch test card' },
    }),
    headers: { 'content-type': 'application/json' },
  })
  const payload = await response.json()
  return {
    id: payload.data.body.id as string,
    pid: payload.data.body.pid as string,
  }
}

/** Create a patch via POST /api/v0/records/:id/patches and return the patch id. */
async function createPatchViaRecords(
  app: Hono,
  recordId: string,
  parentId: string | null,
  snapshotVersion: number,
  body: Record<string, unknown>
): Promise<{ patchId: string; response: Response }> {
  const response = await app.request(`/api/v0/records/${recordId}/patches`, {
    method: 'POST',
    body: JSON.stringify({ parentId, snapshotVersion, ...body }),
    headers: { 'content-type': 'application/json' },
  })
  const payload = await response.json()
  return {
    patchId: payload.data?.patch?.body?.id as string,
    response,
  }
}

describe('createPatchesRoute', () => {
  // 鈹€鈹€ GET /api/v0/patches/:id 鈹€鈹€

  it('returns a patch by id', async () => {
    const { app, service } = createFullApp()
    await mountAll(app, service)
    const { id } = await createCard(app)

    const { patchId } = await createPatchViaRecords(app, id, null, 0, {
      tagChanges: { change: [{ namespace: 'status', from: 'status:todo', to: 'status:wip' }] },
      description: 'Find me',
    })

    const response = await app.request(`/api/v0/patches/${patchId}`)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.ok).toBe(true)
    expect(payload.data.body.id).toBe(patchId)
    expect(payload.data.body.targetId).toBe(id)
    expect(payload.data.body.description).toBe('Find me')
    // parentId should be null for first patch
    expect(payload.data.body.parentId).toBeNull()
  })

  it('returns 404 for a record id (not a patch)', async () => {
    const { app, service } = createFullApp()
    await mountAll(app, service)
    const { id } = await createCard(app)

    const response = await app.request(`/api/v0/patches/${id}`)
    const payload = await response.json()

    expect(response.status).toBe(404)
    expect(payload.ok).toBe(false)
    expect(payload.error.code).toBe('NOT_FOUND')
  })

  it('returns 404 for a non-existent patch id', async () => {
    const { app, service } = createFullApp()
    await mountAll(app, service)

    const response = await app.request('/api/v0/patches/non-existent')
    const payload = await response.json()

    expect(response.status).toBe(404)
    expect(payload.ok).toBe(false)
    expect(payload.error.code).toBe('NOT_FOUND')
  })

  // 鈹€鈹€ GET /api/v0/patches?targetId=xxx 鈹€鈹€

  it('returns patches for a given targetId', async () => {
    const { app, service } = createFullApp()
    await mountAll(app, service)
    const { id } = await createCard(app)

    const { patchId: firstId } = await createPatchViaRecords(app, id, null, 0, {
      tagChanges: { change: [{ namespace: 'status', from: 'status:todo', to: 'status:wip' }] },
    })
    await createPatchViaRecords(app, id, firstId, 1, {
      body: { description: 'Second' },
    })

    const response = await app.request(`/api/v0/patches?targetId=${id}`)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.ok).toBe(true)
    expect(payload.data).toHaveLength(2)
    expect(payload.data[0].body.targetId).toBe(id)
    expect(payload.data[1].body.targetId).toBe(id)
    // First patch has parentId: null
    expect(payload.data[0].body.parentId).toBeNull()
    // Second patch has parentId pointing to first
    expect(payload.data[1].body.parentId).toBe(firstId)
  })

  it('returns empty list for targetId with no patches', async () => {
    const { app, service } = createFullApp()
    await mountAll(app, service)

    const response = await app.request('/api/v0/patches?targetId=non-existent')
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.ok).toBe(true)
    expect(payload.data).toEqual([])
  })

  it('returns 400 when targetId query parameter is missing', async () => {
    const { app, service } = createFullApp()
    await mountAll(app, service)

    const response = await app.request('/api/v0/patches')
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.ok).toBe(false)
    expect(payload.error.code).toBe('INVALID_QUERY')
    expect(payload.error.message).toBe('targetId query parameter is required')
  })

  it('does not expose POST /api/v0/patches creation', async () => {
    const { app, service } = createFullApp()
    await mountAll(app, service)

    const response = await app.request('/api/v0/patches', {
      method: 'POST',
      body: JSON.stringify({ targetId: 'record-1', tagChanges: { change: [{ namespace: 'status', from: 'status:todo', to: 'status:wip' }] } }),
      headers: { 'content-type': 'application/json' },
    })

    expect(response.status).toBe(404)
  })

  // 鈹€鈹€ Separation: record queries must not return patches 鈹€鈹€

  it('record queries do not return patches', async () => {
    const { app, service } = createFullApp()
    await mountAll(app, service)
    const { id } = await createCard(app)

    await createPatchViaRecords(app, id, null, 0, {
      tagChanges: { change: [{ namespace: 'status', from: 'status:todo', to: 'status:wip' }] },
    })

    // GET /api/v0/records/:id returns the record, not the patch
    const recordResponse = await app.request(`/api/v0/records/${id}`)
    const recordPayload = await recordResponse.json()
    expect(recordResponse.status).toBe(200)
    expect(recordPayload.data.body.id).toBe(id)
    // The record returned should NOT have targetId (patch field)
    expect(recordPayload.data.body).not.toHaveProperty('targetId')
  })

  // 鈹€鈹€鈹€ x-actor-id header tests 鈹€鈹€鈹€

  it('uses x-actor-id header for patch createdBy', async () => {
    const { app, service } = createFullApp()
    await mountAll(app, service)
    const { id } = await createCard(app)

    const response = await app.request(`/api/v0/records/${id}/patches`, {
      method: 'POST',
      body: JSON.stringify({
        parentId: null,
        snapshotVersion: 0,
        tagChanges: { change: [{ namespace: 'status', from: 'status:todo', to: 'status:wip' }] },
      }),
      headers: {
        'content-type': 'application/json',
        'x-actor-id': 'patcher-42',
      },
    })
    const payload = await response.json()

    expect(response.status).toBe(201)
    expect(payload.data.patch.createdBy).toBe('patcher-42')
  })

  it('falls back to default actor for patches when x-actor-id is missing', async () => {
    const { app, service } = createFullApp()
    await mountAll(app, service)
    const { id } = await createCard(app)

    const response = await app.request(`/api/v0/records/${id}/patches`, {
      method: 'POST',
      body: JSON.stringify({
        parentId: null,
        snapshotVersion: 0,
        tagChanges: { change: [{ namespace: 'status', from: 'status:todo', to: 'status:wip' }] },
      }),
      headers: {
        'content-type': 'application/json',
      },
    })
    const payload = await response.json()

    expect(response.status).toBe(201)
    expect(payload.data.patch.createdBy).toBe('local')
  })

  it('trims whitespace from x-actor-id header for patch', async () => {
    const { app, service } = createFullApp()
    await mountAll(app, service)
    const { id } = await createCard(app)

    const response = await app.request(`/api/v0/records/${id}/patches`, {
      method: 'POST',
      body: JSON.stringify({
        parentId: null,
        snapshotVersion: 0,
        tagChanges: { change: [{ namespace: 'status', from: 'status:todo', to: 'status:wip' }] },
      }),
      headers: {
        'content-type': 'application/json',
        'x-actor-id': '  trimmed-patcher  ',
      },
    })
    const payload = await response.json()

    expect(response.status).toBe(201)
    expect(payload.data.patch.createdBy).toBe('trimmed-patcher')
  })
})
