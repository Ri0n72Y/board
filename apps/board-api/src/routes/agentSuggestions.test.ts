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

async function createReviewedDraft(app: Hono): Promise<string> {
  const res = await app.request('/api/v0/agent/drafts', {
    method: 'POST',
    body: JSON.stringify({
      title: 'Test Draft for Suggestions',
      profile: 'agent-full',
      source: 'current-board',
    }),
    headers: { 'content-type': 'application/json' },
  })
  const payload = await res.json()
  const draftId: string = payload.data.draft.id

  // Review it
  await app.request(`/api/v0/agent/drafts/${draftId}/review`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'reviewed' }),
    headers: { 'content-type': 'application/json' },
  })

  return draftId
}

describe('Agent Suggestions route', () => {
  // ─── POST generate ───

  it('POST /agent/drafts/:id/suggestions success', async () => {
    const app = await createTestApp()
    const draftId = await createReviewedDraft(app)

    const res = await app.request(
      `/api/v0/agent/drafts/${draftId}/suggestions`,
      {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'content-type': 'application/json' },
      },
    )
    expect(res.status).toBe(201)
    const payload = await res.json()
    expect(payload.ok).toBe(true)
    expect(payload.data.suggestion.markdown).toBeTruthy()
    expect(payload.data.suggestion.skillSnapshots.length).toBeGreaterThan(0)
  })

  it('POST missing draft returns 404', async () => {
    const app = await createTestApp()
    const res = await app.request(
      '/api/v0/agent/drafts/nonexistent/suggestions',
      {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'content-type': 'application/json' },
      },
    )
    expect(res.status).toBe(404)
  })

  it('POST unreviewed draft returns 409', async () => {
    const app = await createTestApp()
    const r = await app.request('/api/v0/agent/drafts', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Unreviewed draft',
        profile: 'agent-full',
        source: 'current-board',
      }),
      headers: { 'content-type': 'application/json' },
    })
    const payload = await r.json()
    const draftId: string = payload.data.draft.id

    const res = await app.request(
      `/api/v0/agent/drafts/${draftId}/suggestions`,
      {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'content-type': 'application/json' },
      },
    )
    expect(res.status).toBe(409)
  })

  // ─── Malformed body ───

  it('POST with title number returns 400', async () => {
    const app = await createTestApp()
    const draftId = await createReviewedDraft(app)

    const res = await app.request(
      `/api/v0/agent/drafts/${draftId}/suggestions`,
      {
        method: 'POST',
        body: JSON.stringify({ title: 123 }),
        headers: { 'content-type': 'application/json' },
      },
    )
    expect(res.status).toBe(400)
  })

  it('POST with instruction number returns 400', async () => {
    const app = await createTestApp()
    const draftId = await createReviewedDraft(app)

    const res = await app.request(
      `/api/v0/agent/drafts/${draftId}/suggestions`,
      {
        method: 'POST',
        body: JSON.stringify({ instruction: 456 }),
        headers: { 'content-type': 'application/json' },
      },
    )
    expect(res.status).toBe(400)
  })

  it('POST with provider number returns 400', async () => {
    const app = await createTestApp()
    const draftId = await createReviewedDraft(app)

    const res = await app.request(
      `/api/v0/agent/drafts/${draftId}/suggestions`,
      {
        method: 'POST',
        body: JSON.stringify({ provider: 789 }),
        headers: { 'content-type': 'application/json' },
      },
    )
    expect(res.status).toBe(400)
  })

  it('POST with provider "openai-compatible" returns 400', async () => {
    const app = await createTestApp()
    const draftId = await createReviewedDraft(app)

    const res = await app.request(
      `/api/v0/agent/drafts/${draftId}/suggestions`,
      {
        method: 'POST',
        body: JSON.stringify({ provider: 'openai-compatible' }),
        headers: { 'content-type': 'application/json' },
      },
    )
    expect(res.status).toBe(400)
  })

  it('POST with skillIds string returns 400', async () => {
    const app = await createTestApp()
    const draftId = await createReviewedDraft(app)

    const res = await app.request(
      `/api/v0/agent/drafts/${draftId}/suggestions`,
      {
        method: 'POST',
        body: JSON.stringify({ skillIds: 'not-an-array' }),
        headers: { 'content-type': 'application/json' },
      },
    )
    expect(res.status).toBe(400)
  })

  it('POST with skillIds array containing number returns 400', async () => {
    const app = await createTestApp()
    const draftId = await createReviewedDraft(app)

    const res = await app.request(
      `/api/v0/agent/drafts/${draftId}/suggestions`,
      {
        method: 'POST',
        body: JSON.stringify({ skillIds: ['labourboard-advisor', 123] }),
        headers: { 'content-type': 'application/json' },
      },
    )
    expect(res.status).toBe(400)
  })

  it('POST with skillIds containing empty string returns 400', async () => {
    const app = await createTestApp()
    const draftId = await createReviewedDraft(app)

    const res = await app.request(
      `/api/v0/agent/drafts/${draftId}/suggestions`,
      {
        method: 'POST',
        body: JSON.stringify({ skillIds: ['', 'labourboard-advisor'] }),
        headers: { 'content-type': 'application/json' },
      },
    )
    expect(res.status).toBe(400)
  })

  it('POST with unknown skillId returns 400', async () => {
    const app = await createTestApp()
    const draftId = await createReviewedDraft(app)

    const res = await app.request(
      `/api/v0/agent/drafts/${draftId}/suggestions`,
      {
        method: 'POST',
        body: JSON.stringify({ skillIds: ['unknown-skill-xyz'] }),
        headers: { 'content-type': 'application/json' },
      },
    )
    expect(res.status).toBe(400)
  })

  // ─── GET list ───

  it('GET draft suggestions summary has no markdown', async () => {
    const app = await createTestApp()
    const draftId = await createReviewedDraft(app)

    // Generate one suggestion
    await app.request(
      `/api/v0/agent/drafts/${draftId}/suggestions`,
      {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'content-type': 'application/json' },
      },
    )

    const res = await app.request(
      `/api/v0/agent/drafts/${draftId}/suggestions`,
    )
    expect(res.status).toBe(200)
    const payload = await res.json()
    expect(payload.ok).toBe(true)
    for (const s of payload.data.suggestions) {
      expect(s.markdown).toBeUndefined()
    }
  })

  // ─── GET detail ───

  it('GET suggestion detail includes markdown', async () => {
    const app = await createTestApp()
    const draftId = await createReviewedDraft(app)

    const genRes = await app.request(
      `/api/v0/agent/drafts/${draftId}/suggestions`,
      {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'content-type': 'application/json' },
      },
    )
    const genPayload = await genRes.json()
    const suggestionId: string = genPayload.data.suggestion.id

    const res = await app.request(
      `/api/v0/agent/suggestions/${suggestionId}`,
    )
    expect(res.status).toBe(200)
    const payload = await res.json()
    expect(payload.data.suggestion.markdown).toBeTruthy()
    expect(payload.data.suggestion.skillSnapshots).toBeDefined()
  })

  // ─── PATCH review ───

  it('PATCH review updates status to reviewed', async () => {
    const app = await createTestApp()
    const draftId = await createReviewedDraft(app)

    const genRes = await app.request(
      `/api/v0/agent/drafts/${draftId}/suggestions`,
      {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'content-type': 'application/json' },
      },
    )
    const genPayload = await genRes.json()
    const suggestionId: string = genPayload.data.suggestion.id

    const res = await app.request(
      `/api/v0/agent/suggestions/${suggestionId}/review`,
      {
        method: 'PATCH',
        body: JSON.stringify({ status: 'reviewed' }),
        headers: { 'content-type': 'application/json' },
      },
    )
    expect(res.status).toBe(200)
    const payload = await res.json()
    expect(payload.data.suggestion.status).toBe('reviewed')
  })

  it('PATCH review invalid status returns 400', async () => {
    const app = await createTestApp()
    const draftId = await createReviewedDraft(app)

    const genRes = await app.request(
      `/api/v0/agent/drafts/${draftId}/suggestions`,
      {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'content-type': 'application/json' },
      },
    )
    const genPayload = await genRes.json()
    const suggestionId: string = genPayload.data.suggestion.id

    const res = await app.request(
      `/api/v0/agent/suggestions/${suggestionId}/review`,
      {
        method: 'PATCH',
        body: JSON.stringify({ status: 'invalid-status' }),
        headers: { 'content-type': 'application/json' },
      },
    )
    expect(res.status).toBe(400)
  })

  // ─── Forbidden routes ───

  it('POST /api/v0/agent/run does not exist', async () => {
    const app = await createTestApp()
    const res = await app.request('/api/v0/agent/run', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'content-type': 'application/json' },
    })
    expect(res.status).toBe(404)
  })

  it('POST /api/v0/agent/apply does not exist', async () => {
    const app = await createTestApp()
    const res = await app.request('/api/v0/agent/apply', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'content-type': 'application/json' },
    })
    expect(res.status).toBe(404)
  })

  it('POST /api/v0/agent/execute does not exist', async () => {
    const app = await createTestApp()
    const res = await app.request('/api/v0/agent/execute', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'content-type': 'application/json' },
    })
    expect(res.status).toBe(404)
  })

  it('POST /api/v0/agent/suggestions/:id/apply does not exist', async () => {
    const app = await createTestApp()
    const res = await app.request(
      '/api/v0/agent/suggestions/any-id/apply',
      { method: 'POST' },
    )
    expect(res.status).toBe(404)
  })
})
