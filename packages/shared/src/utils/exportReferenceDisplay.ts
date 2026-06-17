import type {
  RecordBody,
  RecordItem,
  RecordResponse,
  RelationRef,
} from '../interfaces/index.js'

type ExportRecord = RecordResponse<RecordItem<RecordBody>>

export interface ExportReference {
  id: string
  pid?: string
  title?: string
  schema?: string
}

export interface ExportReferenceDisplay {
  label: string
  rawId: string
  resolved: boolean
}

export interface ExportRelationDisplay {
  label: string
  constraintLabel: string
  target: ExportReferenceDisplay
  relation: RelationRef
}

const DEFAULT_RELATION_CONSTRAINT_LABELS: Record<string, string> = {
  dependsOn: 'Depends on',
  blocks: 'Blocks',
  blockedBy: 'Blocked by',
  relatedTo: 'Related to',
  relatesTo: 'Relates to',
  duplicates: 'Duplicates',
  parentOf: 'Parent of',
  childOf: 'Child of',
  contains: 'Contains',
  supports: 'Supports',
  implementedBy: 'Implemented by',
}

export function buildExportReferenceMap(
  records: ExportRecord[]
): Map<string, ExportReference> {
  const references = new Map<string, ExportReference>()
  for (const record of records) {
    references.set(record.body.id, {
      id: record.body.id,
      pid: cleanText(record.body.pid),
      title: titleFromBody(record.body.body) ?? cleanText(record.body.pid),
      schema: cleanText(record.body.schema),
    })
  }
  return references
}

export function formatExportReference(
  id: string,
  references: Map<string, ExportReference>
): ExportReferenceDisplay {
  const rawId = id.trim()
  const reference = references.get(rawId)
  if (!reference) {
    return {
      label: shortExportReferenceId(rawId),
      rawId,
      resolved: false,
    }
  }

  return {
    label: makeReferenceLabel(reference),
    rawId,
    resolved: true,
  }
}

export function formatExportRelation(
  relation: RelationRef,
  references: Map<string, ExportReference>,
  constraintLabels?: Record<string, string>
): ExportRelationDisplay {
  const constraintLabel = formatExportRelationConstraint(
    relation.constraint,
    constraintLabels
  )
  const target = formatExportReference(relation.target, references)
  return {
    label: `${constraintLabel} ${target.label}`,
    constraintLabel,
    target,
    relation,
  }
}

export function formatExportRelationConstraint(
  constraint: string,
  labels: Record<string, string> = DEFAULT_RELATION_CONSTRAINT_LABELS
): string {
  const raw = constraint.trim()
  return labels[raw] ?? raw
}

export function shortExportReferenceId(id: string): string {
  const value = id.trim()
  if (value.length <= 18) return value
  return `${value.slice(0, 8)}...${value.slice(-6)}`
}

function makeReferenceLabel(reference: ExportReference): string {
  const pid = cleanText(reference.pid)
  const title = cleanText(reference.title)
  if (pid && title && title !== pid) return `${pid} - ${title}`
  if (pid) return pid
  if (title) return title
  return shortExportReferenceId(reference.id)
}

function titleFromBody(body: RecordBody): string | undefined {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return undefined
  const value = (body as Record<string, unknown>).title
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function cleanText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}
