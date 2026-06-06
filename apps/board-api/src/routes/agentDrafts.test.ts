import { describe, expect, it } from 'vitest'
import { Hono } from 'hono'
import { ok } from '../http/responses.js'
import { loadApiEnv } from '../config/env.js'
import { createApiServices } from '../services/index.js'
import { mountApiRoutes } from '../routes/index.js'
import {
  buildAgentDraftHandoffMarkdown,
  AgentDraftHandoffValidationError,
  type AgentDraftDetail,
} from '@labour-board/shared'

async function createTestApp(): Promise<Hono> {
  const env = loadApiEnv({ BOARD_CONFIG_OPTIONAL: 'true' })
  const services = await createApiServices(env)
  const app = new Hono()
  app.get('/health', (c) => c.json(ok({ status: 'ok' })))
  mountApiRoutes(app, services)
  return app
}

describe('Agent Drafts route', () => {
  // ── Create draft: current-board agent-full ──

  it('POST /api/v0/agent/drafts creates current-board agent-full draft', async () => {
    const app = await createTestApp()

    const res = await app.request('/api/v0/agent/drafts', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Test full draft',
        profile: 'agent-full',
        source: 'current-board',
        contextGoal: 'Review test',
      }),
      headers: { 'content-type': 'application/json' },
    })
    expect(res.status).toBe(201)
    const payload = await res.json()
    expect(payload.ok).toBe(true)
    expect(payload.data.draft.title).toBe('Test full draft')
    expect(payload.data.draft.profile).toBe('agent-full')
    expect(payload.data.draft.source).toBe('current-board')
    expect(typeof payload.data.draft.contextMarkdown).toBe('string')
    expect(payload.data.draft.contextMarkdown.length).toBeGreaterThan(0)
    expect(payload.data.draft.recordCount).toBe(0)
    expect(payload.data.draft.status).toBe('draft')
  })

  // ── Create draft: current-board agent-filtered with filters ──

  it('POST /api/v0/agent/drafts creates agent-filtered draft with filters', async () => {
    const app = await createTestApp()

    const res = await app.request('/api/v0/agent/drafts', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Filtered draft',
        profile: 'agent-filtered',
        source: 'current-board',
        filters: {
          tags: ['sprint:1'],
          tagMatch: 'all',
          q: 'test',
        },
      }),
      headers: { 'content-type': 'application/json' },
    })
    expect(res.status).toBe(201)
    const payload = await res.json()
    expect(payload.ok).toBe(true)
    expect(payload.data.draft.profile).toBe('agent-filtered')
    // exportOptions.filters should be preserved
    expect(payload.data.draft.exportOptions.filters).toBeDefined()
    expect(payload.data.draft.exportOptions.filters.tags).toEqual(['sprint:1'])
    expect(payload.data.draft.exportOptions.filters.tagMatch).toBe('all')
    expect(payload.data.draft.exportOptions.filters.q).toBe('test')
    // recordCount should be a number
    expect(typeof payload.data.draft.recordCount).toBe('number')
  })

  // ── Create draft: invalid profile 400 ──

  it('POST /api/v0/agent/drafts returns 400 for invalid profile', async () => {
    const app = await createTestApp()
    const res = await app.request('/api/v0/agent/drafts', {
      method: 'POST',
      body: JSON.stringify({
        title: 'bad',
        profile: 'invalid-profile',
        source: 'current-board',
      }),
      headers: { 'content-type': 'application/json' },
    })
    expect(res.status).toBe(400)
  })

  // ── current-board + agent-snapshot 400 ──

  it('POST /api/v0/agent/drafts returns 400 for current-board + agent-snapshot', async () => {
    const app = await createTestApp()
    const res = await app.request('/api/v0/agent/drafts', {
      method: 'POST',
      body: JSON.stringify({
        title: 'bad',
        profile: 'agent-snapshot',
        source: 'current-board',
      }),
      headers: { 'content-type': 'application/json' },
    })
    expect(res.status).toBe(400)
  })

  // ── snapshot source missing snapshotId 400 ──

  it('POST /api/v0/agent/drafts returns 400 for snapshot source without snapshotId', async () => {
    const app = await createTestApp()
    const res = await app.request('/api/v0/agent/drafts', {
      method: 'POST',
      body: JSON.stringify({
        title: 'bad',
        profile: 'agent-full',
        source: 'snapshot',
      }),
      headers: { 'content-type': 'application/json' },
    })
    expect(res.status).toBe(400)
  })

  // ── agent-card missing recordId 400 ──

  it('POST /api/v0/agent/drafts returns 400 for agent-card without recordId', async () => {
    const app = await createTestApp()
    const res = await app.request('/api/v0/agent/drafts', {
      method: 'POST',
      body: JSON.stringify({
        title: 'bad',
        profile: 'agent-card',
        source: 'current-board',
      }),
      headers: { 'content-type': 'application/json' },
    })
    expect(res.status).toBe(400)
  })

  // ── agent-sprint missing sprintTag 400 ──

  it('POST /api/v0/agent/drafts returns 400 for agent-sprint without sprintTag', async () => {
    const app = await createTestApp()
    const res = await app.request('/api/v0/agent/drafts', {
      method: 'POST',
      body: JSON.stringify({
        title: 'bad',
        profile: 'agent-sprint',
        source: 'current-board',
      }),
      headers: { 'content-type': 'application/json' },
    })
    expect(res.status).toBe(400)
  })

  // ── invalid filters 400 ──

  it('POST /api/v0/agent/drafts returns 400 for invalid filters', async () => {
    const app = await createTestApp()
    const res = await app.request('/api/v0/agent/drafts', {
      method: 'POST',
      body: JSON.stringify({
        title: 'bad filters',
        profile: 'agent-full',
        source: 'current-board',
        filters: { tagMatch: 'invalid' },
      }),
      headers: { 'content-type': 'application/json' },
    })
    expect(res.status).toBe(400)
  })

  // ── List drafts returns summary ──

  it('GET /api/v0/agent/drafts returns summaries without contextMarkdown', async () => {
    const app = await createTestApp()
    // Create a draft first
    await app.request('/api/v0/agent/drafts', {
      method: 'POST',
      body: JSON.stringify({
        title: 'List test',
        profile: 'agent-full',
        source: 'current-board',
      }),
      headers: { 'content-type': 'application/json' },
    })

    const res = await app.request('/api/v0/agent/drafts')
    expect(res.status).toBe(200)
    const payload = await res.json()
    expect(payload.ok).toBe(true)
    expect(payload.data.drafts.length).toBeGreaterThanOrEqual(1)
    const summary = payload.data.drafts[0]
    expect(summary.title).toBeDefined()
    expect(summary.id).toBeDefined()
    // Summary must NOT include contextMarkdown
    expect('contextMarkdown' in summary).toBe(false)
  })

  // ── Get draft detail returns Markdown ──

  it('GET /api/v0/agent/drafts/:id returns detail with contextMarkdown', async () => {
    const app = await createTestApp()
    const createRes = await app.request('/api/v0/agent/drafts', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Detail test',
        profile: 'agent-full',
        source: 'current-board',
      }),
      headers: { 'content-type': 'application/json' },
    })
    const draftId = (await createRes.json()).data.draft.id

    const res = await app.request(`/api/v0/agent/drafts/${draftId}`)
    expect(res.status).toBe(200)
    const payload = await res.json()
    expect(payload.ok).toBe(true)
    expect(payload.data.draft.contextMarkdown).toBeDefined()
    expect(typeof payload.data.draft.contextMarkdown).toBe('string')
    expect(payload.data.draft.contextMarkdown.length).toBeGreaterThan(0)
  })

  // ── Missing draft 404 ──

  it('GET /api/v0/agent/drafts/:id returns 404 for missing draft', async () => {
    const app = await createTestApp()
    const res = await app.request('/api/v0/agent/drafts/nonexistent-id')
    expect(res.status).toBe(404)
  })

  // ── Missing snapshot 404 ──

  it('POST /api/v0/agent/drafts returns 404 for missing snapshot', async () => {
    const app = await createTestApp()
    const res = await app.request('/api/v0/agent/drafts', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Missing snapshot',
        profile: 'agent-full',
        source: 'snapshot',
        snapshotId: 'nonexistent-snapshot',
      }),
      headers: { 'content-type': 'application/json' },
    })
    expect(res.status).toBe(404)
  })

  // ── Draft contextMarkdown contains Agent Reading Instructions ──

  it('draft contextMarkdown contains Agent Reading Instructions and non-execution', async () => {
    const app = await createTestApp()
    const createRes = await app.request('/api/v0/agent/drafts', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Auth test',
        profile: 'agent-full',
        source: 'current-board',
      }),
      headers: { 'content-type': 'application/json' },
    })
    const detailRes = await app.request(
      `/api/v0/agent/drafts/${(await createRes.json()).data.draft.id}`,
    )
    const markdown = (await detailRes.json()).data.draft.contextMarkdown as string
    expect(markdown).toContain('Agent Reading Instructions')
    expect(markdown).toContain('not execution authorization')
    expect(markdown).toContain('Keep relation targets as UUID')
  })

  // ── Draft static after board changes ──

  it('draft contextMarkdown is static after board changes', async () => {
    const app = await createTestApp()
    const createRes = await app.request('/api/v0/agent/drafts', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Static test',
        profile: 'agent-full',
        source: 'current-board',
      }),
      headers: { 'content-type': 'application/json' },
    })
    const draftId = (await createRes.json()).data.draft.id

    // Get original markdown
    const beforeRes = await app.request(`/api/v0/agent/drafts/${draftId}`)
    const beforeMarkdown = (await beforeRes.json()).data.draft.contextMarkdown

    // Modify board
    await app.request('/api/v0/records', {
      method: 'POST',
      body: JSON.stringify({
        schema: 'CardBody',
        tags: ['status:todo'],
        body: { title: 'Record after draft' },
      }),
      headers: { 'content-type': 'application/json' },
    })

    // Draft should be unchanged
    const afterRes = await app.request(`/api/v0/agent/drafts/${draftId}`)
    const afterMarkdown = (await afterRes.json()).data.draft.contextMarkdown
    expect(afterMarkdown).toBe(beforeMarkdown)
  })

  // ── Create draft does not create record/patch/snapshot ──

  it('creating draft does not create records, patches, or snapshots', async () => {
    const app = await createTestApp()
    const beforeBoard = await app.request('/api/v0/board/current')
    const beforeRecordCount = (await beforeBoard.json()).data.records.length

    await app.request('/api/v0/agent/drafts', {
      method: 'POST',
      body: JSON.stringify({
        title: 'No side effects',
        profile: 'agent-full',
        source: 'current-board',
      }),
      headers: { 'content-type': 'application/json' },
    })

    const afterBoard = await app.request('/api/v0/board/current')
    const afterRecordCount = (await afterBoard.json()).data.records.length
    expect(afterRecordCount).toBe(beforeRecordCount)

    // No snapshots created
    const snapshotsRes = await app.request('/api/v0/snapshots')
    const snapshotCount = (await snapshotsRes.json()).data.snapshots.length
    expect(snapshotCount).toBe(0)
  })

  // ── No fake API key in draft ──

  it('draft does not contain fake AGENT_API_KEY', async () => {
    const app = await createTestApp()
    const createRes = await app.request('/api/v0/agent/drafts', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Key test',
        profile: 'agent-full',
        source: 'current-board',
      }),
      headers: { 'content-type': 'application/json' },
    })
    const detailRes = await app.request(
      `/api/v0/agent/drafts/${(await createRes.json()).data.draft.id}`,
    )
    const payload = await detailRes.json()
    const json = JSON.stringify(payload.data.draft)
    expect(json).not.toContain('sk-')
    expect(json).not.toContain('AGENT_API_KEY')
  })

  // ── No run/execute/apply route ──

  it('POST /api/v0/agent/run does not exist', async () => {
    const app = await createTestApp()
    const res = await app.request('/api/v0/agent/run', { method: 'POST' })
    expect(res.status).toBe(404)
  })

  it('POST /api/v0/agent/execute does not exist', async () => {
    const app = await createTestApp()
    const res = await app.request('/api/v0/agent/execute', { method: 'POST' })
    expect(res.status).toBe(404)
  })

  it('POST /api/v0/agent/apply does not exist', async () => {
    const app = await createTestApp()
    const res = await app.request('/api/v0/agent/apply', { method: 'POST' })
    expect(res.status).toBe(404)
  })
})

