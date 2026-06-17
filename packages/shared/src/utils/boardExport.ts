import type {
  BoardCurrentProjection,
  BoardExportOptions,
  BoardExportResult,
  RecordBody,
  RecordItem,
  RecordResponse,
  Tag,
} from '../interfaces/index.js'
import { getContextPackStrings } from './contextPackI18n.js'
import {
  buildExportReferenceMap,
  formatExportReference,
  formatExportRelation,
  type ExportReference,
} from './exportReferenceDisplay.js'

type BoardRecord = RecordResponse<RecordItem<RecordBody>>

interface ExportContext {
  projection: BoardCurrentProjection
  options: Required<
    Pick<
      BoardExportOptions,
      'format' | 'includeAssets' | 'includeContent' | 'includeDiagnostics' | 'includeRelations'
    >
  > &
    BoardExportOptions
  generatedAt: string
  records: BoardRecord[]
  references: Map<string, ExportReference>
}

export function buildBoardMarkdownExport(
  projection: BoardCurrentProjection,
  options: BoardExportOptions
): BoardExportResult {
  const generatedAt = options.generatedAt ?? new Date().toISOString()
  const normalized: ExportContext['options'] = {
    ...options,
    format: 'markdown',
    includeAssets: options.includeAssets ?? true,
    includeContent:
      options.includeContent ?? (options.level === 'full' || options.level === 'card'),
    includeDiagnostics: options.includeDiagnostics ?? true,
    includeRelations: options.includeRelations ?? true,
  }
  const records = selectRecordsForLevel(projection.records, normalized)
  const sortedRecords = sortRecords(records)
  const context: ExportContext = {
    projection,
    options: normalized,
    generatedAt,
    records: sortedRecords,
    references: buildExportReferenceMap(sortedRecords),
  }
  const filename = makeBoardExportFilename(normalized, generatedAt)
  const content = buildMarkdown(context)

  return {
    format: 'markdown',
    filename,
    content,
    meta: {
      source: normalized.source,
      level: normalized.level,
      recordCount: context.records.length,
      generatedAt,
      ...(normalized.snapshotId ? { sourceSnapshotId: normalized.snapshotId } : {}),
      ...(normalized.filters ? { filters: normalized.filters as Record<string, unknown> } : {}),
    },
  }
}

function buildMarkdown(context: ExportContext): string {
  const sections = [
    buildMarkdownHeader(context),
    buildBoardSummarySection(context),
  ]

  if (context.options.level !== 'meta') {
    sections.push(buildStatusOverviewSection(context))
    sections.push(buildSprintOverviewSection(context))
  }

  if (context.options.level === 'related') {
    sections.push(buildRelatedRecordsSection(context))
  } else if (context.options.level === 'card') {
    sections.push(buildSingleRecordSection(context))
  } else if (context.options.level === 'sprint') {
    sections.push(buildSprintSection(context))
  } else if (context.options.level !== 'meta') {
    sections.push(buildRecordsByStatusSection(context))
  }

  if (
    context.options.includeRelations &&
    context.options.level !== 'meta' &&
    context.options.level !== 'card'
  ) {
    sections.push(buildRelationsSection(context))
  }
  if (
    context.options.includeAssets &&
    context.options.level !== 'meta' &&
    context.options.level !== 'card'
  ) {
    sections.push(buildAssetsIndexSection(context))
  }
  if (context.options.includeDiagnostics) {
    sections.push(buildDiagnosticsSection(context))
  }

  return `${sections.filter(Boolean).join('\n\n')}\n`
}

function buildMarkdownHeader(context: ExportContext): string {
  const s = getContextPackStrings(context.options.language)
  const title =
    context.options.source === 'snapshot'
      ? s.snapshotExportTitle
      : s.boardExportTitle
  const filters = context.options.filters
    ? JSON.stringify(context.options.filters)
    : s.none
  const lines = [
    `# ${title}`,
    '',
    s.exportMetadata,
    `- ${s.source}: ${context.options.source}`,
    `- ${s.level}: ${context.options.level}`,
    `- ${s.generatedAt}: ${context.generatedAt}`,
    `- ${s.recordCount}: ${context.records.length}`,
    `- ${s.projectionStatus}: ${context.projection.summary.projectionStatus}`,
    `- ${s.filters}: ${filters}`,
  ]

  if (context.options.snapshotId) {
    lines.push(`- ${s.snapshotId}: ${context.options.snapshotId}`)
  }
  if (context.options.snapshotCreatedAt) {
    lines.push(`- ${s.snapshotCreatedAt}: ${context.options.snapshotCreatedAt}`)
  }
  if (context.options.snapshotReason) {
    lines.push(`- ${s.snapshotReason}: ${context.options.snapshotReason}`)
  }

  lines.push(
    '',
    s.howToUse,
  )

  return lines.join('\n')
}

