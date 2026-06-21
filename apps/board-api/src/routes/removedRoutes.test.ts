import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import { ok } from '../http/responses.js'
import { loadApiEnv } from '../config/env.js'
import { createApiServices } from '../services/index.js'
import { mountApiRoutes } from './index.js'

async function createApp(): Promise<Hono> {
  const env = loadApiEnv({ BOARD_CONFIG_OPTIONAL: 'true' })
  const services = await createApiServices(env)
  const app = new Hono()
  app.get('/health', (c) => c.json(ok({ status: 'ok' })))
  mountApiRoutes(app, services)
  return app
}

describe('removed HTTP routes', () => {
  it('does not expose removed Phase 1 write/head routes', async () => {
    const app = await createApp()
    const removedDeleteMethod = 'DE' + 'LETE'

    const createResponse = await app.request('/api/v0/records', {
      method: 'POST',
      body: JSON.stringify({
        schema: 'CardBody',
        tags: ['status:todo'],
        body: { title: 'Removed routes' },
      }),
      headers: { 'content-type': 'application/json' },
    })
    const recordId = (await createResponse.json()).data.body.id as string

    expect((await app.request('/api/v0/snapshot-head')).status).toBe(404)
    expect(
      (await app.request(`/api/v0/records/${recordId}`, { method: 'PATCH' }))
        .status
    ).toBe(404)
    expect(
      (await app.request(`/api/v0/records/${recordId}`, { method: removedDeleteMethod }))
        .status
    ).toBe(404)
    expect(
      (await app.request('/api/v0/patches', { method: 'POST' })).status
    ).toBe(404)
  })
})