describe('Agent Draft Review Actions', () => {
  // ── PATCH reviewed ──

  it('PATCH /api/v0/agent/drafts/:id/review marks draft as reviewed', async () => {
    const app = await createTestApp()
    const createRes = await app.request('/api/v0/agent/drafts', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Review test',
        profile: 'agent-full',
        source: 'current-board',
      }),
      headers: { 'content-type': 'application/json' },
    })
    const draftId = (await createRes.json()).data.draft.id

    const patchRes = await app.request(`/api/v0/agent/drafts/${draftId}/review`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: 'reviewed',
        reviewNote: 'Looks good',
      }),
      headers: { 'content-type': 'application/json' },
    })
    expect(patchRes.status).toBe(200)
    const payload = await patchRes.json()
    expect(payload.ok).toBe(true)
    expect(payload.data.draft.status).toBe('reviewed')
    expect(payload.data.draft.reviewedAt).toBeDefined()
    expect(payload.data.draft.reviewedBy).toBe('local')
    expect(payload.data.draft.reviewNote).toBe('Looks good')
    // contextMarkdown unchanged
    expect(typeof payload.data.draft.contextMarkdown).toBe('string')
  })

  // ── PATCH discarded ──

  it('PATCH discarded marks draft as discarded', async () => {
    const app = await createTestApp()
    const createRes = await app.request('/api/v0/agent/drafts', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Discard test',
        profile: 'agent-full',
        source: 'current-board',
      }),
      headers: { 'content-type': 'application/json' },
    })
    const draftId = (await createRes.json()).data.draft.id

    await app.request(`/api/v0/agent/drafts/${draftId}/review`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'discarded' }),
      headers: { 'content-type': 'application/json' },
    })

    // List summary shows discarded
    const listRes = await app.request('/api/v0/agent/drafts')
    const listPayload = await listRes.json()
    const discarded = listPayload.data.drafts.find((d: { id: string }) => d.id === draftId)
    expect(discarded.status).toBe('discarded')
    expect(discarded.reviewedAt).toBeDefined()
  })

  // ── PATCH reset to draft ──

  it('PATCH draft reset clears reviewedAt/reviewedBy', async () => {
    const app = await createTestApp()
    const createRes = await app.request('/api/v0/agent/drafts', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Reset test',
        profile: 'agent-full',
        source: 'current-board',
      }),
      headers: { 'content-type': 'application/json' },
    })
    const draftId = (await createRes.json()).data.draft.id

    // First mark as reviewed
    await app.request(`/api/v0/agent/drafts/${draftId}/review`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'reviewed', reviewNote: 'old note' }),
      headers: { 'content-type': 'application/json' },
    })

    // Then reset to draft, keep reviewNote
    const resetRes = await app.request(`/api/v0/agent/drafts/${draftId}/review`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'draft', reviewNote: 'reset note' }),
      headers: { 'content-type': 'application/json' },
    })
    const payload = await resetRes.json()
    expect(payload.data.draft.status).toBe('draft')
    expect(payload.data.draft.reviewedAt).toBeUndefined()
    expect(payload.data.draft.reviewedBy).toBeUndefined()
    expect(payload.data.draft.reviewNote).toBe('reset note')
  })

  // ── Invalid status 400 ──

  it('PATCH invalid status returns 400', async () => {
    const app = await createTestApp()
    const createRes = await app.request('/api/v0/agent/drafts', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Bad status',
        profile: 'agent-full',
        source: 'current-board',
      }),
      headers: { 'content-type': 'application/json' },
    })
    const draftId = (await createRes.json()).data.draft.id

    const res = await app.request(`/api/v0/agent/drafts/${draftId}/review`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'invalid-status' }),
      headers: { 'content-type': 'application/json' },
    })
    expect(res.status).toBe(400)
  })

  // ── Missing draft 404 ──

  it('PATCH missing draft returns 404', async () => {
    const app = await createTestApp()
    const res = await app.request('/api/v0/agent/drafts/nonexistent/review', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'reviewed' }),
      headers: { 'content-type': 'application/json' },
    })
    expect(res.status).toBe(404)
  })

  // ── Invalid body 400 ──

  it('PATCH with non-JSON body returns 400', async () => {
    const app = await createTestApp()
    const res = await app.request('/api/v0/agent/drafts/some-id/review', {
      method: 'PATCH',
      body: 'not json',
      headers: { 'content-type': 'text/plain' },
    })
    expect(res.status).toBe(400)
  })

  // ── PATCH does not create records/patches/snapshots ──

  it('PATCH review does not create records, patches, or snapshots', async () => {
    const app = await createTestApp()
    const createRes = await app.request('/api/v0/agent/drafts', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Side effect test',
        profile: 'agent-full',
        source: 'current-board',
      }),
      headers: { 'content-type': 'application/json' },
    })
    const draftId = (await createRes.json()).data.draft.id

    const boardBefore = await app.request('/api/v0/board/current')
    const recordCountBefore = (await boardBefore.json()).data.records.length

    await app.request(`/api/v0/agent/drafts/${draftId}/review`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'reviewed' }),
      headers: { 'content-type': 'application/json' },
    })

    const boardAfter = await app.request('/api/v0/board/current')
    expect((await boardAfter.json()).data.records.length).toBe(recordCountBefore)

    const snapshotsRes = await app.request('/api/v0/snapshots')
    expect((await snapshotsRes.json()).data.snapshots.length).toBe(0)
  })

  // ── PATCH preserves contextMarkdown ──

  it('PATCH review preserves contextMarkdown', async () => {
    const app = await createTestApp()
    const createRes = await app.request('/api/v0/agent/drafts', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Markdown test',
        profile: 'agent-full',
        source: 'current-board',
      }),
      headers: { 'content-type': 'application/json' },
    })
    const createPayload = await createRes.json()
    const draftId = createPayload.data.draft.id
    const originalMd = createPayload.data.draft.contextMarkdown

    await app.request(`/api/v0/agent/drafts/${draftId}/review`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'reviewed', reviewNote: 'test' }),
      headers: { 'content-type': 'application/json' },
    })

    const detailRes = await app.request(`/api/v0/agent/drafts/${draftId}`)
    expect((await detailRes.json()).data.draft.contextMarkdown).toBe(originalMd)
  })

  // ── No API key in review response ──

  it('PATCH review response does not contain API key', async () => {
    const app = await createTestApp()
    const createRes = await app.request('/api/v0/agent/drafts', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Key test',
        profile: 'agent-full',
        source: 'current-board',
      }),
      headers: { 'content-type': 'application/json' },
    })
    const draftId = (await createRes.json()).data.draft.id

    const patchRes = await app.request(`/api/v0/agent/drafts/${draftId}/review`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'reviewed' }),
      headers: { 'content-type': 'application/json' },
    })
    const json = JSON.stringify((await patchRes.json()).data.draft)
    expect(json).not.toContain('sk-')
    expect(json).not.toContain('AGENT_API_KEY')
  })
})

