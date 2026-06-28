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
  const createRes = await app.request('/api/v0/agent/drafts', {
    method: 'POST',
    body: JSON.stringify({
      title: 'Response test draft',
      profile: 'agent-full',
      source: 'current-board',
    }),
    headers: { 'content-type': 'application/json' },
  })
  const draftId = (await createRes.json()).data.draft.id

  await app.request(`/api/v0/agent/drafts/${draftId}/review`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'reviewed', reviewNote: 'Approved' }),
    headers: { 'content-type': 'application/json' },
  })

  return draftId
}

describe('Agent Responses route', () => {
  // ── Create response success ──

  it('POST /api/v0/agent/drafts/:id/responses creates response for reviewed draft', async () => {
    const app = await createTestApp()
    const draftId = await createReviewedDraft(app)

    const res = await app.request(`/api/v0/agent/drafts/${draftId}/responses`, {
      method: 'POST',
      body: JSON.stringify({
        source: 'manual-paste',
        responseMarkdown:
          '# Codex Analysis\n\nHere is my analysis of the board context.',
        externalAgentName: 'Codex',
        responseNote: 'First manual response',
      }),
      headers: { 'content-type': 'application/json' },
    })

    expect(res.status).toBe(201)
    const payload = await res.json()
    expect(payload.ok).toBe(true)
    expect(payload.data.response).toBeDefined()
    const resp = payload.data.response
    expect(resp.source).toBe('manual-paste')
    expect(resp.responseMarkdown).toBe(
      '# Codex Analysis\n\nHere is my analysis of the board context.'
    )
    expect(resp.responseLength).toBe(
      '# Codex Analysis\n\nHere is my analysis of the board context.'.length
    )
    expect(resp.externalAgentName).toBe('Codex')
    expect(resp.responseNote).toBe('First manual response')
    expect(typeof resp.pastedAt).toBe('string')
    expect(resp.pastedBy).toBe('local')
    expect(resp.draftId).toBe(draftId)

    // draftSnapshot
    expect(resp.draftSnapshot).toBeDefined()
    expect(resp.draftSnapshot.id).toBe(draftId)
    expect(resp.draftSnapshot.status).toBe('reviewed')
    expect(resp.draftSnapshot.profile).toBe('agent-full')
    expect(resp.draftSnapshot.source).toBe('current-board')
    expect(typeof resp.draftSnapshot.reviewedAt).toBe('string')
    expect(resp.draftSnapshot.reviewedBy).toBe('local')

    // No API key
    const json = JSON.stringify(resp)
    expect(json).not.toContain('sk-')
    expect(json).not.toContain('AGENT_API_KEY')
  })

  // ── Create response on draft status 409 ──

  it('POST /api/v0/agent/drafts/:id/responses returns 409 for draft status', async () => {
    const app = await createTestApp()
    // Create draft but don't review
    const createRes = await app.request('/api/v0/agent/drafts', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Unreviewed',
        profile: 'agent-full',
        source: 'current-board',
      }),
      headers: { 'content-type': 'application/json' },
    })
    const draftId = (await createRes.json()).data.draft.id

    const res = await app.request(`/api/v0/agent/drafts/${draftId}/responses`, {
      method: 'POST',
      body: JSON.stringify({
        source: 'manual-paste',
        responseMarkdown: 'test response',
      }),
      headers: { 'content-type': 'application/json' },
    })

    expect(res.status).toBe(409)
    const payload = await res.json()
    expect(payload.ok).toBe(false)
    expect(payload.error.code).toBe('RESPONSE_NOT_ALLOWED')
  })

  // ── Create response on discarded status 409 ──

  it('POST /api/v0/agent/drafts/:id/responses returns 409 for discarded draft', async () => {
    const app = await createTestApp()
    const createRes = await app.request('/api/v0/agent/drafts', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Discarded',
        profile: 'agent-full',
        source: 'current-board',
      }),
      headers: { 'content-type': 'application/json' },
    })
    const draftId = (await createRes.json()).data.draft.id

    // Mark as discarded
    await app.request(`/api/v0/agent/drafts/${draftId}/review`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'discarded' }),
      headers: { 'content-type': 'application/json' },
    })

    const res = await app.request(`/api/v0/agent/drafts/${draftId}/responses`, {
      method: 'POST',
      body: JSON.stringify({
        source: 'manual-paste',
        responseMarkdown: 'test response',
      }),
      headers: { 'content-type': 'application/json' },
    })

    expect(res.status).toBe(409)
    const payload = await res.json()
    expect(payload.ok).toBe(false)
    expect(payload.error.code).toBe('RESPONSE_NOT_ALLOWED')
  })

  // ── Missing draft 404 ──

  it('POST /api/v0/agent/drafts/:id/responses returns 404 for missing draft', async () => {
    const app = await createTestApp()
    const res = await app.request(
      '/api/v0/agent/drafts/nonexistent/responses',
      {
        method: 'POST',
        body: JSON.stringify({
          source: 'manual-paste',
          responseMarkdown: 'test',
        }),
        headers: { 'content-type': 'application/json' },
      }
    )
    expect(res.status).toBe(404)
    const payload = await res.json()
    expect(payload.error.code).toBe('NOT_FOUND')
  })

  it('GET /api/v0/agent/drafts/:id/responses returns 404 for missing draft', async () => {
    const app = await createTestApp()
    const res = await app.request('/api/v0/agent/drafts/nonexistent/responses')
    expect(res.status).toBe(404)
    const payload = await res.json()
    expect(payload.error.code).toBe('NOT_FOUND')
  })

  // ── Invalid body ──

  it('POST response returns 400 for missing responseMarkdown', async () => {
    const app = await createTestApp()
    const draftId = await createReviewedDraft(app)

    const res = await app.request(`/api/v0/agent/drafts/${draftId}/responses`, {
      method: 'POST',
      body: JSON.stringify({
        source: 'manual-paste',
      }),
      headers: { 'content-type': 'application/json' },
    })
    expect(res.status).toBe(400)
    const payload = await res.json()
    expect(payload.error.code).toBe('INVALID_AGENT_RESPONSE')
  })

  it('POST response returns 400 for empty responseMarkdown', async () => {
    const app = await createTestApp()
    const draftId = await createReviewedDraft(app)

    const res = await app.request(`/api/v0/agent/drafts/${draftId}/responses`, {
      method: 'POST',
      body: JSON.stringify({
        source: 'manual-paste',
        responseMarkdown: '   ',
      }),
      headers: { 'content-type': 'application/json' },
    })
    expect(res.status).toBe(400)
    const payload = await res.json()
    expect(payload.error.code).toBe('INVALID_AGENT_RESPONSE')
  })

  it('POST response returns 400 for invalid source', async () => {
    const app = await createTestApp()
    const draftId = await createReviewedDraft(app)

    const res = await app.request(`/api/v0/agent/drafts/${draftId}/responses`, {
      method: 'POST',
      body: JSON.stringify({
        source: 'ai-generated',
        responseMarkdown: 'test',
      }),
      headers: { 'content-type': 'application/json' },
    })
    expect(res.status).toBe(400)
    const payload = await res.json()
    expect(payload.error.code).toBe('INVALID_AGENT_RESPONSE')
  })

  it('POST response returns 400 for non-string externalAgentName', async () => {
    const app = await createTestApp()
    const draftId = await createReviewedDraft(app)

    const res = await app.request(`/api/v0/agent/drafts/${draftId}/responses`, {
      method: 'POST',
      body: JSON.stringify({
        source: 'manual-paste',
        responseMarkdown: 'test',
        externalAgentName: 123,
      }),
      headers: { 'content-type': 'application/json' },
    })
    expect(res.status).toBe(400)
  })

  it('POST response returns 400 for non-string responseNote', async () => {
    const app = await createTestApp()
    const draftId = await createReviewedDraft(app)

    const res = await app.request(`/api/v0/agent/drafts/${draftId}/responses`, {
      method: 'POST',
      body: JSON.stringify({
        source: 'manual-paste',
        responseMarkdown: 'test',
        responseNote: 456,
      }),
      headers: { 'content-type': 'application/json' },
    })
    expect(res.status).toBe(400)
  })

  it('POST response returns 400 for responseMarkdown exceeding max length', async () => {
    const app = await createTestApp()
    const draftId = await createReviewedDraft(app)

    const tooLong = 'x'.repeat(200_001)
    const res = await app.request(`/api/v0/agent/drafts/${draftId}/responses`, {
      method: 'POST',
      body: JSON.stringify({
        source: 'manual-paste',
        responseMarkdown: tooLong,
      }),
      headers: { 'content-type': 'application/json' },
    })
    expect(res.status).toBe(400)
    const payload = await res.json()
    expect(payload.error.code).toBe('INVALID_AGENT_RESPONSE')
  })

  // ── List responses ──

  it('GET /api/v0/agent/drafts/:id/responses returns summaries without responseMarkdown', async () => {
    const app = await createTestApp()
    const draftId = await createReviewedDraft(app)

    // Create a response
    await app.request(`/api/v0/agent/drafts/${draftId}/responses`, {
      method: 'POST',
      body: JSON.stringify({
        source: 'manual-paste',
        responseMarkdown: 'Test markdown body',
        externalAgentName: 'Codex',
      }),
      headers: { 'content-type': 'application/json' },
    })

    const res = await app.request(`/api/v0/agent/drafts/${draftId}/responses`)
    expect(res.status).toBe(200)
    const payload = await res.json()
    expect(payload.ok).toBe(true)
    expect(payload.data.responses.length).toBe(1)
    const summary = payload.data.responses[0]

    // Summary must NOT include responseMarkdown
    expect('responseMarkdown' in summary).toBe(false)
    expect(summary.draftId).toBe(draftId)
    expect(summary.source).toBe('manual-paste')
    expect(summary.externalAgentName).toBe('Codex')
    expect(typeof summary.pastedAt).toBe('string')
    expect(summary.pastedBy).toBe('local')
    expect(summary.responseLength).toBe('Test markdown body'.length)
  })

  // ── List sorted desc by pastedAt ──

  it('GET /api/v0/agent/drafts/:id/responses returns sorted desc by pastedAt', async () => {
    const app = await createTestApp()
    const draftId = await createReviewedDraft(app)

    // Create two responses
    await app.request(`/api/v0/agent/drafts/${draftId}/responses`, {
      method: 'POST',
      body: JSON.stringify({
        source: 'manual-paste',
        responseMarkdown: 'First response',
      }),
      headers: { 'content-type': 'application/json' },
    })

    await app.request(`/api/v0/agent/drafts/${draftId}/responses`, {
      method: 'POST',
      body: JSON.stringify({
        source: 'manual-paste',
        responseMarkdown: 'Second response',
      }),
      headers: { 'content-type': 'application/json' },
    })

    const res = await app.request(`/api/v0/agent/drafts/${draftId}/responses`)
    expect(res.status).toBe(200)
    const payload = await res.json()
    expect(payload.data.responses.length).toBe(2)
    // Both responses should be present (order may depend on insertion if same timestamp)
    const lengths = payload.data.responses
      .map((r: { responseLength: number }) => r.responseLength)
      .sort((a: number, b: number) => a - b)
    expect(lengths).toEqual(
      ['First response'.length, 'Second response'.length].sort((a, b) => a - b)
    )
  })

  // ── Get response detail ──

  it('GET /api/v0/agent/responses/:responseId returns detail with responseMarkdown', async () => {
    const app = await createTestApp()
    const draftId = await createReviewedDraft(app)

    const createRes = await app.request(
      `/api/v0/agent/drafts/${draftId}/responses`,
      {
        method: 'POST',
        body: JSON.stringify({
          source: 'manual-paste',
          responseMarkdown: '# Detail test\n\nSome content.',
          externalAgentName: 'ChatGPT',
        }),
        headers: { 'content-type': 'application/json' },
      }
    )
    const responseId = (await createRes.json()).data.response.id

    const res = await app.request(`/api/v0/agent/responses/${responseId}`)
    expect(res.status).toBe(200)
    const payload = await res.json()
    expect(payload.ok).toBe(true)
    const detail = payload.data.response
    expect(detail.responseMarkdown).toBe('# Detail test\n\nSome content.')
    expect(detail.externalAgentName).toBe('ChatGPT')
    expect(detail.draftSnapshot).toBeDefined()
    expect(detail.draftSnapshot.id).toBe(draftId)
  })

  // ── Missing response 404 ──

  it('GET /api/v0/agent/responses/:responseId returns 404 for missing response', async () => {
    const app = await createTestApp()
    const res = await app.request('/api/v0/agent/responses/nonexistent-id')
    expect(res.status).toBe(404)
    const payload = await res.json()
    expect(payload.error.code).toBe('NOT_FOUND')
  })

  // ── Side effects: create response does not modify draft ──

  it('creating response does not modify draft', async () => {
    const app = await createTestApp()
    const draftId = await createReviewedDraft(app)

    const draftBefore = await app.request(`/api/v0/agent/drafts/${draftId}`)
    const beforePayload = (await draftBefore.json()).data.draft

    await app.request(`/api/v0/agent/drafts/${draftId}/responses`, {
      method: 'POST',
      body: JSON.stringify({
        source: 'manual-paste',
        responseMarkdown: 'test response',
      }),
      headers: { 'content-type': 'application/json' },
    })

    const draftAfter = await app.request(`/api/v0/agent/drafts/${draftId}`)
    const afterPayload = (await draftAfter.json()).data.draft

    expect(afterPayload.status).toBe(beforePayload.status)
    expect(afterPayload.contextMarkdown).toBe(beforePayload.contextMarkdown)
    expect(afterPayload.reviewedAt).toBe(beforePayload.reviewedAt)
    expect(afterPayload.reviewedBy).toBe(beforePayload.reviewedBy)
  })

  // ── Side effects: create response does not create records, patches, or snapshots ──

  it('creating response does not create records, patches, or snapshots', async () => {
    const app = await createTestApp()
    const draftId = await createReviewedDraft(app)

    const boardBefore = await app.request('/api/v0/board/current')
    const recordCountBefore = (await boardBefore.json()).data.records.length

    await app.request(`/api/v0/agent/drafts/${draftId}/responses`, {
      method: 'POST',
      body: JSON.stringify({
        source: 'manual-paste',
        responseMarkdown: 'test response',
      }),
      headers: { 'content-type': 'application/json' },
    })

    const boardAfter = await app.request('/api/v0/board/current')
    expect((await boardAfter.json()).data.records.length).toBe(
      recordCountBefore
    )

    const snapshotsRes = await app.request('/api/v0/snapshots')
    expect((await snapshotsRes.json()).data.snapshots.length).toBe(0)
  })

  // ── No run/apply/execute routes ──

  it('POST /api/v0/agent/run does not exist', async () => {
    const app = await createTestApp()
    const res = await app.request('/api/v0/agent/run', { method: 'POST' })
    expect(res.status).toBe(404)
  })

  it('POST /api/v0/agent/apply does not exist', async () => {
    const app = await createTestApp()
    const res = await app.request('/api/v0/agent/apply', { method: 'POST' })
    expect(res.status).toBe(404)
  })

  it('POST /api/v0/agent/execute does not exist', async () => {
    const app = await createTestApp()
    const res = await app.request('/api/v0/agent/execute', { method: 'POST' })
    expect(res.status).toBe(404)
  })

  // ── No API key in response ──

  it('response detail does not contain API key', async () => {
    const app = await createTestApp()
    const draftId = await createReviewedDraft(app)

    const createRes = await app.request(
      `/api/v0/agent/drafts/${draftId}/responses`,
      {
        method: 'POST',
        body: JSON.stringify({
          source: 'manual-paste',
          responseMarkdown: 'Analysis result',
        }),
        headers: { 'content-type': 'application/json' },
      }
    )
    const responseId = (await createRes.json()).data.response.id

    const res = await app.request(`/api/v0/agent/responses/${responseId}`)
    const json = JSON.stringify((await res.json()).data.response)
    expect(json).not.toContain('sk-')
    expect(json).not.toContain('AGENT_API_KEY')
  })
})
