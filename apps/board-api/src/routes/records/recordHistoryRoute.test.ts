import { Hono } from 'hono'
import { DEFAULT_BOARD_CONFIG } from '@labour-board/shared'
import { describe, expect, it } from 'vitest'
import { MemoryRecordRepository } from '../../repositories/recordRepository.js'
import {
  MemorySnapshotHeadRepository,
  type StoredPatchDoc,
} from '../../repositories/snapshotHeadRepository.js'
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

function createAppWithRepo(): { app: Hono; repo: MemoryRecordRepository } {
  const repo = new MemoryRecordRepository()
  const service = new RecordService(
    repo,
    new MemorySnapshotHeadRepository(repo),
    structuredClone(DEFAULT_BOARD_CONFIG)
  )
  const app = new Hono()
  app.route('/api/v0/records', createRecordsRoute(service))
  return { app, repo }
}

function makeInjectedPatch(
  id: string,
  targetId: string,
  parentId: string | null,
  overrides?: Partial<StoredPatchDoc>
): StoredPatchDoc {
  return {
    id,
    pid: 'CARD-1',
    schema: 'CardBody',
    targetId,
    parentId,
    createdBy: 'local',
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('recordHistoryRoute', () => {
  it('returns 404 when record does not exist', async () => {
    const app = createApp()
    const response = await app.request('/api/v0/records/non-existent/history')
    expect(response.status).toBe(404)
    const payload = await response.json()
    expect(payload.ok).toBe(false)
    expect(payload.error.code).toBe('NOT_FOUND')
  })

  it('returns empty history when record has no patches', async () => {
    const app = createApp()
    const createResponse = await app.request('/api/v0/records', {
      method: 'POST',
      body: JSON.stringify({
        schema: 'CardBody',
        tags: ['status:todo'],
        body: { title: 'Empty history record' },
      }),
      headers: { 'content-type': 'application/json' },
    })
    const createPayload = await createResponse.json()
    const recordId = createPayload.data.body.id as string

    const response = await app.request(`/api/v0/records/${recordId}/history`)
    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload.ok).toBe(true)
    expect(payload.data.status).toBe('empty')
    expect(payload.data.patches).toEqual([])
    expect(payload.data.record).toHaveProperty('createdBy')
    expect(payload.data.record).toHaveProperty('createdAt')
    expect(payload.data.record.body.body.title).toBe('Empty history record')
  })

  it('returns complete history with one root patch', async () => {
    const app = createApp()
    const createResponse = await app.request('/api/v0/records', {
      method: 'POST',
      body: JSON.stringify({
        schema: 'CardBody',
        tags: ['status:todo'],
        body: { title: 'Single patch record' },
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
        description: 'First change',
      }),
      headers: { 'content-type': 'application/json' },
    })

    const response = await app.request(`/api/v0/records/${recordId}/history`)
    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload.ok).toBe(true)
    expect(payload.data.status).toBe('complete')
    expect(payload.data.patches).toHaveLength(1)
    expect(payload.data.patches[0].body.parentId).toBeNull()
    expect(payload.data.patches[0].body.tagChanges).toEqual({
      change: [{ namespace: 'status', from: 'status:todo', to: 'status:wip' }],
    })
  })

  it('returns ordered patches in parent chain order', async () => {
    const app = createApp()
    const createResponse = await app.request('/api/v0/records', {
      method: 'POST',
      body: JSON.stringify({
        schema: 'CardBody',
        tags: ['status:todo'],
        body: { title: 'Chained record' },
      }),
      headers: { 'content-type': 'application/json' },
    })
    const createPayload = await createResponse.json()
    const recordId = createPayload.data.body.id as string

    const p1Res = await app.request(`/api/v0/records/${recordId}/patches`, {
      method: 'POST',
      body: JSON.stringify({
        parentId: null,
        currentVersion: 0,
        body: { description: 'Patch 1' },
      }),
      headers: { 'content-type': 'application/json' },
    })
    const p1Payload = await p1Res.json()
    const p1Id = p1Payload.data.patch.body.id as string

    const p2Res = await app.request(`/api/v0/records/${recordId}/patches`, {
      method: 'POST',
      body: JSON.stringify({
        parentId: p1Id,
        currentVersion: 1,
        body: { description: 'Patch 2' },
      }),
      headers: { 'content-type': 'application/json' },
    })
    const p2Payload = await p2Res.json()
    const p2Id = p2Payload.data.patch.body.id as string

    const response = await app.request(`/api/v0/records/${recordId}/history`)
    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload.ok).toBe(true)
    expect(payload.data.status).toBe('complete')
    expect(payload.data.patches).toHaveLength(2)
    expect(payload.data.patches[0].body.id).toBe(p1Id)
    expect(payload.data.patches[1].body.id).toBe(p2Id)
    expect(payload.data.patches[0].body.parentId).toBeNull()
    expect(payload.data.patches[1].body.parentId).toBe(p1Id)
  })

  it('does not return board/current or snapshot projection in history', async () => {
    const app = createApp()
    const createResponse = await app.request('/api/v0/records', {
      method: 'POST',
      body: JSON.stringify({
        schema: 'CardBody',
        tags: ['status:todo'],
        body: { title: 'No current test' },
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

    const response = await app.request(`/api/v0/records/${recordId}/history`)
    const payload = await response.json()
    expect(payload.data).not.toHaveProperty('current')
    expect(payload.data).not.toHaveProperty('board')
    expect(payload.data).not.toHaveProperty('snapshotProjection')
  })

  it('history response does not modify record state', async () => {
    const app = createApp()
    const createResponse = await app.request('/api/v0/records', {
      method: 'POST',
      body: JSON.stringify({
        schema: 'CardBody',
        tags: ['status:todo'],
        body: { title: 'No side effect test' },
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

    const res1 = await app.request(`/api/v0/records/${recordId}/history`)
    const res2 = await app.request(`/api/v0/records/${recordId}/history`)
    expect(res1.status).toBe(200)
    expect(res2.status).toBe(200)
    const p1 = await res1.json()
    const p2 = await res2.json()
    expect(p1.data.status).toBe(p2.data.status)
    expect(p1.data.patches.length).toBe(p2.data.patches.length)

    const listResponse = await app.request('/api/v0/records')
    const listPayload = await listResponse.json()
    expect(listPayload.data).toHaveLength(1)
  })

  it('empty history response contains replay with base record state', async () => {
    const app = createApp()
    const createResponse = await app.request('/api/v0/records', {
      method: 'POST',
      body: JSON.stringify({
        schema: 'CardBody',
        tags: ['status:todo'],
        body: { title: 'Empty replay test' },
      }),
      headers: { 'content-type': 'application/json' },
    })
    const createPayload = await createResponse.json()
    const recordId = createPayload.data.body.id as string

    const response = await app.request(`/api/v0/records/${recordId}/history`)
    const payload = await response.json()
    expect(payload.data.status).toBe('empty')
    expect(payload.data.replay).toBeDefined()
    expect(payload.data.replay.steps).toEqual([])
    expect(payload.data.replay.finalState.id).toBe(recordId)
    expect(payload.data.replay.finalState.body.title).toBe('Empty replay test')
    expect(payload.data.replay.finalState).not.toHaveProperty('createdBy')
    expect(payload.data.replay.finalState).not.toHaveProperty('createdAt')
  })

  it('complete history response contains replay with cumulative patch effects', async () => {
    const app = createApp()
    const createResponse = await app.request('/api/v0/records', {
      method: 'POST',
      body: JSON.stringify({
        schema: 'CardBody',
        tags: ['status:todo'],
        body: { title: 'Replay route test', description: 'Base' },
      }),
      headers: { 'content-type': 'application/json' },
    })
    const createPayload = await createResponse.json()
    const recordId = createPayload.data.body.id as string

    const p1Res = await app.request(`/api/v0/records/${recordId}/patches`, {
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
    const p1Payload = await p1Res.json()
    const p1Id = p1Payload.data.patch.body.id as string

    await app.request(`/api/v0/records/${recordId}/patches`, {
      method: 'POST',
      body: JSON.stringify({
        parentId: p1Id,
        currentVersion: 1,
        body: { description: 'Updated via patch' },
      }),
      headers: { 'content-type': 'application/json' },
    })

    const response = await app.request(`/api/v0/records/${recordId}/history`)
    const payload = await response.json()
    expect(payload.data.status).toBe('complete')
    expect(payload.data.replay).toBeDefined()
    expect(payload.data.replay.steps).toHaveLength(2)
    expect(payload.data.replay.steps.length).toBe(payload.data.patches.length)
    expect(payload.data.replay.steps[0].state.tags).toEqual(['status:wip'])
    expect(payload.data.replay.steps[0].patch.body.id).toBe(p1Id)
    expect(payload.data.replay.steps[1].state.tags).toEqual(['status:wip'])
    expect(payload.data.replay.steps[1].state.body).toMatchObject({
      description: 'Updated via patch',
    })
    expect(payload.data.replay.finalState.tags).toEqual(['status:wip'])
    expect(payload.data.replay.finalState.body).toMatchObject({
      description: 'Updated via patch',
    })
    expect(payload.data.replay.finalState.body.title).toBe('Replay route test')
  })

  it('conflicted history (multi-root) returns status conflicted and no replay', async () => {
    const { app, repo } = createAppWithRepo()
    const createResponse = await app.request('/api/v0/records', {
      method: 'POST',
      body: JSON.stringify({
        schema: 'CardBody',
        tags: ['status:todo'],
        body: { title: 'Multi-root route test' },
      }),
      headers: { 'content-type': 'application/json' },
    })
    const createPayload = await createResponse.json()
    const recordId = createPayload.data.body.id as string

    await repo.appendPatch(makeInjectedPatch('patch-a', recordId, null))
    await repo.appendPatch(makeInjectedPatch('patch-b', recordId, null))

    const response = await app.request(`/api/v0/records/${recordId}/history`)
    const payload = await response.json()
    expect(payload.data.status).toBe('conflicted')
    expect(payload.data.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'MULTIPLE_ROOTS' }),
      ])
    )
    expect(payload.data.replay).toBeUndefined()
  })

  it('broken history (missing parent) returns status broken and no replay', async () => {
    const { app, repo } = createAppWithRepo()
    const createResponse = await app.request('/api/v0/records', {
      method: 'POST',
      body: JSON.stringify({
        schema: 'CardBody',
        tags: ['status:todo'],
        body: { title: 'Broken route test' },
      }),
      headers: { 'content-type': 'application/json' },
    })
    const createPayload = await createResponse.json()
    const recordId = createPayload.data.body.id as string

    await repo.appendPatch(makeInjectedPatch('patch-1', recordId, null))
    await repo.appendPatch(
      makeInjectedPatch('patch-2', recordId, 'non-existent-parent')
    )

    const response = await app.request(`/api/v0/records/${recordId}/history`)
    const payload = await response.json()
    expect(payload.data.status).toBe('broken')
    expect(payload.data.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'PARENT_MISSING' }),
      ])
    )
    expect(payload.data.replay).toBeUndefined()
  })

  it('archive patch appears in history with replay', async () => {
    const app = createApp()
    const createResponse = await app.request('/api/v0/records', {
      method: 'POST',
      body: JSON.stringify({
        schema: 'CardBody',
        tags: ['status:todo'],
        body: { title: 'Archive history test' },
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

    const response = await app.request(`/api/v0/records/${recordId}/history`)
    const payload = await response.json()
    expect(payload.data.status).toBe('complete')
    expect(payload.data.patches).toHaveLength(1)
    expect(payload.data.patches[0].body.parentId).toBeNull()
    expect(payload.data.patches[0].body.tagChanges).toEqual({
      add: ['status:archived'],
    })
    expect(payload.data.replay).toBeDefined()
    expect(payload.data.replay.finalState.tags).toContain('status:archived')
  })
})
