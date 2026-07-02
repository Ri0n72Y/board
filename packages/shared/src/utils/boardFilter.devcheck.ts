import type {
  BoardCurrentQuery,
  BoardCurrentProjection,
} from '../interfaces/index.js'
import { filterBoardRecords, normalizeBoardFilterQuery } from './boardFilter.js'

declare const console: { log(message: string): void }

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message)
}

function eq<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(
      `${message}: expected ${String(expected)}, got ${String(actual)}`
    )
  }
}

const records: BoardCurrentProjection['records'] = [
  {
    createdBy: 'local',
    createdAt: '2026-06-17T00:00:00.000Z',
    body: {
      id: 'record-visible',
      pid: 'CARD-1',
      schema: 'CardBody',
      tags: ['status:wip', 'priority:urgent-important', 'topic:a'],
      assignee: 'member-visible',
      assets: ['asset-visible'],
      relations: [{ constraint: 'blocks', target: 'record-target' }],
      body: {
        title: 'Visible Title',
        description: 'Visible Description',
        content: 'Visible Content',
      },
    },
  },
  {
    createdBy: 'local',
    createdAt: '2026-06-17T00:01:00.000Z',
    body: {
      id: 'record-other',
      pid: 'CARD-2',
      schema: 'CardBody',
      tags: ['status:todo', 'topic:b'],
      assignee: 'member-other',
      assets: ['asset-other'],
      relations: [{ constraint: 'dependsOn', target: 'other-target' }],
      body: {
        title: 'Other Title',
        description: 'Other Description',
        content: 'Other Content',
      },
    },
  },
  {
    createdBy: 'local',
    createdAt: '2026-06-17T00:01:30.000Z',
    body: {
      id: 'record-both',
      pid: 'CARD-2B',
      schema: 'CardBody',
      tags: ['topic:a', 'topic:b'],
      assignee: 'member-both',
      assets: [],
      relations: [],
      body: {
        title: 'Both Tags Title',
        description: 'Both Tags Description',
        content: 'Both Tags Content',
      },
    },
  },
  {
    createdBy: 'local',
    createdAt: '2026-06-17T00:01:45.000Z',
    body: {
      id: 'record-neither',
      pid: 'CARD-2C',
      schema: 'CardBody',
      tags: ['priority:low'],
      assignee: 'member-neither',
      assets: [],
      relations: [],
      body: {
        title: 'Neither Tags Title',
        description: 'Neither Tags Description',
        content: 'Neither Tags Content',
      },
    },
  },
  {
    createdBy: 'local',
    createdAt: '2026-06-17T00:02:00.000Z',
    body: {
      id: 'record-archived',
      pid: 'CARD-3',
      schema: 'CardBody',
      tags: ['status:archived', 'priority:urgent-important'],
      assignee: 'member-archived',
      assets: ['asset-archived'],
      relations: [{ constraint: 'duplicates', target: 'archived-target' }],
      body: {
        title: 'Archived Title',
        description: 'Archived Description',
        content: 'Archived Content',
      },
    },
  },
]

function ids(query?: BoardCurrentQuery): string[] {
  return filterBoardRecords(records, query).map((record) => record.body.id)
}

eq(
  ids().includes('record-archived'),
  false,
  'includeArchived false excludes status:archived'
)
eq(
  ids({ includeArchived: true }).includes('record-archived'),
  true,
  'includeArchived true includes status:archived'
)
eq(
  ids({ tags: ['status:wip', 'priority:urgent-important'] }).join(','),
  'record-visible',
  'tags default to any'
)
eq(
  ids({ tags: ['topic:a', 'topic:b'], tagMatch: 'any' }).join(','),
  'record-visible,record-other,record-both',
  'tags any'
)
eq(
  normalizeBoardFilterQuery({}).tagMatch,
  'any',
  'tagMatch undefined defaults to any'
)
eq(
  ids({ tags: ['topic:a', 'topic:b'] }).join(','),
  'record-visible,record-other,record-both',
  'tagMatch undefined uses any'
)
eq(
  ids({ tags: ['topic:a', 'topic:b'], tagMatch: 'all' }).join(','),
  'record-visible,record-other,record-both',
  'tagMatch all compatibility still uses any'
)
eq(ids({ assignee: 'member-visible' }).join(','), 'record-visible', 'assignee')
eq(ids({ assetId: 'asset-visible' }).join(','), 'record-visible', 'assetId')
eq(
  ids({ relationTarget: 'record-target' }).join(','),
  'record-visible',
  'relationTarget'
)
eq(ids({ q: 'visible title' }).join(','), 'record-visible', 'q matches title')
eq(
  ids({ q: 'visible description' }).join(','),
  'record-visible',
  'q matches description'
)
eq(
  ids({ q: 'visible content' }).join(','),
  'record-visible',
  'q matches content'
)
eq(ids({ q: 'CARD-1' }).join(','), 'record-visible', 'q matches pid')
eq(ids({ q: 'record-visible' }).join(','), 'record-visible', 'q matches id')
eq(
  ids({ q: 'priority:urgent-important' }).join(','),
  'record-visible',
  'q matches tag'
)
eq(
  ids({ q: 'asset-visible' }).join(','),
  'record-visible',
  'q matches asset id'
)
eq(
  ids({ q: 'record-target' }).join(','),
  'record-visible',
  'q matches relation target'
)
eq(
  ids({ q: 'blocks' }).join(','),
  'record-visible',
  'q matches relation constraint'
)
eq(
  ids({ q: '  VISIBLE TITLE  ' }).join(','),
  'record-visible',
  'q trim / case-insensitive'
)
eq(
  ids({ q: '   ' }).join(','),
  'record-visible,record-other,record-both,record-neither',
  'empty q no-op'
)
eq(
  ids({
    q: 'visible',
    tags: ['status:wip'],
    assignee: 'member-visible',
    assetId: 'asset-visible',
    relationTarget: 'record-target',
  }).join(','),
  'record-visible',
  'combined filters are AND'
)
eq(
  ids({
    q: 'visible',
    tags: ['status:wip'],
    assignee: 'member-other',
    assetId: 'asset-visible',
    relationTarget: 'record-target',
  }).join(','),
  '',
  'combined filters reject when any clause misses'
)

assert(true, 'boardFilter devcheck completed')
console.log('boardFilter devcheck passed')
