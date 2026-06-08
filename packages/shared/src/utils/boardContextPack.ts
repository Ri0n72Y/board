import type {
  BoardContextPackOptions,
  BoardContextPackResult,
  BoardCurrentProjection,
  BoardExportOptions,
} from '../interfaces/index.js'
import {
  getAgentContextProfileDefinition,
} from '../constants/index.js'
import { buildBoardMarkdownExport } from './boardExport.js'
import { getContextPackStrings } from './contextPackI18n.js'

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
  const definition = getAgentContextProfileDefinition(options.profile)
  return {
    ...options,
    level: definition.level,
    format: 'markdown',
    generatedAt,
    includeDiagnostics:
      options.includeDiagnostics ?? definition.defaultIncludeDiagnostics,
    includeRelations:
      options.includeRelations ?? definition.defaultIncludeRelations,
    includeAssets: options.includeAssets ?? definition.defaultIncludeAssets,
    includeContent: options.includeContent ?? definition.defaultIncludeContent,
  }
}

function buildContextPackHeader(
  projection: BoardCurrentProjection,
  options: BoardContextPackOptions,
  exportOptions: BoardExportOptions,
  recordCount: number
): string {
  const definition = getAgentContextProfileDefinition(options.profile)
  const s = getContextPackStrings(exportOptions.language)
  const filters = exportOptions.filters ? JSON.stringify(exportOptions.filters) : s.none
  const lines = [
    s.title,
    '',
    s.contextMetadata,
    `- ${s.profile}: ${options.profile}`,
    `- ${s.source}: ${exportOptions.source}`,
    `- ${s.level}: ${exportOptions.level}`,
    `- ${s.generatedAt}: ${exportOptions.generatedAt}`,
    `- ${s.recordCount}: ${recordCount}`,
    `- ${s.projectionStatus}: ${projection.summary.projectionStatus}`,
    `- ${s.snapshotId}: ${exportOptions.snapshotId ?? s.none}`,
    `- ${s.filters}: ${filters}`,
    `- ${s.contextGoal}: ${options.contextGoal?.trim() || s.none}`,
    `- ${s.profileDescription}: ${definition.description}`,
  ]

  if (exportOptions.recordId) lines.push(`- ${s.centerRecordId}: ${exportOptions.recordId}`)
  if (exportOptions.sprintTag) lines.push(`- ${s.sprintTag}: ${exportOptions.sprintTag}`)
  if (exportOptions.snapshotCreatedAt) {
    lines.push(`- ${s.snapshotCreatedAt}: ${exportOptions.snapshotCreatedAt}`)
  }
  if (exportOptions.snapshotReason) {
    lines.push(`- ${s.snapshotReason}: ${exportOptions.snapshotReason}`)
  }

  lines.push(
    '',
    s.agentReadingInstructions,
    definition.agentReadingPurpose,
    s.noExecutionAuth,
    s.keepUuidRelations,
    '',
    s.scope,
    `- ${s.includedRecords}: ${describeIncludedRecords(options, exportOptions)}`,
    `- ${s.includedRelations}: ${exportOptions.includeRelations ? 'relations among exported records' : s.excludedByOption}`,
    `- ${s.includedAssets}: ${exportOptions.includeAssets ? 'asset tags referenced by exported records' : s.excludedByOption}`,
    `- ${s.includedDiagnostics}: ${exportOptions.includeDiagnostics ? 'projection diagnostics and blocked record diagnostics' : s.excludedByOption}`,
    `- ${s.excluded}: ${describeExcluded(options, exportOptions)}`,
    '',
    s.knownLimitations,
    `- ${s.notLiveSession}`,
    `- ${s.noToolPermission}`,
    `- ${exportOptions.source === 'snapshot' ? s.snapshotStatic : s.currentBoardDynamic}`
  )

  return lines.join('\n')
}

function describeIncludedRecords(
  options: BoardContextPackOptions,
  exportOptions: BoardExportOptions
): string {
  const definition = getAgentContextProfileDefinition(options.profile)
  if (options.profile === 'agent-card') return `single center card ${exportOptions.recordId}`
  if (options.profile === 'agent-related' && exportOptions.recordId) {
    return `center card ${exportOptions.recordId} plus direct incoming and outgoing relations`
  }
  if (options.profile === 'agent-related') return 'records participating in relation graph'
  if (options.profile === 'agent-sprint') return `records tagged ${exportOptions.sprintTag}`
  if (options.profile === 'agent-filtered') return 'records matching current export filters'
  if (options.profile === 'human-summary') return definition.description
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
