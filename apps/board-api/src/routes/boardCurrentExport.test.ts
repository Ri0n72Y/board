import { Hono } from 'hono'
import type { BoardCurrentProjection } from '@labour-board/shared'
import {
  buildBoardContextPack,
  buildBoardMarkdownExport,
} from '@labour-board/shared'
import { describe, expect, it } from 'vitest'
import { MemoryRecordRepository } from '../repositories/recordRepository.js'
import { MemorySnapshotHeadRepository } from '../repositories/snapshotHeadRepository.js'
import { createBoardCurrentExportRoute } from './boardCurrentExport.js'
import { seedLegalMockBoard } from '../testSupport/legalMockBoard.js'

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
    const relatedSource = await repo.findByPid('CARD-5')
    const relatedTarget = await repo.findByPid('CARD-4')

    expect(response.status).toBe(200)
    expect(payload.ok).toBe(true)
    expect(payload.data.filename).toMatch(/current-board-full-.*\.md/)
    expect(payload.data.content).toContain('# LabourBoard Current Board Export')
    expect(payload.data.content).toContain('## Export Metadata')
    expect(payload.data.content).toContain('## Board Summary')
    expect(payload.data.content).toContain('## Status Overview')
    expect(payload.data.content).toContain('## Records By Status')
    expect(payload.data.content).toContain('CARD-1')
    expect(payload.data.content).toContain(relatedSource?.id)
    expect(payload.data.content).toContain('status:doing')
    expect(payload.data.content).toContain('asset:deck-system')
    expect(payload.data.content).toContain('Depends on CARD-4')
    expect(payload.data.content).toContain('constraint: dependsOn')
    expect(payload.data.content).toContain(`target id: ${relatedTarget?.id}`)
    expect(payload.data.content).toContain('战斗开始抽固定数量手牌')
    expect(payload.data.content).not.toMatch(/\\u[0-9a-fA-F]{4}/)
    expect(payload.data.content).not.toContain('dependsOn:US-')
    expect(payload.data.content).not.toContain('dependsOn:CARD-')
    expect(payload.data.meta.recordCount).toBe(33)
  })

  it('exports summary markdown without full content by default', async () => {
    const { app, repo } = createAppWithSeededBoard()
    await seedBoard(repo)

    const response = await app.request(
      '/api/v0/board/current/export?level=summary'
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.data.content).toContain('- Level: summary')
    expect(payload.data.content).toContain('CARD-1')
    expect(payload.data.content).not.toContain('战斗开始抽固定数量手牌')
  })

  it('exports a single card by recordId', async () => {
    const { app, repo } = createAppWithSeededBoard()
    await seedBoard(repo)
    const card = await repo.findByPid('CARD-5')

    const response = await app.request(
      `/api/v0/board/current/export?level=card&recordId=${card?.id}`
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.data.meta.recordCount).toBe(1)
    expect(payload.data.content).toContain('CARD-5')
    expect(payload.data.content).toContain(card?.id)
    expect(payload.data.content).not.toContain('#### CARD-4')
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
    expect(sprintPayload.data.meta.recordCount).toBe(9)

    const filtered = await app.request(
      '/api/v0/board/current/export?level=filtered&q=%E7%8E%A9%E5%AE%B6%E6%8A%BD%E7%89%8C'
    )
    const filteredPayload = await filtered.json()
    expect(filtered.status).toBe(200)
    expect(filteredPayload.data.content).toContain('- Filters:')
    expect(filteredPayload.data.content).toContain('CARD-5')
    expect(filteredPayload.data.content).not.toContain('CARD-1')
  })

  it('applies unified filters to current-board export', async () => {
    const projection = makeFilterSemanticsProjection()

    const defaultArchive = buildBoardMarkdownExport(projection, {
      source: 'current-board',
      level: 'filtered',
      format: 'markdown',
      generatedAt: '2026-06-17T00:00:00.000Z',
      filters: { q: 'Archived Title' },
    })
    expect(defaultArchive.meta.recordCount).toBe(0)
    expect(defaultArchive.content).not.toContain('#### CARD-3')

    const includeArchive = buildBoardMarkdownExport(projection, {
      source: 'current-board',
      level: 'filtered',
      format: 'markdown',
      generatedAt: '2026-06-17T00:00:00.000Z',
      filters: { q: 'Archived Title', includeArchived: true },
    })
    expect(includeArchive.meta.recordCount).toBe(1)
    expect(includeArchive.content).toContain('#### CARD-3 - Archived Title')

    const asset = buildBoardMarkdownExport(projection, {
      source: 'current-board',
      level: 'filtered',
      format: 'markdown',
      generatedAt: '2026-06-17T00:00:00.000Z',
      filters: { assetId: 'asset-record-1' },
    })
    expect(asset.meta.recordCount).toBe(1)
    expect(asset.content).toContain('#### CARD-1 - Match Source')
    expect(asset.content).not.toContain('#### CARD-2 - Outside Target')

    const relation = buildBoardMarkdownExport(projection, {
      source: 'current-board',
      level: 'filtered',
      format: 'markdown',
      generatedAt: '2026-06-17T00:00:00.000Z',
      filters: { relationTarget: 'card-record-2' },
    })
    expect(relation.meta.recordCount).toBe(1)
    expect(relation.content).toContain('#### CARD-1 - Match Source')
    expect(relation.content).not.toContain('#### CARD-2 - Outside Target')

    for (const q of [
      'CARD-1',
      'card-record-1',
      'status:wip',
      'member-visible',
      'dependsOn',
    ]) {
      const exported = buildBoardMarkdownExport(projection, {
        source: 'current-board',
        level: 'filtered',
        format: 'markdown',
        generatedAt: '2026-06-17T00:00:00.000Z',
        filters: { q },
      })
      expect(exported.meta.recordCount).toBe(1)
      expect(exported.content).toContain('#### CARD-1 - Match Source')
      expect(exported.content).not.toContain('#### CARD-2 - Outside Target')
    }

    const byAssetText = buildBoardMarkdownExport(projection, {
      source: 'current-board',
      level: 'filtered',
      format: 'markdown',
      generatedAt: '2026-06-17T00:00:00.000Z',
      filters: { q: 'asset-record-1' },
    })
    expect(byAssetText.meta.recordCount).toBe(2)
    expect(byAssetText.content).toContain('#### ASSET-1 - Outside Asset')
    expect(byAssetText.content).toContain('#### CARD-1 - Match Source')

    const byRelationTargetText = buildBoardMarkdownExport(projection, {
      source: 'current-board',
      level: 'filtered',
      format: 'markdown',
      generatedAt: '2026-06-17T00:00:00.000Z',
      filters: { q: 'card-record-2' },
    })
    expect(byRelationTargetText.meta.recordCount).toBe(2)
    expect(byRelationTargetText.content).toContain('#### CARD-1 - Match Source')
    expect(byRelationTargetText.content).toContain(
      '#### CARD-2 - Outside Target'
    )
  })

  it('routes current-board export includeArchived through unified filters', async () => {
    const { app, repo } = createAppWithSeededBoard()
    await repo.create({
      id: 'record-visible',
      pid: 'CARD-1',
      schema: 'CardBody',
      tags: ['status:todo'],
      assignee: 'member-visible',
      assets: [],
      relations: [],
      body: { title: 'Visible Title' },
      createdBy: 'test',
      createdAt: '2026-06-17T00:00:00.000Z',
    })
    await repo.create({
      id: 'record-archived',
      pid: 'CARD-2',
      schema: 'CardBody',
      tags: ['status:archived'],
      assignee: 'member-archived',
      assets: [],
      relations: [],
      body: { title: 'Archived Title' },
      createdBy: 'test',
      createdAt: '2026-06-17T00:01:00.000Z',
    })

    const excluded = await app.request(
      '/api/v0/board/current/export?level=filtered&q=Archived%20Title'
    )
    const excludedPayload = await excluded.json()
    expect(excluded.status).toBe(200)
    expect(excludedPayload.data.meta.recordCount).toBe(0)
    expect(excludedPayload.data.content).not.toContain(
      '#### CARD-2 - Archived Title'
    )

    const included = await app.request(
      '/api/v0/board/current/export?level=filtered&q=Archived%20Title&includeArchived=true'
    )
    const includedPayload = await included.json()
    expect(included.status).toBe(200)
    expect(includedPayload.data.meta.recordCount).toBe(1)
    expect(includedPayload.data.content).toContain(
      '#### CARD-2 - Archived Title'
    )
  })

  it('exports related records and meta level', async () => {
    const { app, repo } = createAppWithSeededBoard()
    await seedBoard(repo)
    const source = await repo.findByPid('CARD-5')
    const target = await repo.findByPid('CARD-4')

    const related = await app.request(
      `/api/v0/board/current/export?level=related&recordId=${source?.id}`
    )
    const relatedPayload = await related.json()
    expect(related.status).toBe(200)
    expect(relatedPayload.data.content).toContain('CARD-5')
    expect(relatedPayload.data.content).toContain('CARD-4')
    expect(relatedPayload.data.content).toContain('Depends on CARD-4')
    expect(relatedPayload.data.content).toContain('constraint: dependsOn')
    expect(relatedPayload.data.content).toContain(`target id: ${target?.id}`)
    expect(relatedPayload.data.content).not.toContain('CARD-5 dependsOn US-')

    const meta = await app.request('/api/v0/board/current/export?level=meta')
    const metaPayload = await meta.json()
    expect(meta.status).toBe(200)
    expect(metaPayload.data.content).toContain('## Board Summary')
    expect(metaPayload.data.content).not.toContain('## Records By Status')
  })

  it('exports agent context profiles for current board', async () => {
    const { app, repo } = createAppWithSeededBoard()
    await seedBoard(repo)
    const source = await repo.findByPid('CARD-5')
    const target = await repo.findByPid('CARD-4')

    const full = await app.request(
      '/api/v0/board/current/export?profile=agent-full'
    )
    const fullPayload = await full.json()
    expect(full.status).toBe(200)
    expect(fullPayload.data.filename).toMatch(/current-board-agent-full-.*\.md/)
    expect(fullPayload.data.content).toContain(
      '# LabourBoard Agent Context Pack'
    )
    expect(fullPayload.data.content).toContain('## Context Metadata')
    expect(fullPayload.data.content).toContain('## Agent Reading Instructions')
    expect(fullPayload.data.content).toContain(
      'This file is not execution authorization'
    )
    expect(fullPayload.data.content).toContain('## Board Summary')
    expect(fullPayload.data.content).toContain('## Records By Status')
    expect(fullPayload.data.content).toContain('asset:deck-system')
    expect(fullPayload.data.content).toContain('raw id: asset:deck-system')

    const filtered = await app.request(
      '/api/v0/board/current/export?profile=agent-filtered&q=%E7%8E%A9%E5%AE%B6%E6%8A%BD%E7%89%8C'
    )
    const filteredPayload = await filtered.json()
    expect(filtered.status).toBe(200)
    expect(filteredPayload.data.content).toContain('- Profile: agent-filtered')
    expect(filteredPayload.data.content).toContain('- Filters:')
    expect(filteredPayload.data.content).toContain('CARD-5')
    expect(filteredPayload.data.content).not.toContain('#### CARD-1')

    const card = await app.request(
      `/api/v0/board/current/export?profile=agent-card&recordId=${source?.id}`
    )
    const cardPayload = await card.json()
    expect(card.status).toBe(200)
    expect(cardPayload.data.meta.profile).toBe('agent-card')
    expect(cardPayload.data.content).toContain(
      `- Center Record ID: ${source?.id}`
    )
    expect(cardPayload.data.content).toContain('CARD-5')
    expect(cardPayload.data.content).toContain(source?.id)
    expect(cardPayload.data.content).not.toContain('#### CARD-4')

    const related = await app.request(
      `/api/v0/board/current/export?profile=agent-related&recordId=${source?.id}`
    )
    const relatedPayload = await related.json()
    expect(related.status).toBe(200)
    expect(relatedPayload.data.content).toContain('CARD-5')
    expect(relatedPayload.data.content).toContain('CARD-4')
    expect(relatedPayload.data.content).toContain('Depends on CARD-4')
    expect(relatedPayload.data.content).toContain(`target id: ${target?.id}`)
    expect(relatedPayload.data.content).toContain('constraint: dependsOn')
    expect(relatedPayload.data.content).not.toContain('dependsOn:CARD-')

    const sprint = await app.request(
      '/api/v0/board/current/export?profile=agent-sprint&sprintTag=sprint:1'
    )
    const sprintPayload = await sprint.json()
    expect(sprint.status).toBe(200)
    expect(sprintPayload.data.content).toContain('- Sprint Tag: sprint:1')
    expect(sprintPayload.data.content).toContain('## Sprint Export: sprint:1')
    expect(sprintPayload.data.meta.recordCount).toBe(9)

    const human = await app.request(
      '/api/v0/board/current/export?profile=human-summary'
    )
    const humanPayload = await human.json()
    expect(human.status).toBe(200)
    expect(humanPayload.data.content).toContain('- Profile: human-summary')
    expect(humanPayload.data.content).not.toContain('```text')
  })

  it('returns 400 for invalid export combinations', async () => {
    const { app } = createAppWithSeededBoard()

    const missingCard = await app.request(
      '/api/v0/board/current/export?level=card'
    )
    expect(missingCard.status).toBe(400)

    const missingSprint = await app.request(
      '/api/v0/board/current/export?level=sprint'
    )
    expect(missingSprint.status).toBe(400)

    const invalidLevel = await app.request(
      '/api/v0/board/current/export?level=bad'
    )
    expect(invalidLevel.status).toBe(400)

    const invalidProfile = await app.request(
      '/api/v0/board/current/export?profile=bad'
    )
    expect(invalidProfile.status).toBe(400)

    const conflictingLevel = await app.request(
      '/api/v0/board/current/export?profile=agent-full&level=summary'
    )
    expect(conflictingLevel.status).toBe(400)

    const missingProfileCard = await app.request(
      '/api/v0/board/current/export?profile=agent-card'
    )
    expect(missingProfileCard.status).toBe(400)

    const missingProfileSprint = await app.request(
      '/api/v0/board/current/export?profile=agent-sprint'
    )
    expect(missingProfileSprint.status).toBe(400)

    const snapshotProfileOnCurrent = await app.request(
      '/api/v0/board/current/export?profile=agent-snapshot'
    )
    expect(snapshotProfileOnCurrent.status).toBe(400)
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

    buildBoardContextPack(projection, {
      source: 'current-board',
      profile: 'agent-full',
      format: 'markdown',
      generatedAt: '2026-06-05T00:00:00.000Z',
    })

    expect(projection).toEqual(before)
  })

  it('renders readable reference labels and preserves raw ids in markdown', () => {
    const projection: BoardCurrentProjection = {
      snapshotHeadVersion: 0,
      records: [
        {
          createdBy: 'local',
          createdAt: '2026-06-05T00:00:00.000Z',
          body: {
            id: 'asset-record-1',
            pid: 'ASSET-1',
            schema: 'AssetBody',
            body: { title: 'Battle Scene' },
            tags: ['status:todo'],
            assets: [],
            relations: [],
          },
        },
        {
          createdBy: 'local',
          createdAt: '2026-06-05T00:01:00.000Z',
          body: {
            id: 'card-record-1',
            pid: 'CARD-1',
            schema: 'CardBody',
            body: { title: 'Uses asset and relation' },
            tags: ['status:todo'],
            assets: ['asset-record-1', 'unknown-asset-reference-1234567890'],
            relations: [
              {
                constraint: 'dependsOn',
                target: 'asset-record-1',
                description: 'Needs source art.',
              },
              {
                constraint: 'blocks',
                target: 'unknown-relation-target-1234567890',
              },
            ],
          },
        },
      ],
      blockedRecords: [],
      summary: {
        totalBaseRecords: 2,
        visibleCurrentRecords: 2,
        archivedRecords: 0,
        blockedRecords: 0,
        projectionStatus: 'clean',
      },
    }

    const exported = buildBoardMarkdownExport(projection, {
      source: 'current-board',
      level: 'full',
      format: 'markdown',
      generatedAt: '2026-06-05T00:00:00.000Z',
    })

    expect(exported.content).toContain('- ASSET-1 - Battle Scene')
    expect(exported.content).toContain('raw id: asset-record-1')
    expect(exported.content).toContain('unknown-...567890')
    expect(exported.content).toContain(
      'raw id: unknown-asset-reference-1234567890'
    )
    expect(exported.content).toContain('Depends on ASSET-1 - Battle Scene')
    expect(exported.content).toContain('constraint: dependsOn')
    expect(exported.content).toContain('target id: asset-record-1')
    expect(exported.content).toContain('description: Needs source art.')
    expect(exported.content).toContain('Blocks unknown-...567890')

    const withoutAssets = buildBoardMarkdownExport(projection, {
      source: 'current-board',
      level: 'full',
      format: 'markdown',
      generatedAt: '2026-06-05T00:00:00.000Z',
      includeAssets: false,
    })
    expect(withoutAssets.content).not.toContain('- assets:')
    expect(withoutAssets.content).not.toContain('## Assets Index')

    const withoutRelations = buildBoardMarkdownExport(projection, {
      source: 'current-board',
      level: 'full',
      format: 'markdown',
      generatedAt: '2026-06-05T00:00:00.000Z',
      includeRelations: false,
    })
    expect(withoutRelations.content).not.toContain('- relations:')
    expect(withoutRelations.content).not.toContain(
      '## Relations / Requirement Graph'
    )
  })

  it('resolves card export references from records outside the selected card', () => {
    const projection = makeReferenceScopeProjection()

    const exported = buildBoardMarkdownExport(projection, {
      source: 'current-board',
      level: 'card',
      recordId: 'card-record-1',
      format: 'markdown',
      generatedAt: '2026-06-05T00:00:00.000Z',
    })

    expect(exported.meta.recordCount).toBe(1)
    expect(exported.content).toContain('#### CARD-1 - Match Source')
    expect(exported.content).toContain('ASSET-1 - Outside Asset')
    expect(exported.content).toContain('raw id: asset-record-1')
    expect(exported.content).toContain('Depends on CARD-2 - Outside Target')
    expect(exported.content).toContain('target id: card-record-2')
    expect(exported.content).not.toContain('#### ASSET-1 - Outside Asset')
    expect(exported.content).not.toContain('#### CARD-2 - Outside Target')
  })

  it('resolves filtered export references from records outside the filtered result', () => {
    const projection = makeReferenceScopeProjection()

    const exported = buildBoardMarkdownExport(projection, {
      source: 'current-board',
      level: 'filtered',
      format: 'markdown',
      generatedAt: '2026-06-05T00:00:00.000Z',
      filters: { q: 'match-source' },
    })

    expect(exported.meta.recordCount).toBe(1)
    expect(exported.content).toContain('#### CARD-1 - Match Source')
    expect(exported.content).toContain('Depends on CARD-2 - Outside Target')
    expect(exported.content).toContain('target id: card-record-2')
    expect(exported.content).not.toContain('#### CARD-2 - Outside Target')
  })

  it('resolves agent-card context references from records outside the selected card', () => {
    const projection = makeReferenceScopeProjection()

    const exported = buildBoardContextPack(projection, {
      source: 'current-board',
      profile: 'agent-card',
      recordId: 'card-record-1',
      format: 'markdown',
      generatedAt: '2026-06-05T00:00:00.000Z',
    })

    expect(exported.meta.recordCount).toBe(1)
    expect(exported.content).toContain('#### CARD-1 - Match Source')
    expect(exported.content).toContain('ASSET-1 - Outside Asset')
    expect(exported.content).toContain('raw id: asset-record-1')
    expect(exported.content).toContain('Depends on CARD-2 - Outside Target')
    expect(exported.content).toContain('target id: card-record-2')
    expect(exported.content).not.toContain('#### ASSET-1 - Outside Asset')
    expect(exported.content).not.toContain('#### CARD-2 - Outside Target')
  })
})