function buildBoardSummarySection(context: ExportContext): string {
  const s = getContextPackStrings(context.options.language)
  const summary = context.projection.summary
  return [
    s.boardSummary,
    `- ${s.totalBaseRecords}: ${summary.totalBaseRecords}`,
    `- ${s.visibleCurrentRecords}: ${summary.visibleCurrentRecords}`,
    `- ${s.exportedRecords}: ${context.records.length}`,
    `- ${s.archivedRecords}: ${summary.archivedRecords}`,
    `- ${s.blockedRecords}: ${summary.blockedRecords}`,
    `- ${s.projectionStatus}: ${summary.projectionStatus}`,
    `- ${s.snapshotHeadVersion}: ${context.projection.snapshotHeadVersion}`,
  ].join('\n')
}

function buildStatusOverviewSection(context: ExportContext): string {
  const s = getContextPackStrings(context.options.language)
  return buildCountTable(
    s.statusOverview,
    s.status,
    countBy(context.records, (record) => getStatusTag(record) ?? s.uncategorized)
  )
}

function buildSprintOverviewSection(context: ExportContext): string {
  const s = getContextPackStrings(context.options.language)
  return buildCountTable(
    s.sprintOverview,
    'Sprint',
    countBy(context.records, (record) => getSprintTags(record), s.none)
  )
}

function buildRecordsByStatusSection(context: ExportContext): string {
  const s = getContextPackStrings(context.options.language)
  const lines = [s.recordsByStatus]
  const groups = groupBy(context.records, (record) => getStatusTag(record) ?? s.uncategorized)

  for (const [status, records] of groups) {
    lines.push('', `### ${status}`)
    for (const record of records) {
      lines.push('', buildRecordMarkdown(record, context))
    }
  }

  return lines.join('\n')
}

function buildSingleRecordSection(context: ExportContext): string {
  const s = getContextPackStrings(context.options.language)
  const record = context.records[0]
  return [s.record, record ? buildRecordMarkdown(record, context) : s.recordNotFound].join('\n\n')
}

function buildRelatedRecordsSection(context: ExportContext): string {
  const s = getContextPackStrings(context.options.language)
  const lines = [s.relatedRecords]
  if (context.records.length === 0) {
    lines.push(s.noRelatedRecords)
    return lines.join('\n')
  }

  for (const record of context.records) {
    lines.push('', buildRecordMarkdown(record, context))
  }
  lines.push('', buildRelationsSection(context))
  return lines.join('\n')
}

function buildSprintSection(context: ExportContext): string {
  const sprint = context.options.sprintTag ?? 'sprint'
  return [`## Sprint Export: ${sprint}`, buildRecordsByStatusSection(context)].join('\n\n')
}

function buildRelationsSection(context: ExportContext): string {
  const s = getContextPackStrings(context.options.language)
  const lines = [s.relationsGraph]
  let count = 0

  for (const record of context.records) {
    for (const relation of record.body.relations ?? []) {
      const source = formatExportReference(record.body.id, context.references)
      const formatted = formatExportRelation(
        relation,
        context.references,
        s.relationConstraintLabels
      )
      count += 1
      lines.push(
        `- ${source.label} -> ${formatted.label}`,
        `  ${s.constraint}: ${relation.constraint}`,
        `  ${s.targetId}: ${formatted.target.rawId}`
      )
      if (relation.description) {
        lines.push(`  ${s.relationDescription}: ${markdownInline(relation.description)}`)
      }
    }
  }

  if (count === 0) lines.push(`- ${s.noRelationsExported}`)
  return lines.join('\n')
}

