import type {
  BoardConfig,
  RecordBody,
  RecordItem,
  RecordResponse,
  RelationRef,
} from '@labour-board/shared'
import {
  shortReferenceId,
  type RecordReferenceOption,
} from './recordReferenceOptions'
import { formatReferenceLabel } from './referenceDisplay'

export type Relation = RelationRef

export type RelationConstraintOption = {
  value: string
  label: string
}

export type RelationTranslator = (
  key: string,
  options?: { defaultValue?: string }
) => string

export const DEFAULT_RELATION_CONSTRAINTS = [
  'dependsOn',
  'blocks',
  'blockedBy',
  'relatedTo',
  'relatesTo',
  'duplicates',
  'duplicate',
  'parentOf',
  'childOf',
  'contains',
  'supports',
  'implementedBy',
]

type CurrentRecord = RecordResponse<RecordItem<RecordBody>>

export function buildRelationConstraintOptions(
  records: readonly CurrentRecord[],
  t: RelationTranslator,
  config?: BoardConfig | null
): RelationConstraintOption[] {
  const values = new Set<string>()
  for (const value of DEFAULT_RELATION_CONSTRAINTS) values.add(value)
  for (const value of config?.relations.constraints ?? []) values.add(value)
  for (const record of records) {
    for (const relation of record.body.relations ?? []) {
      if (relation.constraint.trim()) values.add(relation.constraint.trim())
    }
  }

  return [...values]
    .map((value) => ({
      value,
      label: formatRelationConstraint(value, t),
    }))
    .sort((left, right) =>
      left.label.localeCompare(right.label, undefined, {
        numeric: true,
        sensitivity: 'base',
      })
    )
}

export function formatRelationConstraint(
  constraint: string,
  t: RelationTranslator
): string {
  const value = constraint.trim()
  if (!value) return ''
  return t(`relations.constraint.${value}`, {
    defaultValue: t(`history.relation.${value}`, { defaultValue: value }),
  })
}

export function formatRelationTarget(
  targetId: string,
  relationTargetOptions: readonly RecordReferenceOption[]
): string {
  const target = targetId.trim()
  if (!target) return ''
  return formatReferenceLabel(target, relationTargetOptions)
}

export function formatRelationLine(
  relation: Relation,
  relationTargetOptions: readonly RecordReferenceOption[],
  t: RelationTranslator
): string {
  const constraint = formatRelationConstraint(relation.constraint, t)
  const target = formatRelationTarget(relation.target, relationTargetOptions)
  const description = relation.description?.trim()
  return [constraint, target, description ? `(${description})` : '']
    .filter(Boolean)
    .join(' ')
}

export function dedupeRelations(relations: readonly Relation[]): Relation[] {
  const seen = new Set<string>()
  const result: Relation[] = []
  for (const relation of relations) {
    const key = relationKey(relation)
    if (seen.has(key)) continue
    seen.add(key)
    result.push(relation)
  }
  return result
}

export function sameRelations(
  left: readonly Relation[] | undefined,
  right: readonly Relation[] | undefined
): boolean {
  const normalizedLeft = normalizeRelationDrafts(left ?? [])
  const normalizedRight = normalizeRelationDrafts(right ?? [])
  if (normalizedLeft.length !== normalizedRight.length) return false
  return normalizedLeft.every(
    (relation, index) =>
      relationKey(relation) === relationKey(normalizedRight[index])
  )
}

export function normalizeRelationDrafts(
  drafts: readonly Relation[] | undefined
): Relation[] {
  const normalized: Relation[] = []
  for (const draft of drafts ?? []) {
    const constraint = draft.constraint.trim()
    const target = draft.target.trim()
    const description = draft.description?.trim()
    if (!constraint || !target) continue
    normalized.push({
      constraint,
      target,
      ...(description ? { description } : {}),
    })
  }
  return dedupeRelations(normalized)
}

export function hasDuplicateRelations(relations: readonly Relation[]): boolean {
  return (
    normalizeRelationDrafts(relations).length <
    countCompleteRelations(relations)
  )
}

export function hasSelfRelation(
  relations: readonly Relation[],
  currentRecordId: string | undefined
): boolean {
  const current = currentRecordId?.trim()
  if (!current) return false
  return relations.some((relation) => relation.target.trim() === current)
}

export function relationTargetOptionsFromReferences(
  references: Record<string, { pid?: string; title?: string }> | undefined
): RecordReferenceOption[] {
  return Object.entries(references ?? {}).map(([value, reference]) => {
    const pid = reference.pid?.trim()
    const title = reference.title?.trim()
    return {
      value,
      label:
        pid && title
          ? `${pid} - ${title}`
          : pid || title || shortReferenceId(value),
      meta: value,
      referenceState: 'resolved' as const,
    }
  })
}

function countCompleteRelations(relations: readonly Relation[]): number {
  return relations.filter(
    (relation) => relation.constraint.trim() && relation.target.trim()
  ).length
}

function relationKey(relation: Relation): string {
  return [
    relation.constraint.trim(),
    relation.target.trim(),
    relation.description?.trim() ?? '',
  ].join('\u0000')
}