async function seedBoard(repo: MemoryRecordRepository) {
  await seedLegalMockBoard(repo)
}

function makeReferenceScopeProjection(): BoardCurrentProjection {
  return {
    snapshotHeadVersion: 0,
    records: [
      {
        createdBy: 'local',
        createdAt: '2026-06-05T00:00:00.000Z',
        body: {
          id: 'asset-record-1',
          pid: 'ASSET-1',
          schema: 'AssetBody',
          body: { title: 'Outside Asset' },
          tags: ['status:todo'],
          assets: [],
          relations: [],
        },
      },
      {
        createdBy: 'local',
        createdAt: '2026-06-05T00:01:00.000Z',
        body: {
          id: 'card-record-1',
          pid: 'CARD-1',
          schema: 'CardBody',
          body: {
            title: 'Match Source',
            description: 'match-source',
          },
          tags: ['status:todo'],
          assets: ['asset-record-1'],
          relations: [{ constraint: 'dependsOn', target: 'card-record-2' }],
        },
      },
      {
        createdBy: 'local',
        createdAt: '2026-06-05T00:02:00.000Z',
        body: {
          id: 'card-record-2',
          pid: 'CARD-2',
          schema: 'CardBody',
          body: { title: 'Outside Target' },
          tags: ['status:todo'],
          assets: [],
          relations: [],
        },
      },
    ],
    blockedRecords: [],
    summary: {
      totalBaseRecords: 3,
      visibleCurrentRecords: 3,
      archivedRecords: 0,
      blockedRecords: 0,
      projectionStatus: 'clean',
    },
  }
}