describe('Agent Draft Handoff', () => {
  // ── GET handoff success ──

  it('GET /api/v0/agent/drafts/:id/handoff returns formal handoff for reviewed draft', async () => {
    const app = await createTestApp()
    const createRes = await app.request('/api/v0/agent/drafts', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Handoff test draft',
        profile: 'agent-full',
        source: 'current-board',
        contextGoal: 'Review and handoff',
      }),
      headers: { 'content-type': 'application/json' },
    })
    const draftId = (await createRes.json()).data.draft.id

    // Mark as reviewed
    await app.request(`/api/v0/agent/drafts/${draftId}/review`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'reviewed', reviewNote: 'Approved for handoff' }),
      headers: { 'content-type': 'application/json' },
    })

    const res = await app.request(`/api/v0/agent/drafts/${draftId}/handoff`)
    expect(res.status).toBe(200)
    const payload = await res.json()
    expect(payload.ok).toBe(true)
    expect(payload.data.handoff).toBeDefined()
    expect(payload.data.handoff.format).toBe('markdown')
    expect(typeof payload.data.handoff.content).toBe('string')
    expect(payload.data.handoff.content).toContain('LabourBoard Agent Manual Handoff')
    expect(payload.data.handoff.content).toContain('not execution authorization')
    expect(payload.data.handoff.content).toContain('not execution authorization')
    expect(payload.data.handoff.content).toContain('## Original Agent Context Pack')
    expect(payload.data.handoff.content).toContain('Handoff Metadata')
    expect(payload.data.handoff.content).toContain('Reviewed By')
    expect(payload.data.handoff.content).toContain('Reviewed At')
    expect(typeof payload.data.handoff.filename).toBe('string')
    expect(payload.data.handoff.filename).toContain('agent-handoff')
    expect(payload.data.handoff.meta.status).toBe('reviewed')
    expect(payload.data.handoff.meta.draftId).toBe(draftId)
    expect(payload.data.handoff.meta.draftTitle).toBe('Handoff test draft')
    expect(payload.data.handoff.meta.reviewedBy).toBe('local')
    expect(typeof payload.data.handoff.meta.reviewedAt).toBe('string')
    expect(payload.data.handoff.meta.recordCount).toBe(0)
  })

  // ── GET handoff draft status 409 ──

  it('GET /api/v0/agent/drafts/:id/handoff returns 409 for draft status', async () => {
    const app = await createTestApp()
    const createRes = await app.request('/api/v0/agent/drafts', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Unreviewed draft',
        profile: 'agent-full',
        source: 'current-board',
      }),
      headers: { 'content-type': 'application/json' },
    })
    const draftId = (await createRes.json()).data.draft.id

    const res = await app.request(`/api/v0/agent/drafts/${draftId}/handoff`)
    expect(res.status).toBe(409)
    const payload = await res.json()
    expect(payload.ok).toBe(false)
    expect(payload.error.code).toBe('HANDOFF_NOT_READY')
  })

  // ── GET handoff discarded status 409 ──

  it('GET /api/v0/agent/drafts/:id/handoff returns 409 for discarded draft', async () => {
    const app = await createTestApp()
    const createRes = await app.request('/api/v0/agent/drafts', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Discarded draft',
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

    const res = await app.request(`/api/v0/agent/drafts/${draftId}/handoff`)
    expect(res.status).toBe(409)
    const payload = await res.json()
    expect(payload.ok).toBe(false)
    expect(payload.error.code).toBe('HANDOFF_NOT_READY')
  })

  // ── missing draft 404 ──

  it('GET /api/v0/agent/drafts/:id/handoff returns 404 for missing draft', async () => {
    const app = await createTestApp()
    const res = await app.request('/api/v0/agent/drafts/nonexistent-id/handoff')
    expect(res.status).toBe(404)
  })

  // ── no side effects ──

  it('GET handoff does not modify draft, records, patches, or snapshots', async () => {
    const app = await createTestApp()
    const createRes = await app.request('/api/v0/agent/drafts', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Side effect test',
        profile: 'agent-full',
        source: 'current-board',
      }),
      headers: { 'content-type': 'application/json' },
    })
    const draftId = (await createRes.json()).data.draft.id

    // Mark as reviewed
    await app.request(`/api/v0/agent/drafts/${draftId}/review`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'reviewed' }),
      headers: { 'content-type': 'application/json' },
    })

    // Get draft before handoff
    const beforeRes = await app.request(`/api/v0/agent/drafts/${draftId}`)
    const beforeDraft = (await beforeRes.json()).data.draft

    const boardBefore = await app.request('/api/v0/board/current')
    const recordCountBefore = (await boardBefore.json()).data.records.length

    // Call handoff
    await app.request(`/api/v0/agent/drafts/${draftId}/handoff`)

    // Draft unchanged
    const afterRes = await app.request(`/api/v0/agent/drafts/${draftId}`)
    const afterDraft = (await afterRes.json()).data.draft
    expect(afterDraft.status).toBe(beforeDraft.status)
    expect(afterDraft.contextMarkdown).toBe(beforeDraft.contextMarkdown)
    expect(afterDraft.reviewedAt).toBe(beforeDraft.reviewedAt)
    expect(afterDraft.reviewedBy).toBe(beforeDraft.reviewedBy)

    // No records created
    const boardAfter = await app.request('/api/v0/board/current')
    expect((await boardAfter.json()).data.records.length).toBe(recordCountBefore)

    // No snapshots created
    const snapshotsRes = await app.request('/api/v0/snapshots')
    expect((await snapshotsRes.json()).data.snapshots.length).toBe(0)
  })

  // ── No API key in handoff ──

  it('handoff markdown does not contain API key', async () => {
    const app = await createTestApp()
    const createRes = await app.request('/api/v0/agent/drafts', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Key check',
        profile: 'agent-full',
        source: 'current-board',
      }),
      headers: { 'content-type': 'application/json' },
    })
    const draftId = (await createRes.json()).data.draft.id

    await app.request(`/api/v0/agent/drafts/${draftId}/review`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'reviewed' }),
      headers: { 'content-type': 'application/json' },
    })

    const res = await app.request(`/api/v0/agent/drafts/${draftId}/handoff`)
    const handoff = (await res.json()).data.handoff
    const json = JSON.stringify(handoff)
    // Real API keys (sk-…) must not appear. Safety instructions mentioning AGENT_API_KEY are allowed.
    expect(json).not.toContain('sk-')
  })
})

