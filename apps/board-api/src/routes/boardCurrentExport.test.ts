import { Hono } from 'hono'
import type { BoardCurrentProjection } from '@labour-board/shared'
import { buildBoardMarkdownExport } from '@labour-board/shared'
import { describe, expect, it } from 'vitest'
import { MemoryRecordRepository } from '../repositories/recordRepository.js'
import { MemorySnapshotHeadRepository } from '../repositories/snapshotHeadRepository.js'
import { createBoardCurrentExportRoute } from './boardCurrentExport.js'

function createAppWithSeededBoard() {
  const repo = new MemoryRecordRepository()
  const head = new MemorySnapshotHeadRepository(repo)
  const app = new Hono()
  app.route('/api/v0/board', createBoardCurrentExportRoute(repo, head))
  return { app, repo }
}

describe('GET /api/v0/board/current/export', () => {
  it('exports current board full markdown with agent-readable sections', async () => {
    const { app, repo } = createAppWithSeededBoard()
    await seedBoard(repo)

    const response = await app.request('/api/v0/board/current/export')
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.ok).toBe(true)
    expect(payload.data.filename).toMatch(/current-board-full-.*\.md/)
    expect(payload.data.content).toContain('# LabourBoard Current Board Export')
    expect(payload.data.content).toContain('## Export Metadata')
    expect(payload.data.content).toContain('## Board Summary')
    expect(payload.data.content).toContain('## Status Overview')
    expect(payload.data.content).toContain('## Records By Status')
    expect(payload.data.content).toContain('CARD-1')
    expect(payload.data.content).toContain('record-1')
    expect(payload.data.content).toContain('status:todo')
    expect(payload.data.content).toContain('asset:deck')
    expect(payload.data.content).toContain('dependsOn:record-2')
    expect(payload.data.content).toContain('Implementation details')
    expect(payload.data.meta.recordCount).toBe(2)
  })

  it('exports summary markdown without full content by default', async () => {
    const { app, repo } = createAppWithSeededBoard()
    await seedBoard(repo)

    const response = await app.request('/api/v0/board/current/export?level=summary')
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.data.content).toContain('- Level: summary')
    expect(payload.data.content).toContain('CARD-1')
    expect(payload.data.content).not.toContain('Implementation details')
  })

  it('exports a single card by recordId', async () => {
    const { app, repo } = createAppWithSeededBoard()
    await seedBoard(repo)

    const response = await app.request(
      '/api/v0/board/current/export?level=card&recordId=record-1'
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.data.meta.recordCount).toBe(1)
    expect(payload.data.content).toContain('CARD-1')
    expect(payload.data.content).not.toContain('CARD-2')
  })

  it('exports sprint and filtered markdown', async () => {
    const { app, repo } = createAppWithSeededBoard()
    await seedBoard(repo)

    const sprint = await app.request(
      '/api/v0/board/current/export?level=sprint&sprintTag=sprint:1'
    )
    const sprintPayload = await sprint.json()
    expect(sprint.status).toBe(200)
    expect(sprintPayload.data.content).toContain('## Sprint Export: sprint:1')
    expect(sprintPayload.data.meta.recordCount).toBe(1)

    const filtered = await app.request(
      '/api/v0/board/current/export?level=filtered&q=Second'
    )
    const filteredPayload = await filtered.json()
    expect(filtered.status).toBe(200)
    expect(filteredPayload.data.content).toContain('- Filters:')
    expect(filteredPayload.data.content).toContain('CARD-2')
    expect(filteredPayload.data.content).not.toContain('CARD-1')
  })

  it('exports related records and meta level', async () => {
    const { app, repo } = createAppWithSeededBoard()
    await seedBoard(repo)

    const related = await app.request(
      '/api/v0/board/current/export?level=related&recordId=record-1'
    )
    const relatedPayload = await related.json()
    expect(related.status).toBe(200)
    expect(relatedPayload.data.content).toContain('CARD-1')
    expect(relatedPayload.data.content).toContain('CARD-2')
    expect(relatedPayload.data.content).toContain('CARD-1 dependsOn record-2')

    const meta = await app.request('/api/v0/board/current/export?level=meta')
    const metaPayload = await meta.json()
    expect(meta.status).toBe(200)
    expect(metaPayload.data.content).toContain('## Board Summary')
    expect(metaPayload.data.content).not.toContain('## Records By Status')
  })

  it('returns 400 for invalid export combinations', async () => {
    const { app } = createAppWithSeededBoard()

    const missingCard = await app.request('/api/v0/board/current/export?level=card')
    expect(missingCard.status).toBe(400)

    const missingSprint = await app.request('/api/v0/board/current/export?level=sprint')
    expect(missingSprint.status).toBe(400)

    const invalidLevel = await app.request('/api/v0/board/current/export?level=bad')
    expect(invalidLevel.status).toBe(400)
  })

  it('builder does not mutate input projection', () => {
    const projection: BoardCurrentProjection = {
      snapshotHeadVersion: 0,
      records: [
        {
          createdBy: 'local',
          createdAt: '2026-06-05T00:00:00.000Z',
          body: {
            id: 'record-1',
            pid: 'CARD-1',
            schema: 'CardBody',
            body: { title: 'Immutable' },
            tags: ['status:todo'],
            assets: [],
            relations: [],
          },
        },
      ],
      blockedRecords: [],
      summary: {
        totalBaseRecords: 1,
        visibleCurrentRecords: 1,
        archivedRecords: 0,
        blockedRecords: 0,
        projectionStatus: 'clean',
      },
    }
    const before = structuredClone(projection)

    buildBoardMarkdownExport(projection, {
      source: 'current-board',
      level: 'full',
      format: 'markdown',
      generatedAt: '2026-06-05T00:00:00.000Z',
    })

    expect(projection).toEqual(before)
  })
})

async function seedBoard(repo: MemoryRecordRepository) {
  await repo.create({
    id: 'record-1',
    pid: 'CARD-1',
    schema: 'CardBody',
    body: {
      title: 'First requirement',
      description: 'Short description',
      content: 'Implementation details',
    },
    tags: ['status:todo', 'priority:high', 'sprint:1'],
    assignee: 'pk-1',
    assets: ['asset:deck'],
    relations: [
      {
        constraint: 'dependsOn',
        target: 'record-2',
        description: 'needs foundation',
      },
    ],
    createdBy: 'local',
    createdAt: '2026-06-05T00:00:00.000Z',
  })
  await repo.create({
    id: 'record-2',
    pid: 'CARD-2',
    schema: 'CardBody',
    body: { title: 'Second requirement' },
    tags: ['status:wip', 'priority:low'],
    assets: ['asset:api'],
    relations: [],
    createdBy: 'local',
    createdAt: '2026-06-05T00:00:01.000Z',
  })
}