function makeFilterSemanticsProjection(): BoardCurrentProjection {
  return {
    snapshotHeadVersion: 0,
    records: [
      {
        createdBy: 'local',
        createdAt: '2026-06-05T00:00:00.000Z',
        body: {
          id: 'asset-record-1',
          pid: 'ASSET-1',
          schema: 'AssetBody',
          body: { title: 'Outside Asset' },
          tags: ['status:todo'],
          assets: [],
          relations: [],
        },
      },
      {
        createdBy: 'local',
        createdAt: '2026-06-05T00:01:00.000Z',
        body: {
          id: 'card-record-1',
          pid: 'CARD-1',
          schema: 'CardBody',
          body: {
            title: 'Match Source',
            description: 'match-source',
            content: 'source body content',
          },
          tags: ['status:wip'],
          assignee: 'member-visible',
          assets: ['asset-record-1'],
          relations: [{ constraint: 'dependsOn', target: 'card-record-2' }],
        },
      },
      {
        createdBy: 'local',
        createdAt: '2026-06-05T00:02:00.000Z',
        body: {
          id: 'card-record-2',
          pid: 'CARD-2',
          schema: 'CardBody',
          body: { title: 'Outside Target' },
          tags: ['status:todo'],
          assets: [],
          relations: [],
        },
      },
      {
        createdBy: 'local',
        createdAt: '2026-06-05T00:03:00.000Z',
        body: {
          id: 'card-record-3',
          pid: 'CARD-3',
          schema: 'CardBody',
          body: { title: 'Archived Title' },
          tags: ['status:archived'],
          assets: [],
          relations: [],
        },
      },
    ],
    blockedRecords: [],
    summary: {
      totalBaseRecords: 4,
      visibleCurrentRecords: 4,
      archivedRecords: 1,
      blockedRecords: 0,
      projectionStatus: 'partial',
    },
  }
}
