import { describe, expect, it } from 'vitest'
import type { BoardCurrentProjection } from '@labour-board/shared'
import { buildBoardContextPack } from '@labour-board/shared'

const PROJECTION: BoardCurrentProjection = {
  snapshotHeadVersion: 7,
  records: [
    {
      createdBy: 'local',
      createdAt: '2026-06-05T00:00:00.000Z',
      body: {
        id: 'asset-record-1',
        pid: 'ASSET-1',
        schema: 'AssetBody',
        body: {
          title: 'Deck System',
        },
        tags: ['status:todo'],
        assets: [],
        relations: [],
      },
    },
    {
      createdBy: 'local',
      createdAt: '2026-06-05T00:01:00.000Z',
      body: {
        id: '11111111-1111-5111-8111-111111111111',
        pid: 'CARD-1',
        schema: 'CardBody',
        body: {
          title: 'Context Pack Record',
          content: 'Full content stays here.',
        },
        tags: ['status:todo', 'sprint:1'],
        assets: ['asset-record-1', 'asset:deck-system'],
        relations: [
          {
            constraint: 'dependsOn',
            target: '22222222-2222-5222-8222-222222222222',
            description: 'Related card',
          },
        ],
      },
    },
    {
      createdBy: 'local',
      createdAt: '2026-06-05T00:02:00.000Z',
      body: {
        id: '22222222-2222-5222-8222-222222222222',
        pid: 'CARD-2',
        schema: 'CardBody',
        body: {
          title: 'Related Target',
        },
        tags: ['status:todo'],
        assets: [],
        relations: [],
      },
    },
  ],
  blockedRecords: [],
  diagnostics: [{ code: 'PROJECTION_NOTE', message: 'Diagnostics available' }],
  summary: {
    totalBaseRecords: 3,
    visibleCurrentRecords: 3,
    archivedRecords: 0,
    blockedRecords: 0,
    projectionStatus: 'clean',
  },
}

describe('buildBoardContextPack', () => {
  it('uses registry defaults and preserves the input projection', () => {
    const before = structuredClone(PROJECTION)
    const exported = buildBoardContextPack(PROJECTION, {
      source: 'current-board',
      profile: 'human-summary',
      format: 'markdown',
      generatedAt: '2026-06-05T00:00:00.000Z',
    })

    expect(PROJECTION).toEqual(before)
    expect(exported.meta.profile).toBe('human-summary')
    expect(exported.content).toContain('# LabourBoard Agent Context Pack')
    expect(exported.content).toContain('## Agent Reading Instructions')
    expect(exported.content).toContain('This file is not execution authorization')
    expect(exported.content).toContain('## Board Summary')
    expect(exported.content).toContain('- Profile: human-summary')
    expect(exported.content).not.toContain('```text')
  })

  it('keeps full context defaults for agent-full', () => {
    const exported = buildBoardContextPack(PROJECTION, {
      source: 'current-board',
      profile: 'agent-full',
      format: 'markdown',
      generatedAt: '2026-06-05T00:00:00.000Z',
    })

    expect(exported.content).toContain('ASSET-1 - Deck System')
    expect(exported.content).toContain('raw id: asset-record-1')
    expect(exported.content).toContain('asset:deck-system')
    expect(exported.content).toContain('raw id: asset:deck-system')
    expect(exported.content).toContain('Depends on CARD-2 - Related Target')
    expect(exported.content).toContain('constraint: dependsOn')
    expect(exported.content).toContain('target id: 22222222-2222-5222-8222-222222222222')
    expect(exported.content).toContain('description: Related card')
    expect(exported.content).toContain('Full content stays here.')
    expect(exported.content).toContain('## Diagnostics')
  })

  it('marks snapshot context as a static checkpoint', () => {
    const exported = buildBoardContextPack(PROJECTION, {
      source: 'snapshot',
      profile: 'agent-snapshot',
      format: 'markdown',
      generatedAt: '2026-06-05T00:00:00.000Z',
      snapshotId: 'snapshot-123',
    })

    expect(exported.content).toContain('static checkpoint')
    expect(exported.content).toContain('- Snapshot ID: snapshot-123')
  })
})
