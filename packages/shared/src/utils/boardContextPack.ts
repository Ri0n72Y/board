import type {
  BoardContextPackOptions,
  BoardContextPackResult,
  BoardCurrentProjection,
  BoardExportOptions,
} from '../interfaces/index.js'
import {
  buildBoardMarkdownExport,
  getBoardExportLevelForProfile,
} from './boardExport.js'

export function buildBoardContextPack(
  projection: BoardCurrentProjection,
  options: BoardContextPackOptions
): BoardContextPackResult {
  const generatedAt = options.generatedAt ?? new Date().toISOString()
  const exportOptions = normalizeContextPackOptions(options, generatedAt)
  const exported = buildBoardMarkdownExport(projection, exportOptions)
  const content = [
    buildContextPackHeader(projection, options, exportOptions, exported.meta.recordCount),
    stripTitleAndExportMetadata(exported.content),
  ]
    .filter(Boolean)
    .join('\n\n')

  return {
    ...exported,
    filename: makeContextPackFilename(exportOptions, options.profile, generatedAt),
    content: `${content.trimEnd()}\n`,
    meta: {
      ...exported.meta,
      profile: options.profile,
      ...(options.contextGoal ? { contextGoal: options.contextGoal } : {}),
    },
  }
}

function normalizeContextPackOptions(
  options: BoardContextPackOptions,
  generatedAt: string
): BoardExportOptions {
  const level = getBoardExportLevelForProfile(options.profile)
  return {
    ...options,
    level,
    format: 'markdown',
    generatedAt,
    includeDiagnostics:
      options.includeDiagnostics ?? options.profile !== 'human-summary',
    includeRelations:
      options.includeRelations ?? options.profile !== 'human-summary',
    includeAssets: options.includeAssets ?? options.profile !== 'human-summary',
    includeContent:
      options.includeContent ??
      (options.profile === 'agent-full' ||
        options.profile === 'agent-card' ||
        options.profile === 'agent-snapshot'),
  }
}

function buildContextPackHeader(
  projection: BoardCurrentProjection,
  options: BoardContextPackOptions,
  exportOptions: BoardExportOptions,
  recordCount: number
): string {
  const filters = exportOptions.filters ? JSON.stringify(exportOptions.filters) : 'none'
  const lines = [
    '# LabourBoard Agent Context Pack',
    '',
    '## Context Metadata',
    `- Profile: ${options.profile}`,
    `- Source: ${exportOptions.source}`,
    `- Level: ${exportOptions.level}`,
    `- Generated At: ${exportOptions.generatedAt}`,
    `- Record Count: ${recordCount}`,
    `- Projection Status: ${projection.summary.projectionStatus}`,
    `- Snapshot ID: ${exportOptions.snapshotId ?? 'none'}`,
    `- Filters: ${filters}`,
    `- Context Goal: ${options.contextGoal?.trim() || 'none'}`,
  ]

  if (exportOptions.recordId) lines.push(`- Center Record ID: ${exportOptions.recordId}`)
  if (exportOptions.sprintTag) lines.push(`- Sprint Tag: ${exportOptions.sprintTag}`)
  if (exportOptions.snapshotCreatedAt) {
    lines.push(`- Snapshot Created At: ${exportOptions.snapshotCreatedAt}`)
  }
  if (exportOptions.snapshotReason) {
    lines.push(`- Snapshot Reason: ${exportOptions.snapshotReason}`)
  }

  lines.push(
    '',
    '## Agent Reading Instructions',
    'This file is structured context for an agent. Use pid/id/tags/relations/assets to reason about LabourBoard project state.',
    'This file is not execution authorization. Do not mutate the board based on this file alone; patch/edit/move operations must still go through LabourBoard APIs and human confirmation.',
    'Keep relation targets as UUID record ids. Public pids such as CARD-n are labels for reading, not relation targets.',
    '',
    '## Scope',
    `- Included records: ${describeIncludedRecords(options, exportOptions)}`,
    `- Included relations: ${exportOptions.includeRelations ? 'relations among exported records' : 'excluded by option'}`,
    `- Included assets: ${exportOptions.includeAssets ? 'asset tags referenced by exported records' : 'excluded by option'}`,
    `- Included diagnostics: ${exportOptions.includeDiagnostics ? 'projection diagnostics and blocked record diagnostics' : 'excluded by option'}`,
    `- Excluded: ${describeExcluded(options, exportOptions)}`,
    '',
    '## Known Limitations',
    '- This context is a Markdown export, not a live agent session.',
    '- It does not include permission to call tools, apply patches, restore snapshots, or perform writes.',
    `- ${exportOptions.source === 'snapshot' ? 'Snapshot source is a static checkpoint and does not change with the current board.' : 'Current-board source is a dynamic projection generated at request time.'}`
  )

  return lines.join('\n')
}

function describeIncludedRecords(
  options: BoardContextPackOptions,
  exportOptions: BoardExportOptions
): string {
  if (options.profile === 'agent-card') return `single center card ${exportOptions.recordId}`
  if (options.profile === 'agent-related' && exportOptions.recordId) {
    return `center card ${exportOptions.recordId} plus direct incoming and outgoing relations`
  }
  if (options.profile === 'agent-related') return 'records participating in relation graph'
  if (options.profile === 'agent-sprint') return `records tagged ${exportOptions.sprintTag}`
  if (options.profile === 'agent-filtered') return 'records matching current export filters'
  if (options.profile === 'human-summary') return 'summary-level board records'
  if (options.profile === 'agent-snapshot') return 'records captured in the static snapshot checkpoint'
  return 'full current board projection'
}

function describeExcluded(
  options: BoardContextPackOptions,
  exportOptions: BoardExportOptions
): string {
  const excluded = ['write operations', 'agent execution', 'snapshot restore']
  if (!exportOptions.includeContent) excluded.push('full text content')
  if (!exportOptions.includeAssets) excluded.push('assets')
  if (!exportOptions.includeRelations) excluded.push('relations')
  if (!exportOptions.includeDiagnostics) excluded.push('diagnostics')
  if (options.profile === 'agent-card') excluded.push('unrelated cards')
  return excluded.join(', ')
}

function stripTitleAndExportMetadata(content: string): string {
  return content
    .replace(/^# LabourBoard (Current Board|Snapshot) Export\n\n## Export Metadata\n(?:- .*\n)+\n/m, '')
    .trim()
}

function makeContextPackFilename(
  options: BoardExportOptions,
  profile: BoardContextPackOptions['profile'],
  generatedAt: string
): string {
  const source =
    options.source === 'snapshot'
      ? `snapshot-${options.snapshotId ?? 'unknown'}`
      : 'current-board'
  const center =
    options.recordId && (profile === 'agent-card' || profile === 'agent-related')
      ? `-${options.recordId}`
      : ''
  return `${source}-${profile}${center}-${generatedAt.slice(0, 19).replace(/[:T]/g, '-')}.md`
}