function buildAssetsIndexSection(context: ExportContext): string {
  const s = getContextPackStrings(context.options.language)
  const assets = new Map<string, string[]>()
  for (const record of context.records) {
    for (const asset of record.body.assets ?? []) {
      const pids = assets.get(asset) ?? []
      pids.push(record.body.pid)
      assets.set(asset, pids)
    }
  }

  const lines = [s.assetsIndex]
  if (assets.size === 0) {
    lines.push(`- ${s.noAssets}`)
    return lines.join('\n')
  }

  for (const [asset, pids] of [...assets.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const reference = formatExportReference(asset, context.references)
    lines.push(`- ${reference.label}`, `  ${s.rawId}: ${reference.rawId}`)
    for (const pid of pids.sort()) {
      lines.push(`  - ${pid}`)
    }
  }

  return lines.join('\n')
}

function buildDiagnosticsSection(context: ExportContext): string {
  const s = getContextPackStrings(context.options.language)
  const diagnostics = context.projection.diagnostics ?? []
  const blocked = context.projection.blockedRecords ?? []
  const lines = [s.diagnostics]

  if (diagnostics.length === 0 && blocked.length === 0) {
    lines.push(`- ${s.noDiagnostics}`)
    return lines.join('\n')
  }

  for (const item of diagnostics) {
    lines.push(`- ${item.code}: ${item.message}`)
  }
  for (const item of blocked) {
    lines.push(`- ${item.status}: ${item.recordId}`)
    for (const diagnostic of item.diagnostics) {
      lines.push(`  - ${diagnostic.code}: ${diagnostic.message}`)
    }
  }
  return lines.join('\n')
}

function buildRecordMarkdown(record: BoardRecord, context: ExportContext): string {
  const s = getContextPackStrings(context.options.language)
  const body = record.body
  const lines = [
    `#### ${body.pid} - ${markdownInline(titleFromBody(body.body) ?? body.pid)}`,
    `- ${s.id}: ${body.id}`,
    `- ${s.pid}: ${body.pid}`,
    `- ${s.schema}: ${body.schema}`,
    `- ${s.assignee}: ${body.assignee ?? s.unassigned}`,
    `- ${s.tags}: ${body.tags.join(', ') || s.none}`,
  ]

  if (context.options.includeAssets) {
    lines.push(...formatRecordAssets(body.assets ?? [], context, s))
  }
  if (context.options.includeRelations) {
    lines.push(...formatRecordRelations(body.relations ?? [], context, s))
  }

  const description = stringField(body.body, 'description')
  if (description) {
    lines.push(`- ${s.description}: ${markdownInline(description)}`)
  }
  if (context.options.includeContent) {
    const content = stringField(body.body, 'content')
    if (content) {
      lines.push('', '```text', content, '```')
    }
  }

  return lines.join('\n')
}

function selectRecordsForLevel(
  records: BoardRecord[],
  options: BoardExportOptions
): BoardRecord[] {
  if (options.level === 'card') {
    return records.filter((record) => record.body.id === options.recordId)
  }
  if (options.level === 'related' && options.recordId) {
    return selectRelatedRecords(records, options.recordId)
  }
  if (options.level === 'related') {
    return records.filter((record) => {
      const outgoing = (record.body.relations ?? []).length > 0
      const incoming = records.some((other) =>
        (other.body.relations ?? []).some((relation) => relation.target === record.body.id)
      )
      return outgoing || incoming
    })
  }
  if (options.level === 'sprint') {
    const sprintTag = options.sprintTag ?? inferSingleSprintTag(options.filters?.tags)
    return sprintTag
      ? records.filter((record) => record.body.tags.includes(sprintTag as Tag))
      : []
  }
  return records
}

function selectRelatedRecords(records: BoardRecord[], recordId: string): BoardRecord[] {
  const selected = new Set<string>([recordId])
  const center = records.find((record) => record.body.id === recordId)
  if (center) {
    for (const relation of center.body.relations ?? []) selected.add(relation.target)
  }
  for (const record of records) {
    if ((record.body.relations ?? []).some((relation) => relation.target === recordId)) {
      selected.add(record.body.id)
    }
  }
  return records.filter((record) => selected.has(record.body.id))
}

function makeBoardExportFilename(
  options: BoardExportOptions,
  generatedAt: string
): string {
  const source = options.source === 'snapshot' ? `snapshot-${options.snapshotId ?? 'unknown'}` : 'current-board'
  return `${source}-${options.level}-${generatedAt.slice(0, 19).replace(/[:T]/g, '-')}.md`
}

function buildCountTable(
  title: string,
  label: string,
  counts: Map<string, number>
): string {
  const lines = [title, `| ${label} | Count |`, '| --- | ---: |']
  if (counts.size === 0) {
    lines.push('| none | 0 |')
  } else {
    for (const [key, count] of [...counts.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      lines.push(`| ${key} | ${count} |`)
    }
  }
  return lines.join('\n')
}

function countBy(
  records: BoardRecord[],
  keyFn: (record: BoardRecord) => string | string[],
  fallback?: string
): Map<string, number> {
  const counts = new Map<string, number>()
  for (const record of records) {
    const rawKeys = keyFn(record)
    const keys = Array.isArray(rawKeys) ? rawKeys : [rawKeys]
    const finalKeys = keys.length > 0 ? keys : fallback ? [fallback] : []
    for (const key of finalKeys) {
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
  }
  return counts
}

function groupBy(
  records: BoardRecord[],
  keyFn: (record: BoardRecord) => string
): Map<string, BoardRecord[]> {
  const groups = new Map<string, BoardRecord[]>()
  for (const record of sortRecords(records)) {
    const key = keyFn(record)
    const group = groups.get(key) ?? []
    group.push(record)
    groups.set(key, group)
  }
  return new Map([...groups.entries()].sort(([a], [b]) => a.localeCompare(b)))
}

function sortRecords(records: BoardRecord[]): BoardRecord[] {
  return [...records].sort((a, b) => {
    const status = (getStatusTag(a) ?? '').localeCompare(getStatusTag(b) ?? '')
    if (status !== 0) return status
    const pid = a.body.pid.localeCompare(b.body.pid)
    if (pid !== 0) return pid
    return a.createdAt.localeCompare(b.createdAt)
  })
}

function getStatusTag(record: BoardRecord): Tag | null {
  return record.body.tags.find((tag) => tag.startsWith('status:')) ?? null
}

function getSprintTags(record: BoardRecord): Tag[] {
  return record.body.tags.filter((tag) => tag.startsWith('sprint:'))
}

function inferSingleSprintTag(tags: Tag[] | undefined): Tag | undefined {
  const sprintTags = (tags ?? []).filter((tag) => tag.startsWith('sprint:'))
  return sprintTags.length === 1 ? sprintTags[0] : undefined
}

function titleFromBody(body: RecordBody): string | undefined {
  return stringField(body, 'title')
}

function stringField(body: RecordBody, key: string): string | undefined {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return undefined
  const value = (body as Record<string, unknown>)[key]
  return typeof value === 'string' && value.trim() ? value : undefined
}

function formatRecordAssets(
  assets: RecordItem<RecordBody>['assets'],
  context: ExportContext,
  s: ReturnType<typeof getContextPackStrings>
): string[] {
  if (!assets || assets.length === 0) return [`- ${s.assets}: ${s.none}`]
  const lines = [`- ${s.assets}:`]
  for (const asset of assets) {
    const reference = formatExportReference(asset, context.references)
    lines.push(`  - ${reference.label}`, `    ${s.rawId}: ${reference.rawId}`)
  }
  return lines
}

function formatRecordRelations(
  relations: RecordItem<RecordBody>['relations'],
  context: ExportContext,
  s: ReturnType<typeof getContextPackStrings>
): string[] {
  if (!relations || relations.length === 0) return [`- ${s.relations}: ${s.none}`]
  const lines = [`- ${s.relations}:`]
  for (const relation of relations) {
    const formatted = formatExportRelation(
      relation,
      context.references,
      s.relationConstraintLabels
    )
    lines.push(
      `  - ${formatted.label}`,
      `    ${s.constraint}: ${relation.constraint}`,
      `    ${s.targetId}: ${formatted.target.rawId}`
    )
    if (relation.description) {
      lines.push(`    ${s.relationDescription}: ${markdownInline(relation.description)}`)
    }
  }
  return lines
}

function markdownInline(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}
