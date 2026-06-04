import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import { ok } from './http/responses.js'
import { loadApiEnv } from './config/env.js'
import { createApiServices } from './services/index.js'
import { mountApiRoutes } from './routes/index.js'

/**
 * Creates a test app with the full route wiring but forced memory mode
 * (no MongoDB dependency).
 */
async function createTestApp(): Promise<Hono> {
  const env = loadApiEnv({ BOARD_CONFIG_OPTIONAL: 'true' })
  const services = await createApiServices(env)
  const app = new Hono()
  app.get('/health', (c) => c.json(ok({ status: 'ok' })))
  mountApiRoutes(app, services)
  return app
}

describe('app integration smoke', () => {
  // ── Health check ──

  it('GET /health returns 200', async () => {
    const app = await createTestApp()
    const res = await app.request('/health')
    expect(res.status).toBe(200)
    const payload = await res.json()
    expect(payload.ok).toBe(true)
    expect(payload.data.status).toBe('ok')
  })

  // ── Board current route is mounted ──

  it('GET /api/v0/board/current returns 200 with empty projection', async () => {
    const app = await createTestApp()

    const res = await app.request('/api/v0/board/current')
    expect(res.status).toBe(200)

    const payload = await res.json()
    expect(payload.ok).toBe(true)
    expect(payload.data.snapshotHeadVersion).toBe(0)
    expect(payload.data.records).toEqual([])
    expect(payload.data.summary.projectionStatus).toBe('empty')
  })

  // ── Record → patch → board current ──

  it('record → patch → board current shows replayed state', async () => {
    const app = await createTestApp()

    // Create record
    const createRes = await app.request('/api/v0/records', {
      method: 'POST',
      body: JSON.stringify({
        schema: 'CardBody',
        tags: ['status:todo'],
        body: { title: 'Integration test' },
      }),
      headers: { 'content-type': 'application/json' },
    })
    expect(createRes.status).toBe(201)
    const createPayload = await createRes.json()
    const recordId = createPayload.data.body.id as string

    // Create patch
    const patchRes = await app.request(
      `/api/v0/records/${recordId}/patches`,
      {
        method: 'POST',
        body: JSON.stringify({
          parentId: null,
          snapshotVersion: 0,
          tags: ['status:done'],
          body: { description: 'Patched in integration' },
        }),
        headers: { 'content-type': 'application/json' },
      }
    )
    expect(patchRes.status).toBe(201)

    // Board current should show replayed state
    const boardRes = await app.request('/api/v0/board/current')
    expect(boardRes.status).toBe(200)
    const boardPayload = await boardRes.json()

    expect(boardPayload.data.records).toHaveLength(1)
    const current = boardPayload.data.records[0].body
    expect(current.tags).toEqual(['status:done'])
    expect(current.body).toMatchObject({
      title: 'Integration test',
      description: 'Patched in integration',
    })
    // Must NOT be stale base state
    expect(current.tags).not.toContain('status:todo')
  })

  // ── Archive → board current hidden / includeArchived ──

  it('archive hides record from board current by default', async () => {
    const app = await createTestApp()

    // Create → patch → archive
    const createRes = await app.request('/api/v0/records', {
      method: 'POST',
      body: JSON.stringify({
        schema: 'CardBody',
        tags: ['status:todo'],
        body: { title: 'Archive me' },
      }),
      headers: { 'content-type': 'application/json' },
    })
    const recordId = (await createRes.json()).data.body.id as string

    await app.request(`/api/v0/records/${recordId}/patches`, {
      method: 'POST',
      body: JSON.stringify({
        parentId: null,
        snapshotVersion: 0,
        tags: ['status:done'],
      }),
      headers: { 'content-type': 'application/json' },
    })

    await app.request(`/api/v0/records/${recordId}`, { method: 'DELETE' })

    // Board current: hidden by default
    const boardRes = await app.request('/api/v0/board/current')
    const boardPayload = await boardRes.json()
    expect(boardPayload.data.records).toEqual([])
    expect(boardPayload.data.summary.archivedRecords).toBe(1)
  })

  it('includeArchived=true returns archived record with replay tags', async () => {
    const app = await createTestApp()

    const createRes = await app.request('/api/v0/records', {
      method: 'POST',
      body: JSON.stringify({
        schema: 'CardBody',
        tags: ['status:todo'],
        body: { title: 'Archive show' },
      }),
      headers: { 'content-type': 'application/json' },
    })
    const recordId = (await createRes.json()).data.body.id as string

    await app.request(`/api/v0/records/${recordId}/patches`, {
      method: 'POST',
      body: JSON.stringify({
        parentId: null,
        snapshotVersion: 0,
        tags: ['status:done'],
      }),
      headers: { 'content-type': 'application/json' },
    })

    await app.request(`/api/v0/records/${recordId}`, { method: 'DELETE' })

    const boardRes = await app.request(
      '/api/v0/board/current?includeArchived=true'
    )
    const boardPayload = await boardRes.json()

    expect(boardPayload.data.records).toHaveLength(1)
    const tags = boardPayload.data.records[0].body.tags
    expect(tags).toEqual(
      expect.arrayContaining(['status:done', 'status:archived'])
    )
    expect(tags).not.toContain('status:todo')
  })

  // ── History ↔ board current consistency ──

  it('history replay finalState.tags matches board current body.tags for archived record', async () => {
    const app = await createTestApp()

    const createRes = await app.request('/api/v0/records', {
      method: 'POST',
      body: JSON.stringify({
        schema: 'CardBody',
        tags: ['status:todo'],
        body: { title: 'Consistency check' },
      }),
      headers: { 'content-type': 'application/json' },
    })
    const recordId = (await createRes.json()).data.body.id as string

    await app.request(`/api/v0/records/${recordId}/patches`, {
      method: 'POST',
      body: JSON.stringify({
        parentId: null,
        snapshotVersion: 0,
        tags: ['status:done'],
      }),
      headers: { 'content-type': 'application/json' },
    })

    await app.request(`/api/v0/records/${recordId}`, { method: 'DELETE' })

    // History
    const historyRes = await app.request(
      `/api/v0/records/${recordId}/history`
    )
    const historyPayload = await historyRes.json()
    expect(historyPayload.data.status).toBe('complete')
    expect(historyPayload.data.replay).toBeDefined()

    // Board current
    const boardRes = await app.request(
      '/api/v0/board/current?includeArchived=true'
    )
    const boardPayload = await boardRes.json()
    expect(boardPayload.data.records).toHaveLength(1)

    // Tags must match
    const historyTags = historyPayload.data.replay.finalState.tags
    const boardTags = boardPayload.data.records[0].body.tags

    expect(historyTags).toEqual(
      expect.arrayContaining(['status:done', 'status:archived'])
    )
    expect(historyTags).not.toContain('status:todo')
    expect(boardTags).toEqual(historyTags)
  })

  // ── No write side effects ──

  it('GET /api/v0/board/current does not change snapshot head', async () => {
    const app = await createTestApp()

    // Create a record + patch so head version > 0
    const createRes = await app.request('/api/v0/records', {
      method: 'POST',
      body: JSON.stringify({
        schema: 'CardBody',
        tags: ['status:todo'],
        body: { title: 'Snapshot stability' },
      }),
      headers: { 'content-type': 'application/json' },
    })
    const recordId = (await createRes.json()).data.body.id as string

    await app.request(`/api/v0/records/${recordId}/patches`, {
      method: 'POST',
      body: JSON.stringify({
        parentId: null,
        snapshotVersion: 0,
        tags: ['status:done'],
      }),
      headers: { 'content-type': 'application/json' },
    })

    const headBeforeRes = await app.request('/api/v0/snapshot-head')
    const headBefore = await headBeforeRes.json()
    expect(headBefore.data.version).toBeGreaterThan(0)

    await app.request('/api/v0/board/current')

    const headAfterRes = await app.request('/api/v0/snapshot-head')
    const headAfter = await headAfterRes.json()
    expect(headAfter.data).toEqual(headBefore.data)
  })
})
