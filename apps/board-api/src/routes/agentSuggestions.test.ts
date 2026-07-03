import { describe, expect, it } from 'vitest'
import { Hono } from 'hono'
import { ok } from '../http/responses.js'
import { loadApiEnv } from '../config/env.js'
import { createApiServices } from '../services/index.js'
import { mountApiRoutes } from '../routes/index.js'

async function createTestApp(
  envOverrides: NodeJS.ProcessEnv = {}
): Promise<Hono> {
  const originalEnv = new Map<string, string | undefined>()
  for (const key of Object.keys(envOverrides)) {
    originalEnv.set(key, process.env[key])
    const value = envOverrides[key]
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }

  let services!: Awaited<ReturnType<typeof createApiServices>>
  try {
    const env = loadApiEnv({ BOARD_CONFIG_OPTIONAL: 'true' })
    services = await createApiServices(env)
  } finally {
    for (const [key, value] of originalEnv) {
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
  }

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
      }
    )
    expect(res.status).toBe(201)
    const payload = await res.json()
    expect(payload.ok).toBe(true)
    expect(payload.data.suggestion.markdown).toBeTruthy()
    expect(payload.data.suggestion.skillSnapshots.length).toBeGreaterThan(0)
    expect(payload.data.suggestion.audit).toBeDefined()
  })

  it('createApiServices accepts internal apiKey without leaking it into suggestion responses', async () => {
    const secret = 'secret-test-key'
    const app = await createTestApp({
      AGENT_SUGGESTION_PROVIDER: 'mock',
      AGENT_SUGGESTION_MODEL: 'mock-configured-model',
      AGENT_SUGGESTION_API_KEY: secret,
    })
    const draftId = await createReviewedDraft(app)

    const res = await app.request(
      `/api/v0/agent/drafts/${draftId}/suggestions`,
      {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'content-type': 'application/json' },
      }
    )
    expect(res.status).toBe(201)
    const payload = await res.json()
    const suggestionId: string = payload.data.suggestion.id
    const responseJson = JSON.stringify(payload)
    expect(payload.data.suggestion.model).toBe('mock-configured-model')
    expect(payload.data.suggestion.audit.providerModel).toBe(
      'mock-configured-model'
    )
    expect(responseJson).not.toContain(secret)
    expect(responseJson).not.toContain('apiKey')

    const detailRes = await app.request(
      `/api/v0/agent/suggestions/${suggestionId}`
    )
    expect(detailRes.status).toBe(200)
    const detailPayload = await detailRes.json()
    expect(JSON.stringify(detailPayload)).not.toContain(secret)
    expect(JSON.stringify(detailPayload)).not.toContain('apiKey')
  })

  it('POST missing draft returns 404', async () => {
    const app = await createTestApp()
    const res = await app.request(
      '/api/v0/agent/drafts/nonexistent/suggestions',
      {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'content-type': 'application/json' },
      }
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
      }
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
      }
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
      }
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
      }
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
      }
    )
    expect(res.status).toBe(400)
  })

  it('provider unavailable maps to 503', async () => {
    const app = await createTestApp({
      AGENT_SUGGESTION_PROVIDER: 'disabled',
      AGENT_SUGGESTION_MODEL: 'disabled-model',
    })
    const draftId = await createReviewedDraft(app)

    const res = await app.request(
      `/api/v0/agent/drafts/${draftId}/suggestions`,
      {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'content-type': 'application/json' },
      }
    )
    expect(res.status).toBe(503)
    const payload = await res.json()
    expect(payload.error.code).toBe('PROVIDER_UNAVAILABLE')
  })

  it('openai-compatible currently maps to provider unavailable', async () => {
    const app = await createTestApp({
      AGENT_SUGGESTION_PROVIDER: 'openai-compatible',
      AGENT_SUGGESTION_MODEL: 'future-model',
      AGENT_SUGGESTION_API_KEY: 'secret-test-key',
    })
    const draftId = await createReviewedDraft(app)

    const res = await app.request(
      `/api/v0/agent/drafts/${draftId}/suggestions`,
      {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'content-type': 'application/json' },
      }
    )
    const payload = await res.json()
    expect(res.status).toBe(503)
    expect(JSON.stringify(payload)).not.toContain('secret-test-key')
  })

  it('budget exceeded maps to 413', async () => {
    const app = await createTestApp({
      AGENT_SUGGESTION_MAX_INPUT_CHARS: '1',
    })
    const draftId = await createReviewedDraft(app)

    const res = await app.request(
      `/api/v0/agent/drafts/${draftId}/suggestions`,
      {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'content-type': 'application/json' },
      }
    )
    expect(res.status).toBe(413)
    const payload = await res.json()
    expect(payload.error.code).toBe('PROVIDER_BUDGET_EXCEEDED')
  })

  it('output invalid maps to 502', async () => {
    const app = await createTestApp({
      AGENT_SUGGESTION_MAX_OUTPUT_CHARS: '10',
    })
    const draftId = await createReviewedDraft(app)

    const res = await app.request(
      `/api/v0/agent/drafts/${draftId}/suggestions`,
      {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'content-type': 'application/json' },
      }
    )
    expect(res.status).toBe(502)
    const payload = await res.json()
    expect(payload.error.code).toBe('PROVIDER_OUTPUT_INVALID')
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
      }
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
      }
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
      }
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
      }
    )
    expect(res.status).toBe(400)
  })

  // ─── GET list ───

  it('GET draft suggestions summary has no markdown', async () => {
    const app = await createTestApp()
    const draftId = await createReviewedDraft(app)

    // Generate one suggestion
    await app.request(`/api/v0/agent/drafts/${draftId}/suggestions`, {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'content-type': 'application/json' },
    })

    const res = await app.request(`/api/v0/agent/drafts/${draftId}/suggestions`)
    expect(res.status).toBe(200)
    const payload = await res.json()
    expect(payload.ok).toBe(true)
    for (const s of payload.data.suggestions) {
      expect(s.markdown).toBeUndefined()
      expect(s.audit).toBeUndefined()
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
      }
    )
    const genPayload = await genRes.json()
    const suggestionId: string = genPayload.data.suggestion.id

    const res = await app.request(`/api/v0/agent/suggestions/${suggestionId}`)
    expect(res.status).toBe(200)
    const payload = await res.json()
    expect(payload.data.suggestion.markdown).toBeTruthy()
    expect(payload.data.suggestion.skillSnapshots).toBeDefined()
    expect(payload.data.suggestion.audit).toBeDefined()
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
      }
    )
    const genPayload = await genRes.json()
    const suggestionId: string = genPayload.data.suggestion.id

    const res = await app.request(
      `/api/v0/agent/suggestions/${suggestionId}/review`,
      {
        method: 'PATCH',
        body: JSON.stringify({ status: 'reviewed' }),
        headers: { 'content-type': 'application/json' },
      }
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
      }
    )
    const genPayload = await genRes.json()
    const suggestionId: string = genPayload.data.suggestion.id

    const res = await app.request(
      `/api/v0/agent/suggestions/${suggestionId}/review`,
      {
        method: 'PATCH',
        body: JSON.stringify({ status: 'invalid-status' }),
        headers: { 'content-type': 'application/json' },
      }
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
    const res = await app.request('/api/v0/agent/suggestions/any-id/apply', {
      method: 'POST',
    })
    expect(res.status).toBe(404)
  })
})
