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

describe('recordPatchRoute', () => {
  it('creates patch via POST /:id/patches with parentId:null and currentVersion:0', async () => {
    const app = createApp()

    const createResponse = await app.request('/api/v0/records', {
      method: 'POST',
      body: JSON.stringify({
        schema: 'CardBody',
        tags: ['status:todo'],
        body: { title: 'Patch route test' },
      }),
      headers: { 'content-type': 'application/json' },
    })
    const createPayload = await createResponse.json()
    const recordId = createPayload.data.body.id as string

    const response = await app.request(`/api/v0/records/${recordId}/patches`, {
      method: 'POST',
      body: JSON.stringify({
        parentId: null,
        currentVersion: 0,
        tagChanges: {
          change: [
            { namespace: 'status', from: 'status:todo', to: 'status:wip' },
          ],
        },
        body: { description: 'Patched via new route' },
        description: 'Route-level patch',
      }),
      headers: { 'content-type': 'application/json' },
    })
    const payload = await response.json()

    expect(response.status).toBe(201)
    expect(payload.ok).toBe(true)
    expect(payload.data.patch.body).toMatchObject({
      targetId: recordId,
      parentId: null,
      tagChanges: {
        change: [
          { namespace: 'status', from: 'status:todo', to: 'status:wip' },
        ],
      },
      description: 'Route-level patch',
    })
    expect(payload.data.patch.body).not.toHaveProperty('currentVersion')
    expect(payload.data).toHaveProperty('patch')
    expect(payload.data).toHaveProperty('newCurrentVersion')
    expect(payload.data.newCurrentVersion).toBe(1)
    expect(payload.data).not.toHaveProperty('current')
  })

  it('POST /:id/patches returns 404 when target record does not exist', async () => {
    const app = createApp()

    const response = await app.request(
      '/api/v0/records/non-existent-id/patches',
      {
        method: 'POST',
        body: JSON.stringify({
          parentId: null,
          currentVersion: 0,
          tagChanges: {
            change: [
              { namespace: 'status', from: 'status:todo', to: 'status:wip' },
            ],
          },
        }),
        headers: { 'content-type': 'application/json' },
      }
    )
    const payload = await response.json()

    expect(response.status).toBe(404)
    expect(payload.ok).toBe(false)
    expect(payload.error.code).toBe('NOT_FOUND')
  })

  it('POST /:id/patches returns 400 when targetId is in body', async () => {
    const app = createApp()

    const createResponse = await app.request('/api/v0/records', {
      method: 'POST',
      body: JSON.stringify({
        schema: 'CardBody',
        tags: ['status:todo'],
        body: { title: 'No targetId in body' },
      }),
      headers: { 'content-type': 'application/json' },
    })
    const createPayload = await createResponse.json()
    const recordId = createPayload.data.body.id as string

    const response = await app.request(`/api/v0/records/${recordId}/patches`, {
      method: 'POST',
      body: JSON.stringify({
        targetId: recordId,
        parentId: null,
        currentVersion: 0,
        tagChanges: {
          change: [
            { namespace: 'status', from: 'status:todo', to: 'status:wip' },
          ],
        },
      }),
      headers: { 'content-type': 'application/json' },
    })
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.ok).toBe(false)
    expect(payload.error.message).toContain('targetId must not be provided')
  })

  it.each([
    {
      name: 'parentId is missing',
      body: {
        currentVersion: 0,
        tagChanges: {
          change: [
            { namespace: 'status', from: 'status:todo', to: 'status:wip' },
          ],
        },
      },
      message: 'parentId is required',
    },
    {
      name: 'currentVersion is missing',
      body: {
        parentId: null,
        tagChanges: {
          change: [
            { namespace: 'status', from: 'status:todo', to: 'status:wip' },
          ],
        },
      },
      message: 'currentVersion is required',
    },
    {
      name: 'parentId has wrong type',
      body: {
        parentId: 1,
        currentVersion: 0,
        tagChanges: {
          change: [
            { namespace: 'status', from: 'status:todo', to: 'status:wip' },
          ],
        },
      },
      message: 'parentId must be a string or null',
    },
    {
      name: 'currentVersion has wrong type',
      body: {
        parentId: null,
        currentVersion: '0',
        tagChanges: {
          change: [
            { namespace: 'status', from: 'status:todo', to: 'status:wip' },
          ],
        },
      },
      message: 'currentVersion must be a number',
    },
  ])('POST /:id/patches returns 400 when $name', async ({ body, message }) => {
    const app = createApp()

    const createResponse = await app.request('/api/v0/records', {
      method: 'POST',
      body: JSON.stringify({
        schema: 'CardBody',
        tags: ['status:todo'],
        body: { title: 'Patch input shape test' },
      }),
      headers: { 'content-type': 'application/json' },
    })
    const createPayload = await createResponse.json()
    const recordId = createPayload.data.body.id as string

    const response = await app.request(`/api/v0/records/${recordId}/patches`, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
    })
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.ok).toBe(false)
    expect(payload.error.code).toBe('INVALID_PATCH')
    expect(payload.error.message).toContain(message)
  })

  it('POST /:id/patches returns 400 for empty patch with no change content', async () => {
    const app = createApp()

    const createResponse = await app.request('/api/v0/records', {
      method: 'POST',
      body: JSON.stringify({
        schema: 'CardBody',
        tags: ['status:todo'],
        body: { title: 'Empty patch test' },
      }),
      headers: { 'content-type': 'application/json' },
    })
    const createPayload = await createResponse.json()
    const recordId = createPayload.data.body.id as string

    const response = await app.request(`/api/v0/records/${recordId}/patches`, {
      method: 'POST',
      body: JSON.stringify({ parentId: null, currentVersion: 0 }),
      headers: { 'content-type': 'application/json' },
    })
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.ok).toBe(false)
    expect(payload.error.code).toBe('INVALID_PATCH')
    expect(payload.error.message).toContain(
      'Patch must contain at least one change'
    )
  })

  it('POST /:id/patches returns 400 for body: null', async () => {
    const app = createApp()

    const createResponse = await app.request('/api/v0/records', {
      method: 'POST',
      body: JSON.stringify({
        schema: 'CardBody',
        tags: ['status:todo'],
        body: { title: 'Body null patch test' },
      }),
      headers: { 'content-type': 'application/json' },
    })
    const createPayload = await createResponse.json()
    const recordId = createPayload.data.body.id as string

    const response = await app.request(`/api/v0/records/${recordId}/patches`, {
      method: 'POST',
      body: JSON.stringify({
        parentId: null,
        currentVersion: 0,
        body: null,
      }),
      headers: { 'content-type': 'application/json' },
    })
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.ok).toBe(false)
    expect(payload.error.code).toBe('INVALID_PATCH')
    expect(payload.error.message).toContain('body must not be null')
  })

  it('POST /:id/patches returns 400 for unsupported tag', async () => {
    const app = createApp()

    const createResponse = await app.request('/api/v0/records', {
      method: 'POST',
      body: JSON.stringify({
        schema: 'CardBody',
        tags: ['status:todo'],
        body: { title: 'Unsupported tag patch test' },
      }),
      headers: { 'content-type': 'application/json' },
    })
    const createPayload = await createResponse.json()
    const recordId = createPayload.data.body.id as string

    const response = await app.request(`/api/v0/records/${recordId}/patches`, {
      method: 'POST',
      body: JSON.stringify({
        parentId: null,
        currentVersion: 0,
        tagChanges: {
          add: ['status:not-configured'],
        },
      }),
      headers: { 'content-type': 'application/json' },
    })
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.ok).toBe(false)
    expect(payload.error.code).toBe('INVALID_PATCH')
    expect(payload.error.message).toBe('Unsupported tag: status:not-configured')
  })

  it('POST /:id/patches returns 400 for unsupported relation constraint', async () => {
    const app = createApp()

    const createResponse = await app.request('/api/v0/records', {
      method: 'POST',
      body: JSON.stringify({
        schema: 'CardBody',
        tags: ['status:todo'],
        body: { title: 'Unsupported relation patch test' },
      }),
      headers: { 'content-type': 'application/json' },
    })
    const createPayload = await createResponse.json()
    const recordId = createPayload.data.body.id as string

    const response = await app.request(`/api/v0/records/${recordId}/patches`, {
      method: 'POST',
      body: JSON.stringify({
        parentId: null,
        currentVersion: 0,
        relations: [{ constraint: 'invalidRelation', target: 'target-1' }],
      }),
      headers: { 'content-type': 'application/json' },
    })
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.ok).toBe(false)
    expect(payload.error.code).toBe('INVALID_PATCH')
    expect(payload.error.message).toBe(
      'Unsupported relation constraint: invalidRelation'
    )
  })

  it('POST /:id/patches returns 400 when patching an archived record', async () => {
    const app = createApp()

    const createResponse = await app.request('/api/v0/records', {
      method: 'POST',
      body: JSON.stringify({
        schema: 'CardBody',
        tags: ['status:todo'],
        body: { title: 'Archived patch reject' },
      }),
      headers: { 'content-type': 'application/json' },
    })
    const createPayload = await createResponse.json()
    const recordId = createPayload.data.body.id as string

    const archiveHeadResponse = await app.request(
      `/api/v0/records/${recordId}/head`
    )
    const archiveHeadPayload = await archiveHeadResponse.json()
    const archiveResponse = await app.request(
      `/api/v0/records/${recordId}/patches`,
      {
        method: 'POST',
        body: JSON.stringify({
          parentId: archiveHeadPayload.data.lastPatchId,
          currentVersion: archiveHeadPayload.data.currentVersion,
          tagChanges: { add: ['status:archived'] },
          description: 'Archive record',
        }),
        headers: { 'content-type': 'application/json' },
      }
    )
    expect(archiveResponse.status).toBe(201)
    const headResponse = await app.request(`/api/v0/records/${recordId}/head`)
    const headPayload = await headResponse.json()

    const response = await app.request(`/api/v0/records/${recordId}/patches`, {
      method: 'POST',
      body: JSON.stringify({
        parentId: headPayload.data.lastPatchId,
        currentVersion: headPayload.data.currentVersion,
        tagChanges: {
          change: [
            { namespace: 'status', from: 'status:todo', to: 'status:wip' },
          ],
        },
      }),
      headers: { 'content-type': 'application/json' },
    })
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.ok).toBe(false)
    expect(payload.error.code).toBe('INVALID_PATCH')
    expect(payload.error.message).toBe(
      `Cannot patch archived record ${recordId}`
    )
  })

  it('POST /:id/patches returns 409 when currentVersion mismatches', async () => {
    const app = createApp()

    const createResponse = await app.request('/api/v0/records', {
      method: 'POST',
      body: JSON.stringify({
        schema: 'CardBody',
        tags: ['status:todo'],
        body: { title: 'Version conflict test' },
      }),
      headers: { 'content-type': 'application/json' },
    })
    const createPayload = await createResponse.json()
    const recordId = createPayload.data.body.id as string

    const response = await app.request(`/api/v0/records/${recordId}/patches`, {
      method: 'POST',
      body: JSON.stringify({
        parentId: null,
        currentVersion: 5,
        tagChanges: {
          change: [
            { namespace: 'status', from: 'status:todo', to: 'status:wip' },
          ],
        },
      }),
      headers: { 'content-type': 'application/json' },
    })
    const payload = await response.json()

    expect(response.status).toBe(409)
    expect(payload.ok).toBe(false)
    expect(payload.error.code).toBe('CONFLICT')
    expect(payload.error.message).toContain('Current version mismatch')
  })

  it('POST /:id/patches returns 409 when parentId mismatches lastPatchId', async () => {
    const app = createApp()

    const createResponse = await app.request('/api/v0/records', {
      method: 'POST',
      body: JSON.stringify({
        schema: 'CardBody',
        tags: ['status:todo'],
        body: { title: 'Parent conflict test' },
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
        tagChanges: {
          change: [
            { namespace: 'status', from: 'status:todo', to: 'status:wip' },
          ],
        },
      }),
      headers: { 'content-type': 'application/json' },
    })

    const response = await app.request(`/api/v0/records/${recordId}/patches`, {
      method: 'POST',
      body: JSON.stringify({
        parentId: null,
        currentVersion: 1,
        tagChanges: {
          change: [
            { namespace: 'status', from: 'status:todo', to: 'status:done' },
          ],
        },
      }),
      headers: { 'content-type': 'application/json' },
    })
    const payload = await response.json()

    expect(response.status).toBe(409)
    expect(payload.ok).toBe(false)
    expect(payload.error.code).toBe('CONFLICT')
    expect(payload.error.message).toContain('Parent patch mismatch')
  })

  it('second patch with correct parentId succeeds', async () => {
    const app = createApp()

    const createResponse = await app.request('/api/v0/records', {
      method: 'POST',
      body: JSON.stringify({
        schema: 'CardBody',
        tags: ['status:todo'],
        body: { title: 'Chain test' },
      }),
      headers: { 'content-type': 'application/json' },
    })
    const createPayload = await createResponse.json()
    const recordId = createPayload.data.body.id as string

    const firstResponse = await app.request(
      `/api/v0/records/${recordId}/patches`,
      {
        method: 'POST',
        body: JSON.stringify({
          parentId: null,
          currentVersion: 0,
          tagChanges: {
            change: [
              { namespace: 'status', from: 'status:todo', to: 'status:wip' },
            ],
          },
        }),
        headers: { 'content-type': 'application/json' },
      }
    )
    const firstPayload = await firstResponse.json()
    expect(firstResponse.status).toBe(201)

    const secondResponse = await app.request(
      `/api/v0/records/${recordId}/patches`,
      {
        method: 'POST',
        body: JSON.stringify({
          parentId: firstPayload.data.patch.body.id,
          currentVersion: 1,
          body: { description: 'Second change' },
        }),
        headers: { 'content-type': 'application/json' },
      }
    )
    const secondPayload = await secondResponse.json()

    expect(secondResponse.status).toBe(201)
    expect(secondPayload.data.patch.body.parentId).toBe(
      firstPayload.data.patch.body.id
    )
    expect(secondPayload.data).toHaveProperty('newCurrentVersion')
    expect(secondPayload.data.newCurrentVersion).toBe(2)
    expect(secondPayload.data).not.toHaveProperty('current')
  })

  it('uses x-actor-id header for patch createdBy via POST /:id/patches', async () => {
    const app = createApp()

    const createResponse = await app.request('/api/v0/records', {
      method: 'POST',
      body: JSON.stringify({
        schema: 'CardBody',
        tags: ['status:todo'],
        body: { title: 'Patch actor test' },
      }),
      headers: { 'content-type': 'application/json' },
    })
    const createPayload = await createResponse.json()
    const recordId = createPayload.data.body.id as string

    const response = await app.request(`/api/v0/records/${recordId}/patches`, {
      method: 'POST',
      body: JSON.stringify({
        parentId: null,
        currentVersion: 0,
        tagChanges: {
          change: [
            { namespace: 'status', from: 'status:todo', to: 'status:wip' },
          ],
        },
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
})
