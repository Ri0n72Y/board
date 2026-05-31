import { Hono } from 'hono'
import { DEFAULT_BOARD_CONFIG } from '@labour-board/shared'
import { describe, expect, it } from 'vitest'
import { MemoryRecordRepository } from '../repositories/recordRepository.js'
import { MemorySnapshotHeadRepository } from '../repositories/snapshotHeadRepository.js'
import { RecordService } from '../services/recordService.js'
import { createRecordsRoute } from './records.js'
import { createSnapshotHeadRoute } from './snapshotHead.js'

function createApp(): Hono {
  const app = new Hono()
  const repo = new MemoryRecordRepository()
  const service = new RecordService(
    repo,
    new MemorySnapshotHeadRepository(repo),
    structuredClone(DEFAULT_BOARD_CONFIG)
  )
  app.route('/api/v0/records', createRecordsRoute(service))
  app.route('/api/v0/snapshot-head', createSnapshotHeadRoute(service))
  return app
}

async function createRecord(app: Hono): Promise<string> {
  const response = await app.request('/api/v0/records', {
    method: 'POST',
    body: JSON.stringify({
      schema: 'CardBody',
      tags: ['status:todo'],
      body: { title: 'Snapshot head route test' },
    }),
    headers: { 'content-type': 'application/json' },
  })
  const payload = await response.json()
  return payload.data.body.id as string
}

describe('createSnapshotHeadRoute', () => {
  it('returns initial snapshot head version 0', async () => {
    const app = createApp()

    const response = await app.request('/api/v0/snapshot-head')
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.data).toEqual({
      version: 0,
      records: {},
    })
  })

  it('returns version and lastPatchId after patch creation', async () => {
    const app = createApp()
    const recordId = await createRecord(app)

    const firstResponse = await app.request(
      `/api/v0/records/${recordId}/patches`,
      {
        method: 'POST',
        body: JSON.stringify({
          parentId: null,
          snapshotVersion: 0,
          tags: ['status:wip'],
        }),
        headers: { 'content-type': 'application/json' },
      }
    )
    const firstPayload = await firstResponse.json()

    const firstHeadResponse = await app.request('/api/v0/snapshot-head')
    const firstHeadPayload = await firstHeadResponse.json()
    expect(firstHeadPayload.data.version).toBe(1)
    expect(firstHeadPayload.data.records[recordId].lastPatchId).toBe(
      firstPayload.data.patch.body.id
    )

    const secondResponse = await app.request(
      `/api/v0/records/${recordId}/patches`,
      {
        method: 'POST',
        body: JSON.stringify({
          parentId: firstPayload.data.patch.body.id,
          snapshotVersion: 1,
          body: { description: 'Second patch' },
        }),
        headers: { 'content-type': 'application/json' },
      }
    )
    const secondPayload = await secondResponse.json()

    const secondHeadResponse = await app.request('/api/v0/snapshot-head')
    const secondHeadPayload = await secondHeadResponse.json()
    expect(secondHeadPayload.data.version).toBe(2)
    expect(secondHeadPayload.data.records[recordId].lastPatchId).toBe(
      secondPayload.data.patch.body.id
    )
  })
})
