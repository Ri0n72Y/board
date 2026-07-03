import { describe, expect, it } from 'vitest'
import { Hono } from 'hono'
import { ok } from '../http/responses.js'
import { loadApiEnv } from '../config/env.js'
import { createApiServices } from '../services/index.js'
import { mountApiRoutes } from '../routes/index.js'

async function createTestApp(): Promise<Hono> {
  const env = loadApiEnv({ BOARD_CONFIG_OPTIONAL: 'true' })
  const services = await createApiServices(env)
  const app = new Hono()
  app.get('/health', (c) => c.json(ok({ status: 'ok' })))
  mountApiRoutes(app, services)
  return app
}

describe('Agent Skills route', () => {
  it('GET /api/v0/agent/skills returns list', async () => {
    const app = await createTestApp()
    const res = await app.request('/api/v0/agent/skills')
    expect(res.status).toBe(200)
    const payload = await res.json()
    expect(payload.ok).toBe(true)
    expect(Array.isArray(payload.data.skills)).toBe(true)
  })

  it('list includes labourboard-advisor', async () => {
    const app = await createTestApp()
    const res = await app.request('/api/v0/agent/skills')
    const payload = await res.json()
    const advisor = payload.data.skills.find(
      (s: Record<string, unknown>) => s.id === 'labourboard-advisor'
    )
    expect(advisor).toBeDefined()
  })

  it('list response has no markdown', async () => {
    const app = await createTestApp()
    const res = await app.request('/api/v0/agent/skills')
    const payload = await res.json()
    for (const s of payload.data.skills) {
      expect(s.markdown).toBeUndefined()
    }
  })

  it('list response has contentHash', async () => {
    const app = await createTestApp()
    const res = await app.request('/api/v0/agent/skills')
    const payload = await res.json()
    for (const s of payload.data.skills) {
      expect(s.contentHash).toBeTruthy()
      expect(s.contentHash).toMatch(/^[a-f0-9]{64}$/)
    }
  })

  it('list response path is logical not absolute', async () => {
    const app = await createTestApp()
    const res = await app.request('/api/v0/agent/skills')
    const payload = await res.json()
    for (const s of payload.data.skills) {
      expect(s.path).toMatch(/^built-in:/)
      expect(s.path).not.toMatch(/^[A-Z]:\\/)
    }
  })

  it('GET /api/v0/agent/skills/labourboard-advisor returns detail', async () => {
    const app = await createTestApp()
    const res = await app.request('/api/v0/agent/skills/labourboard-advisor')
    expect(res.status).toBe(200)
    const payload = await res.json()
    expect(payload.ok).toBe(true)
    expect(payload.data.skill.markdown).toBeTruthy()
    expect(typeof payload.data.skill.markdown).toBe('string')
  })

  it('detail has markdown', async () => {
    const app = await createTestApp()
    const res = await app.request('/api/v0/agent/skills/labourboard-advisor')
    const payload = await res.json()
    expect(payload.data.skill.markdown.length).toBeGreaterThan(0)
  })

  it('detail contentHash is non-empty', async () => {
    const app = await createTestApp()
    const res = await app.request('/api/v0/agent/skills/labourboard-advisor')
    const payload = await res.json()
    expect(payload.data.skill.contentHash).toMatch(/^[a-f0-9]{64}$/)
  })

  it('detail path is logical', async () => {
    const app = await createTestApp()
    const res = await app.request('/api/v0/agent/skills/labourboard-advisor')
    const payload = await res.json()
    expect(payload.data.skill.path).toMatch(/^built-in:/)
  })

  it('GET missing skill returns 404', async () => {
    const app = await createTestApp()
    const res = await app.request('/api/v0/agent/skills/nonexistent')
    expect(res.status).toBe(404)
  })
})