describe('buildAgentDraftHandoffMarkdown (shared purity)', () => {
  function makeMockDraft(overrides: Partial<AgentDraftDetail> = {}): AgentDraftDetail {
    return {
      id: 'test-id-123',
      title: 'Test Draft',
      status: 'reviewed',
      profile: 'agent-full',
      source: 'current-board',
      createdAt: new Date().toISOString(),
      createdBy: 'test-user',
      recordCount: 5,
      reviewedAt: new Date().toISOString(),
      reviewedBy: 'reviewer',
      reviewNote: 'Looks good',
      contextMarkdown: '# Original content\n\nSome markdown.',
      contextMeta: {
        source: 'current-board',
        level: 'full',
        recordCount: 5,
        generatedAt: new Date().toISOString(),
        profile: 'agent-full',
      },
      exportOptions: {
        source: 'current-board',
        profile: 'agent-full',
        format: 'markdown',
        includeContent: true,
        includeAssets: true,
        includeRelations: false,
        includeDiagnostics: false,
      },
      ...overrides,
    }
  }

  it('generates stable markdown output', () => {
    const draft = makeMockDraft()
    const result = buildAgentDraftHandoffMarkdown(draft)
    expect(result.format).toBe('markdown')
    expect(result.content).toContain('LabourBoard Agent Manual Handoff')
    expect(result.content).toContain('not execution authorization')
    expect(result.content).toContain('Do not mutate LabourBoard directly')
    expect(result.content).toContain('Do not assume API write permission')
    expect(result.content).toContain(draft.reviewedAt!)
    expect(result.content).toContain(draft.reviewedBy!)
    expect(result.content).toContain(draft.contextMarkdown)
    expect(result.content).toContain('## Original Agent Context Pack')
    expect(result.filename).toContain('agent-handoff')
    expect(result.meta.draftId).toBe(draft.id)
    expect(result.meta.status).toBe('reviewed')
  })

  it('throws for non-reviewed draft', () => {
    const draft = makeMockDraft({ status: 'draft' })
    expect(() => buildAgentDraftHandoffMarkdown(draft)).toThrow(
      AgentDraftHandoffValidationError,
    )
  })

  it('throws for discarded draft', () => {
    const draft = makeMockDraft({ status: 'discarded' })
    expect(() => buildAgentDraftHandoffMarkdown(draft)).toThrow(
      AgentDraftHandoffValidationError,
    )
  })

  it('throws when missing reviewedAt', () => {
    const draft = makeMockDraft({ reviewedAt: undefined })
    expect(() => buildAgentDraftHandoffMarkdown(draft)).toThrow(
      AgentDraftHandoffValidationError,
    )
  })

  it('throws when missing reviewedBy', () => {
    const draft = makeMockDraft({ reviewedBy: undefined })
    expect(() => buildAgentDraftHandoffMarkdown(draft)).toThrow(
      AgentDraftHandoffValidationError,
    )
  })

  it('does not mutate input draft', () => {
    const draft = makeMockDraft()
    const snapshot = JSON.stringify(draft)
    buildAgentDraftHandoffMarkdown(draft)
    expect(JSON.stringify(draft)).toBe(snapshot)
  })

  it('does not contain API key pattern in output', () => {
    const draft = makeMockDraft()
    const result = buildAgentDraftHandoffMarkdown(draft)
    // Safety instructions mention AGENT_API_KEY as a warning – that is allowed.
    // Real API keys (sk-…) must not appear.
    expect(result.content).not.toContain('sk-')
    const json = JSON.stringify(result)
    expect(json).not.toContain('sk-')
  })

  it('includes review note in output', () => {
    const draft = makeMockDraft({ reviewNote: 'Ready for agent handoff' })
    const result = buildAgentDraftHandoffMarkdown(draft)
    expect(result.content).toContain('Ready for agent handoff')
  })

  it('includes expected agent behavior instructions', () => {
    const draft = makeMockDraft()
    const result = buildAgentDraftHandoffMarkdown(draft)
    expect(result.content).toContain('Expected Agent Behavior')
    expect(result.content).toContain('Do not output secrets')
    expect(result.content).toContain('Do not request or expose AGENT_API_KEY')
    expect(result.content).toContain('Do not claim any patch was applied')
  })
})
