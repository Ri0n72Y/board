import { Hono } from 'hono'
import { DEFAULT_BOARD_CONFIG } from '@labour-board/shared'
import { describe, expect, it } from 'vitest'
import { MemoryRecordRepository } from '../../repositories/recordRepository.js'
import { MemorySnapshotHeadRepository } from '../../repositories/snapshotHeadRepository.js'
import { RecordService } from '../../services/recordService.js'
import { createRecordsRoute } from './index.js'

function createApp(): Hono {
  const app = new Hono()
  const repo = new MemoryRecordRepository()
  const service = new RecordService(
    repo,
    new MemorySnapshotHeadRepository(repo),
    structuredClone(DEFAULT_BOARD_CONFIG)
  )
  app.route('/api/v0/records', createRecordsRoute(service))
  return app
}

describe('recordCrudRoute', () => {
  it('creates, lists, reads, and archives records', async () => {
    const app = createApp()

    const createResponse = await app.request('/api/v0/records', {
      method: 'POST',
      body: JSON.stringify({
        schema: 'CardBody',
        tags: ['status:todo'],
        body: { title: 'Route card' },
      }),
      headers: { 'content-type': 'application/json' },
    })
    const createPayload = await createResponse.json()

    expect(createResponse.status).toBe(201)
    expect(createPayload.data.body.pid).toBe('CARD-1')

    const listResponse = await app.request('/api/v0/records?schema=CardBody')
    const listPayload = await listResponse.json()
    expect(listPayload.data).toHaveLength(1)

    const recordId = createPayload.data.body.id as string
    const readResponse = await app.request(`/api/v0/records/${recordId}`)
    expect(readResponse.status).toBe(200)

    const deleteResponse = await app.request(`/api/v0/records/${recordId}`, {
      method: 'DELETE',
    })
    const deletePayload = await deleteResponse.json()
    expect(deleteResponse.status).toBe(200)
    expect(deletePayload.data.body.tags).toContain('status:archived')

    const currentListResponse = await app.request('/api/v0/records')
    const currentListPayload = await currentListResponse.json()
    expect(currentListPayload.data).toEqual([])

    const archivedListResponse = await app.request(
      '/api/v0/records?includeArchived=true'
    )
    const archivedListPayload = await archivedListResponse.json()
    expect(archivedListPayload.data).toHaveLength(1)
  })

  it('returns 404 for missing records', async () => {
    const app = createApp()

    const readResponse = await app.request('/api/v0/records/missing')
    expect(readResponse.status).toBe(404)

    const patchResponse = await app.request('/api/v0/records/missing', {
      method: 'PATCH',
      body: JSON.stringify({ tagChanges: { change: [{ namespace: 'status', from: 'status:todo', to: 'status:wip' }] } }),
      headers: { 'content-type': 'application/json' },
    })
    expect(patchResponse.status).toBe(410)

    const deleteResponse = await app.request('/api/v0/records/missing', {
      method: 'DELETE',
    })
    expect(deleteResponse.status).toBe(404)
  })

  it('returns 400 for invalid create input', async () => {
    const app = createApp()

    const response = await app.request('/api/v0/records', {
      method: 'POST',
      body: JSON.stringify({
        schema: 'CardBody',
        tags: ['status:not-configured'],
        body: { title: 'Invalid route card' },
      }),
      headers: { 'content-type': 'application/json' },
    })
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload).toEqual({
      ok: false,
      error: {
        code: 'INVALID_RECORD',
        message: 'Unsupported tag: status:not-configured',
      },
    })
  })

  it('returns 410 for legacy PATCH regardless of body', async () => {
    const app = createApp()

    const createResponse = await app.request('/api/v0/records', {
      method: 'POST',
      body: JSON.stringify({
        schema: 'CardBody',
        tags: ['status:todo'],
        body: { title: 'Body null test' },
      }),
      headers: { 'content-type': 'application/json' },
    })
    const createPayload = await createResponse.json()
    const recordId = createPayload.data.body.id as string

    const response = await app.request(`/api/v0/records/${recordId}`, {
      method: 'PATCH',
      body: JSON.stringify({ body: null }),
      headers: { 'content-type': 'application/json' },
    })
    const payload = await response.json()

    expect(response.status).toBe(410)
    expect(payload.ok).toBe(false)
    expect(payload.error.code).toBe('GONE')
    expect(payload.error.message).toBe(
      'Legacy direct record PATCH is disabled; use POST /api/v0/records/:id/patches'
    )
  })

  it('failed legacy PATCH does not corrupt the original record', async () => {
    const app = createApp()

    const createResponse = await app.request('/api/v0/records', {
      method: 'POST',
      body: JSON.stringify({
        schema: 'CardBody',
        tags: ['status:todo'],
        body: { title: 'No corruption test' },
      }),
      headers: { 'content-type': 'application/json' },
    })
    const createPayload = await createResponse.json()
    const recordId = createPayload.data.body.id as string
    const originalTags = createPayload.data.body.tags
    const originalTitle = createPayload.data.body.body.title

    await app.request(`/api/v0/records/${recordId}`, {
      method: 'PATCH',
      body: JSON.stringify({ body: null }),
      headers: { 'content-type': 'application/json' },
    })

    const readResponse = await app.request(`/api/v0/records/${recordId}`)
    const readPayload = await readResponse.json()

    expect(readResponse.status).toBe(200)
    expect(readPayload.data.body.tags).toEqual(originalTags)
    expect(readPayload.data.body.body.title).toBe(originalTitle)
  })

  it('returns 410 when legacy PATCH targets an archived record', async () => {
    const app = createApp()

    const createResponse = await app.request('/api/v0/records', {
      method: 'POST',
      body: JSON.stringify({
        schema: 'CardBody',
        tags: ['status:todo'],
        body: { title: 'Archived patch test' },
      }),
      headers: { 'content-type': 'application/json' },
    })
    const createPayload = await createResponse.json()
    const recordId = createPayload.data.body.id as string

    await app.request(`/api/v0/records/${recordId}`, { method: 'DELETE' })

    const patchResponse = await app.request(`/api/v0/records/${recordId}`, {
      method: 'PATCH',
      body: JSON.stringify({ tagChanges: { change: [{ namespace: 'status', from: 'status:todo', to: 'status:wip' }] } }),
      headers: { 'content-type': 'application/json' },
    })
    const patchPayload = await patchResponse.json()

    expect(patchResponse.status).toBe(410)
    expect(patchPayload.ok).toBe(false)
    expect(patchPayload.error.code).toBe('GONE')

    const archivedResponse = await app.request(
      `/api/v0/records?includeArchived=true`
    )
    const archivedPayload = await archivedResponse.json()
    expect(archivedPayload.data).toHaveLength(1)
    expect(archivedPayload.data[0].body.tags).toContain('status:archived')
    expect(archivedPayload.data[0].body.tags).not.toContain('status:wip')
  })

  it('returns 410 when legacy PATCH body contains targetId', async () => {
    const app = createApp()

    const createResponse = await app.request('/api/v0/records', {
      method: 'POST',
      body: JSON.stringify({
        schema: 'CardBody',
        tags: ['status:todo'],
        body: { title: 'TargetId rejection test' },
      }),
      headers: { 'content-type': 'application/json' },
    })
    const createPayload = await createResponse.json()
    const recordId = createPayload.data.body.id as string

    const response = await app.request(`/api/v0/records/${recordId}`, {
      method: 'PATCH',
      body: JSON.stringify({ targetId: recordId, tagChanges: { change: [{ namespace: 'status', from: 'status:todo', to: 'status:wip' }] } }),
      headers: { 'content-type': 'application/json' },
    })
    const payload = await response.json()

    expect(response.status).toBe(410)
    expect(payload.ok).toBe(false)
    expect(payload.error.code).toBe('GONE')
  })

  it('returns 410 when legacy PATCH body contains parentId', async () => {
    const app = createApp()

    const createResponse = await app.request('/api/v0/records', {
      method: 'POST',
      body: JSON.stringify({
        schema: 'CardBody',
        tags: ['status:todo'],
        body: { title: 'ParentId rejection test' },
      }),
      headers: { 'content-type': 'application/json' },
    })
    const createPayload = await createResponse.json()
    const recordId = createPayload.data.body.id as string

    const response = await app.request(`/api/v0/records/${recordId}`, {
      method: 'PATCH',
      body: JSON.stringify({ parentId: 'patch-1', tagChanges: { change: [{ namespace: 'status', from: 'status:todo', to: 'status:wip' }] } }),
      headers: { 'content-type': 'application/json' },
    })
    const payload = await response.json()

    expect(response.status).toBe(410)
    expect(payload.ok).toBe(false)
    expect(payload.error.code).toBe('GONE')
  })

  it('returns 410 when legacy PATCH body contains snapshotVersion', async () => {
    const app = createApp()

    const createResponse = await app.request('/api/v0/records', {
      method: 'POST',
      body: JSON.stringify({
        schema: 'CardBody',
        tags: ['status:todo'],
        body: { title: 'SnapshotVersion rejection test' },
      }),
      headers: { 'content-type': 'application/json' },
    })
    const createPayload = await createResponse.json()
    const recordId = createPayload.data.body.id as string

    const response = await app.request(`/api/v0/records/${recordId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        snapshotVersion: 1,
        tagChanges: { change: [{ namespace: 'status', from: 'status:todo', to: 'status:wip' }] },
      }),
      headers: { 'content-type': 'application/json' },
    })
    const payload = await response.json()

    expect(response.status).toBe(410)
    expect(payload.ok).toBe(false)
    expect(payload.error.code).toBe('GONE')
  })

  it('uses x-actor-id header for createdBy', async () => {
    const app = createApp()

    const createResponse = await app.request('/api/v0/records', {
      method: 'POST',
      body: JSON.stringify({
        schema: 'CardBody',
        tags: ['status:todo'],
        body: { title: 'Actor header test' },
      }),
      headers: {
        'content-type': 'application/json',
        'x-actor-id': 'actor-header-99',
      },
    })
    const createPayload = await createResponse.json()

    expect(createResponse.status).toBe(201)
    expect(createPayload.data.createdBy).toBe('actor-header-99')
  })

  it('falls back to default actor when x-actor-id is empty or missing', async () => {
    const app = createApp()

    const response = await app.request('/api/v0/records', {
      method: 'POST',
      body: JSON.stringify({
        schema: 'CardBody',
        tags: ['status:todo'],
        body: { title: 'Default actor route test' },
      }),
      headers: {
        'content-type': 'application/json',
      },
    })
    const payload = await response.json()

    expect(response.status).toBe(201)
    expect(payload.data.createdBy).toBe('local')
  })

  it('trims whitespace from x-actor-id header', async () => {
    const app = createApp()

    const response = await app.request('/api/v0/records', {
      method: 'POST',
      body: JSON.stringify({
        schema: 'CardBody',
        tags: ['status:todo'],
        body: { title: 'Trim header test' },
      }),
      headers: {
        'content-type': 'application/json',
        'x-actor-id': '  padded-actor  ',
      },
    })
    const payload = await response.json()

    expect(response.status).toBe(201)
    expect(payload.data.createdBy).toBe('padded-actor')
  })

  it('records list does not include patches after POST /:id/patches', async () => {
    const app = createApp()

    const createResponse = await app.request('/api/v0/records', {
      method: 'POST',
      body: JSON.stringify({
        schema: 'CardBody',
        tags: ['status:todo'],
        body: { title: 'List no patch test' },
      }),
      headers: { 'content-type': 'application/json' },
    })
    const createPayload = await createResponse.json()
    const recordId = createPayload.data.body.id as string

    await app.request(`/api/v0/records/${recordId}/patches`, {
      method: 'POST',
      body: JSON.stringify({
        parentId: null,
        snapshotVersion: 0,
        tagChanges: { change: [{ namespace: 'status', from: 'status:todo', to: 'status:wip' }] },
      }),
      headers: { 'content-type': 'application/json' },
    })

    const listResponse = await app.request('/api/v0/records')
    const listPayload = await listResponse.json()
    expect(listPayload.data).toHaveLength(1)
    expect(listPayload.data[0].body.id).toBe(recordId)
    expect(listPayload.data[0].body).not.toHaveProperty('targetId')
  })
})
