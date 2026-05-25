import { Hono } from 'hono'
import { DEFAULT_BOARD_CONFIG } from '@labour-board/shared'
import { describe, expect, it } from 'vitest'
import { MemoryRecordRepository } from '../repositories/recordRepository.js'
import { RecordService } from '../services/recordService.js'
import { createRecordsRoute } from './records.js'

function createApp(): Hono {
  const app = new Hono()
  const service = new RecordService(
    new MemoryRecordRepository(),
    structuredClone(DEFAULT_BOARD_CONFIG)
  )
  app.route('/api/v0/records', createRecordsRoute(service))
  return app
}

describe('createRecordsRoute', () => {
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
    expect(createPayload.data.pid).toBe('CARD-1')

    const listResponse = await app.request('/api/v0/records?schema=CardBody')
    const listPayload = await listResponse.json()
    expect(listPayload.data).toHaveLength(1)

    const recordId = createPayload.data.id as string
    const readResponse = await app.request(`/api/v0/records/${recordId}`)
    expect(readResponse.status).toBe(200)

    const patchResponse = await app.request(`/api/v0/records/${recordId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        targetId: recordId,
        tags: ['status:wip'],
        body: { description: 'Updated by route' },
      }),
      headers: { 'content-type': 'application/json' },
    })
    const patchPayload = await patchResponse.json()
    expect(patchResponse.status).toBe(200)
    expect(patchPayload.data.tags).toEqual(['status:wip'])

    const deleteResponse = await app.request(`/api/v0/records/${recordId}`, {
      method: 'DELETE',
    })
    const deletePayload = await deleteResponse.json()
    expect(deleteResponse.status).toBe(200)
    expect(deletePayload.data.tags).toContain('status:archived')

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
      body: JSON.stringify({ targetId: 'missing', tags: ['status:wip'] }),
      headers: { 'content-type': 'application/json' },
    })
    expect(patchResponse.status).toBe(404)

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
})
