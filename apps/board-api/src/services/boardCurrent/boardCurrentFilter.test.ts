import { describe, expect, it } from 'vitest'
import type { BoardRecordResponse } from '../record/recordResponses.js'
import { filterBoardCurrentRecords } from './boardCurrentFilter.js'

const targetId = 'asset-target'

const currentRecords: BoardRecordResponse[] = [
  {
    createdBy: 'creator-visible',
    createdAt: '2026-06-04T07:00:00.000Z',
    body: {
      id: 'record-visible',
      pid: 'CARD-1',
      schema: 'CardBody',
      tags: ['status:wip', 'priority:urgent-important'],
      assignee: 'member-visible',
      assets: ['asset-visible'],
      relations: [{ constraint: 'blocks', target: targetId }],
      body: {
        title: 'Visible title',
        description: 'Visible description',
        content: 'Visible content',
      },
    },
  },
  {
    createdBy: 'creator-other',
    createdAt: '2026-06-04T08:00:00.000Z',
    body: {
      id: 'record-other',
      pid: 'CARD-2',
      schema: 'CardBody',
      tags: ['status:todo'],
      assignee: 'member-other',
      assets: ['asset-other'],
      relations: [{ constraint: 'dependsOn', target: 'other-target' }],
      body: {
        title: 'Other title',
        description: 'Other description',
        content: 'Other content',
      },
    },
  },
]

function ids(records: BoardRecordResponse[]): string[] {
  return records.map((record) => record.body.id)
}

describe('filterBoardCurrentRecords', () => {
  it('excludes archived records unless includeArchived is true', () => {
    const archivedRecords: BoardRecordResponse[] = [
      ...currentRecords,
      {
        createdBy: 'creator-archived',
        createdAt: '2026-06-04T09:00:00.000Z',
        body: {
          id: 'record-archived',
          pid: 'CARD-3',
          schema: 'CardBody',
          tags: ['status:archived'],
          assignee: 'member-archived',
          assets: ['asset-archived'],
          relations: [{ constraint: 'duplicates', target: 'archived-target' }],
          body: {
            title: 'Archived title',
            description: 'Archived description',
            content: 'Archived content',
          },
        },
      },
    ]

    expect(ids(filterBoardCurrentRecords(archivedRecords, {}))).toEqual([
      'record-visible',
      'record-other',
    ])
    expect(
      ids(filterBoardCurrentRecords(archivedRecords, { includeArchived: true }))
    ).toEqual(['record-visible', 'record-other', 'record-archived'])
  })

  it('filters tags with all and any semantics', () => {
    expect(
      ids(filterBoardCurrentRecords(currentRecords, {
        tags: ['status:wip', 'priority:urgent-important'],
        tagMatch: 'all',
      }))
    ).toEqual(['record-visible'])

    expect(
      ids(filterBoardCurrentRecords(currentRecords, {
        tags: ['status:wip', 'status:todo'],
        tagMatch: 'any',
      }))
    ).toEqual(['record-visible', 'record-other'])
  })

  it('filters by assignee', () => {
    expect(
      ids(filterBoardCurrentRecords(currentRecords, {
        assignee: 'member-visible',
      }))
    ).toEqual(['record-visible'])
  })

  it('filters by assetId', () => {
    expect(
      ids(filterBoardCurrentRecords(currentRecords, {
        assetId: 'asset-visible',
      }))
    ).toEqual(['record-visible'])
  })

  it('filters by relationTarget', () => {
    expect(
      ids(filterBoardCurrentRecords(currentRecords, {
        relationTarget: targetId,
      }))
    ).toEqual(['record-visible'])
  })

  it('matches q against current title, description, and content', () => {
    for (const q of ['visible title', 'visible description', 'visible content']) {
      expect(ids(filterBoardCurrentRecords(currentRecords, { q }))).toEqual([
        'record-visible',
      ])
    }
  })

  it('matches q against current structural filter fields', () => {
    for (const q of [
      'status:wip',
      'priority:urgent-important',
      'member-visible',
      'asset-visible',
      targetId,
      'blocks',
      'record-visible',
      'CARD-1',
    ]) {
      expect(ids(filterBoardCurrentRecords(currentRecords, { q }))).toEqual([
        'record-visible',
      ])
    }
  })

  it('does not match q against schema or envelope fields', () => {
    for (const q of [
      'CardBody',
      'creator-visible',
      '2026-06-04T07:00:00.000Z',
    ]) {
      expect(filterBoardCurrentRecords(currentRecords, { q })).toEqual([])
    }
  })
})
