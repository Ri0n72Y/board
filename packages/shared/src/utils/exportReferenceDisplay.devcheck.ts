import type { BoardCurrentProjection } from '../interfaces/index.js'
import { buildBoardMarkdownExport } from './boardExport.js'
import { getContextPackStrings } from './contextPackI18n.js'
import {
  buildExportReferenceMap,
  formatExportReference,
  formatExportRelation,
  formatExportRelationConstraint,
  shortExportReferenceId,
} from './exportReferenceDisplay.js'

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

const projection: BoardCurrentProjection = {
  snapshotHeadVersion: 1,
  records: [
    {
      createdBy: 'local',
      createdAt: '2026-06-17T00:00:00.000Z',
      body: {
        id: 'asset-record-1',
        pid: 'ASSET-1',
        schema: 'AssetBody',
        body: { title: 'Deck System' },
        tags: ['status:todo'],
        assets: [],
        relations: [],
      },
    },
    {
      createdBy: 'local',
      createdAt: '2026-06-17T00:01:00.000Z',
      body: {
        id: 'card-record-1',
        pid: 'CARD-1',
        schema: 'CardBody',
        body: { title: 'Player Draws Cards' },
        tags: ['status:todo'],
        assets: ['asset-record-1', 'unknown-asset-reference-1234567890'],
        relations: [
          {
            constraint: 'dependsOn',
            target: 'asset-record-1',
            description: 'Needs the card data.',
          },
          {
            constraint: 'customConstraint',
            target: 'unknown-relation-target-1234567890',
          },
          {
            constraint: 'asset:completion-of',
            target: 'asset-record-1',
          },
          {
            constraint: 'progress:contributes-to',
            target: 'asset-record-1',
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

const references = buildExportReferenceMap(projection.records)

const resolved = formatExportReference('asset-record-1', references)
eq(
  resolved.label,
  'ASSET-1 - Deck System',
  'resolved reference displays PID and title'
)
eq(resolved.rawId, 'asset-record-1', 'raw id is preserved')
eq(resolved.resolved, true, 'resolved flag is true')

const unknownId = 'unknown-reference-1234567890'
const unknown = formatExportReference(unknownId, references)
eq(
  unknown.label,
  shortExportReferenceId(unknownId),
  'unknown reference falls back to short id'
)
eq(unknown.rawId, unknownId, 'unknown raw id is preserved')
eq(unknown.resolved, false, 'unknown resolved flag is false')

const relation = formatExportRelation(
  {
    constraint: 'dependsOn',
    target: 'asset-record-1',
    description: 'Needs data.',
  },
  references,
  { dependsOn: 'Depends on' }
)
eq(
  relation.label,
  'Depends on ASSET-1 - Deck System',
  'relation label combines constraint and target label'
)

eq(
  formatExportRelationConstraint('asset:completion-of', {
    'asset:completion-of': 'Completion asset for',
  }),
  'Completion asset for',
  'asset completion constraint label is supported'
)
eq(
  formatExportRelationConstraint('progress:contributes-to', {
    'progress:contributes-to': 'Contributes to progress of',
  }),
  'Contributes to progress of',
  'progress contribution constraint label is supported'
)
eq(
  formatExportRelationConstraint('unknown:constraint', {}),
  'unknown:constraint',
  'unknown constraint falls back to raw value'
)

const en = getContextPackStrings('en-US')
eq(
  en.relationConstraintLabels.duplicate,
  'Duplicate',
  'duplicate copy is available'
)
eq(
  en.relationConstraintLabels['asset:completion-of'],
  'Completion asset for',
  'asset completion copy is available'
)
eq(
  en.relationConstraintLabels['progress:contributes-to'],
  'Contributes to progress of',
  'progress contribution copy is available'
)

const exported = buildBoardMarkdownExport(projection, {
  source: 'current-board',
  level: 'full',
  format: 'markdown',
  generatedAt: '2026-06-17T00:00:00.000Z',
})

assert(
  exported.content.includes('- ASSET-1 - Deck System'),
  'asset label is exported'
)
assert(
  exported.content.includes('raw id: asset-record-1'),
  'raw asset id is exported'
)
assert(
  exported.content.includes('Depends on ASSET-1 - Deck System'),
  'relation target label is exported'
)
assert(
  exported.content.includes('constraint: dependsOn'),
  'raw constraint is exported'
)
assert(
  exported.content.includes('target id: asset-record-1'),
  'raw target id is exported'
)
assert(
  exported.content.includes('description: Needs the card data.'),
  'relation description is exported'
)
assert(
  exported.content.includes('customConstraint'),
  'unknown raw constraint is exported'
)
assert(
  exported.content.includes('Completion asset for ASSET-1 - Deck System'),
  'asset completion constraint label is exported'
)
assert(
  exported.content.includes('Contributes to progress of ASSET-1 - Deck System'),
  'progress contribution constraint label is exported'
)
assert(
  exported.content.includes(
    shortExportReferenceId('unknown-asset-reference-1234567890')
  ),
  'unknown asset fallback is exported'
)
assert(
  exported.content.includes(
    shortExportReferenceId('unknown-relation-target-1234567890')
  ),
  'unknown relation fallback is exported'
)

console.log('exportReferenceDisplay devcheck passed')
