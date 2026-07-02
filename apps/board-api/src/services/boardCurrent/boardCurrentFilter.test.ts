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
      tags: ['status:wip', 'priority:urgent-important', 'topic:a'],
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
      tags: ['status:todo', 'topic:b'],
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
  {
    createdBy: 'creator-both',
    createdAt: '2026-06-04T08:30:00.000Z',
    body: {
      id: 'record-both',
      pid: 'CARD-2B',
      schema: 'CardBody',
      tags: ['topic:a', 'topic:b'],
      assignee: 'member-both',
      assets: [],
      relations: [],
      body: {
        title: 'Both title',
        description: 'Both description',
        content: 'Both content',
      },
    },
  },
  {
    createdBy: 'creator-neither',
    createdAt: '2026-06-04T08:45:00.000Z',
    body: {
      id: 'record-neither',
      pid: 'CARD-2C',
      schema: 'CardBody',
      tags: ['priority:low'],
      assignee: 'member-neither',
      assets: [],
      relations: [],
      body: {
        title: 'Neither title',
        description: 'Neither description',
        content: 'Neither content',
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
      'record-both',
      'record-neither',
    ])
    expect(
      ids(filterBoardCurrentRecords(archivedRecords, { includeArchived: true }))
    ).toEqual([
      'record-visible',
      'record-other',
      'record-both',
      'record-neither',
      'record-archived',
    ])
  })

  it('filters tags with OR semantics, including legacy tagMatch=all', () => {
    expect(
      ids(
        filterBoardCurrentRecords(currentRecords, {
          tags: ['status:wip', 'priority:urgent-important'],
          tagMatch: 'all',
        })
      )
    ).toEqual(['record-visible'])

    expect(
      ids(
        filterBoardCurrentRecords(currentRecords, {
          tags: ['topic:a', 'topic:b'],
          tagMatch: 'any',
        })
      )
    ).toEqual(['record-visible', 'record-other', 'record-both'])

    expect(
      ids(
        filterBoardCurrentRecords(currentRecords, {
          tags: ['topic:a', 'topic:b'],
          tagMatch: 'all',
        })
      )
    ).toEqual(['record-visible', 'record-other', 'record-both'])
  })

  it('filters by assignee', () => {
    expect(
      ids(
        filterBoardCurrentRecords(currentRecords, {
          assignee: 'member-visible',
        })
      )
    ).toEqual(['record-visible'])
  })

  it('filters by assetId', () => {
    expect(
      ids(
        filterBoardCurrentRecords(currentRecords, {
          assetId: 'asset-visible',
        })
      )
    ).toEqual(['record-visible'])
  })

  it('filters by relationTarget', () => {
    expect(
      ids(
        filterBoardCurrentRecords(currentRecords, {
          relationTarget: targetId,
        })
      )
    ).toEqual(['record-visible'])
  })

  it('matches q against current title, description, and content', () => {
    for (const q of [
      'visible title',
      'visible description',
      'visible content',
    ]) {
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
