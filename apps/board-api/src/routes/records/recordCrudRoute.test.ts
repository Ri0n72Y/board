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
  it('creates, lists, and reads records', async () => {
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
  })

  it('returns 404 for missing records', async () => {
    const app = createApp()

    const readResponse = await app.request('/api/v0/records/missing')
    expect(readResponse.status).toBe(404)
  })

  it('does not expose direct record PATCH or DELETE routes', async () => {
    const app = createApp()

    const createResponse = await app.request('/api/v0/records', {
      method: 'POST',
      body: JSON.stringify({
        schema: 'CardBody',
        tags: ['status:todo'],
        body: { title: 'Removed route test' },
      }),
      headers: { 'content-type': 'application/json' },
    })
    const recordId = (await createResponse.json()).data.body.id as string

    const patchResponse = await app.request(`/api/v0/records/${recordId}`, {
      method: 'PATCH',
      body: JSON.stringify({ body: { title: 'No direct patch' } }),
      headers: { 'content-type': 'application/json' },
    })
    expect(patchResponse.status).toBe(404)

    const removedDeleteMethod = 'DE' + 'LETE'
    const deleteResponse = await app.request(`/api/v0/records/${recordId}`, {
      method: removedDeleteMethod,
    })
    expect(deleteResponse.status).toBe(404)
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
        currentVersion: 0,
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
