import type {
  DeepPartial,
  PatchItem,
  RecordBody,
  RecordItem,
  RecordResponse,
  RelationRef,
  Tag,
} from '@labour-board/shared'
import {
  formatRelationConstraint as formatSharedRelationConstraint,
  formatRelationLine,
  formatRelationTarget as formatSharedRelationTarget,
  relationTargetOptionsFromReferences,
  type RelationTranslator,
} from './relationDisplay'
import { formatReferenceList } from './referenceDisplay'
import type { RecordReferenceOption } from './recordReferenceOptions'
import { formatTagLabel } from './tagDisplay'

export type HistoryLanguage = 'en-US' | 'zh-CN'

export interface HistorySummaryCopy {
  tagAdded: string
  tagRemoved: string
  noVisibleChanges: string
  nullValue: string
  assignee: string
  unassigned: string
  body: string
  assets: string
  assetListEmpty: string
  relations: string
  modified: string
  itemCount: (count: number) => string
  fieldLabel: (namespace: string) => string
  bodyFieldLabel: (field: string) => string
  relationConstraintLabel: (constraint: string) => string
}

export interface HistoryReference {
  pid: string
  title: string
  schema: string
}

export interface PatchSummaryLine {
  label: string
  value: string
}

export interface PatchTimelineItem {
  patch: RecordResponse<PatchItem<DeepPartial<RecordBody>>>
  ordinal: number
  lines: PatchSummaryLine[]
  rawInitiallyOpen: false
}

export function buildPatchTimeline(
  patches: RecordResponse<PatchItem<DeepPartial<RecordBody>>>[],
  options: {
    language: string | undefined
    copy: HistorySummaryCopy
    references?: Record<string, HistoryReference>
    assetOptions?: RecordReferenceOption[]
    formatAssignee?: (pk: string | null | undefined) => string
  }
): PatchTimelineItem[] {
  return [...patches]
    .map((patch, index) => ({
      patch,
      ordinal: index + 1,
      lines: summarizePatch(patch.body, options),
      rawInitiallyOpen: false as const,
    }))
    .reverse()
}

export function summarizePatch(
  patch: PatchItem<DeepPartial<RecordBody>>,
  {
    language,
    copy,
    references,
    assetOptions = [],
    formatAssignee,
  }: {
    language: string | undefined
    copy: HistorySummaryCopy
    references?: Record<string, HistoryReference>
    assetOptions?: RecordReferenceOption[]
    formatAssignee?: (pk: string | null | undefined) => string
  }
): PatchSummaryLine[] {
  const lines: PatchSummaryLine[] = []
  const tagChanges = patch.tagChanges

  for (const change of tagChanges?.change ?? []) {
    lines.push({
      label: copy.fieldLabel(change.namespace),
      value: `${formatNullableTag(change.from, language, copy)} \u2192 ${formatNullableTag(
        change.to,
        language,
        copy
      )}`,
    })
  }

  if (tagChanges?.add?.length) {
    lines.push({
      label: copy.tagAdded,
      value: tagChanges.add
        .map((tag) => formatTagLabel(tag, language))
        .join(tagDelimiter(language)),
    })
  }

  if (tagChanges?.remove?.length) {
    lines.push({
      label: copy.tagRemoved,
      value: tagChanges.remove
        .map((tag) => formatTagLabel(tag, language))
        .join(tagDelimiter(language)),
    })
  }

  if ('assignee' in patch) {
    const rawValue = patch.assignee ?? null
    const displayValue = formatAssignee
      ? formatAssignee(rawValue)
      : rawValue ?? copy.unassigned
    lines.push({
      label: copy.assignee,
      value: displayValue,
    })
  }

  if (patch.body !== undefined) {
    lines.push({
      label: copy.body,
      value: summarizeBodyPatch(patch.body, copy),
    })
  }

  if (patch.assets !== undefined) {
    const assetSummary = formatAssets(patch.assets, assetOptions, language)
    lines.push({
      label: copy.assets,
      value: assetSummary || copy.assetListEmpty || copy.itemCount(0),
    })
  }

  if (patch.relations !== undefined) {
    const targetOptions = relationTargetOptionsFromReferences(references)
    const relationSummary = patch.relations
      .map((relation) =>
        formatRelationLine(relation, targetOptions, (key, options) =>
          relationLabelFromKey(key, options?.defaultValue, copy),
        ),
      )
      .join(relationListDelimiter(language))
    lines.push({
      label: copy.relations,
      value: relationSummary || copy.itemCount(patch.relations.length),
    })
  }

  return lines.length > 0
    ? lines
    : [{ label: copy.modified, value: copy.noVisibleChanges }]
}

