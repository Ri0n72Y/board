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

async function createRecord(app: Hono): Promise<string> {
  const response = await app.request('/api/v0/records', {
    method: 'POST',
    body: JSON.stringify({
      schema: 'CardBody',
      tags: ['status:todo'],
      body: { title: 'Record head route test' },
    }),
    headers: { 'content-type': 'application/json' },
  })
  const payload = await response.json()
  return payload.data.body.id as string
}

describe('recordHeadRoute', () => {
  it('returns current head for a newly created base record', async () => {
    const app = createApp()
    const recordId = await createRecord(app)

    const response = await app.request(`/api/v0/records/${recordId}/head`)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.ok).toBe(true)
    expect(payload.data).toEqual({
      recordId,
      exists: true,
      currentVersion: 0,
      lastPatchId: null,
    })
  })

  it('returns 404 for a missing record head', async () => {
    const app = createApp()

    const response = await app.request('/api/v0/records/missing/head')
    const payload = await response.json()

    expect(response.status).toBe(404)
    expect(payload.ok).toBe(false)
    expect(payload.error.code).toBe('NOT_FOUND')
  })

  it('updates lastPatchId and currentVersion after patch creation', async () => {
    const app = createApp()
    const recordId = await createRecord(app)
    const headBeforeResponse = await app.request(
      `/api/v0/records/${recordId}/head`
    )
    const headBefore = await headBeforeResponse.json()

    const patchResponse = await app.request(
      `/api/v0/records/${recordId}/patches`,
      {
        method: 'POST',
        body: JSON.stringify({
          parentId: headBefore.data.lastPatchId,
          currentVersion: headBefore.data.currentVersion,
          tagChanges: {
            change: [
              { namespace: 'status', from: 'status:todo', to: 'status:wip' },
            ],
          },
        }),
        headers: { 'content-type': 'application/json' },
      }
    )
    const patchPayload = await patchResponse.json()
    expect(patchResponse.status).toBe(201)

    const headAfterResponse = await app.request(
      `/api/v0/records/${recordId}/head`
    )
    const headAfter = await headAfterResponse.json()

    expect(headAfter.data).toEqual({
      recordId,
      exists: true,
      currentVersion: 1,
      lastPatchId: patchPayload.data.patch.body.id,
    })
  })
})