export function formatRelationConstraint(
  constraint: string,
  translate: (key: string, fallback: string) => string
): string {
  return formatSharedRelationConstraint(constraint, (key, options) =>
    translate(key, options?.defaultValue ?? constraint),
  )
}

export function formatRelationTarget(
  target: string,
  references: Record<string, HistoryReference> | undefined
): string {
  return formatSharedRelationTarget(target, relationTargetOptionsFromReferences(references))
}

export function shortRecordId(id: string): string {
  if (id.length <= 12) return id
  return `${id.slice(0, 4)}...${id.slice(-5)}`
}

export function formatRelations(
  relations: RelationRef[] | undefined,
  references: Record<string, HistoryReference> | undefined,
  translate: (key: string, fallback: string) => string,
  separator = ': '
): string[] {
  const targetOptions = relationTargetOptionsFromReferences(references)
  const relationTranslate: RelationTranslator = (key, options) =>
    translate(key, options?.defaultValue ?? key)
  return (relations ?? []).map((relation) => {
    const constraint = formatSharedRelationConstraint(relation.constraint, relationTranslate)
    const target = formatSharedRelationTarget(relation.target, targetOptions)
    const description = relation.description?.trim()
    return description
      ? `${constraint}${separator}${target} (${description})`
      : `${constraint}${separator}${target}`
  })
}

export function formatAssets(
  assets: readonly string[] | undefined,
  assetOptions: readonly RecordReferenceOption[],
  language: string | undefined,
): string {
  return formatReferenceList(assets, assetOptions)
    .map((item) => item.label)
    .join(relationListDelimiter(language))
}

export function debugInitiallyOpen(): false {
  return false
}

export function titleFromBody(body: RecordBody | undefined): string | undefined {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return undefined
  const value = (body as Record<string, unknown>).title
  return typeof value === 'string' && value.trim() ? value : undefined
}

export function statusSummaryText(
  record: RecordItem<RecordBody> | undefined,
  language: string | undefined
): string | undefined {
  const status = record?.tags.find((tag) => tag.startsWith('status:'))
  return status ? formatTagLabel(status, language) : undefined
}

function formatNullableTag(
  tag: Tag | null,
  language: string | undefined,
  copy: HistorySummaryCopy
): string {
  return tag ? formatTagLabel(tag, language) : copy.nullValue
}

function summarizeBodyPatch(
  body: DeepPartial<RecordBody>,
  copy: HistorySummaryCopy
): string {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return copy.modified
  }
  const keys = Object.keys(body)
  if (keys.length === 0) return copy.modified
  return `${keys.map((key) => copy.bodyFieldLabel(key)).join(tagDelimiter(undefined))} ${copy.modified}`
}

function tagDelimiter(language: string | undefined): string {
  return language === 'zh-CN' ? '\u3001' : ', '
}

function relationListDelimiter(language: string | undefined): string {
  return language === 'zh-CN' ? '\uff1b' : '; '
}

function relationLabelFromKey(
  key: string,
  fallback: string | undefined,
  copy: HistorySummaryCopy,
): string {
  const relationPrefix = 'relations.constraint.'
  const historyPrefix = 'history.relation.'
  if (key.startsWith(relationPrefix)) {
    return copy.relationConstraintLabel(key.slice(relationPrefix.length))
  }
  if (key.startsWith(historyPrefix)) {
    return copy.relationConstraintLabel(key.slice(historyPrefix.length))
  }
  return fallback ?? key
}
