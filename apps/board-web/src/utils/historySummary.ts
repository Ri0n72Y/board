import type {
  DeepPartial,
  PatchItem,
  RecordBody,
  RecordItem,
  RecordResponse,
  RelationRef,
  Tag,
} from '@labour-board/shared'
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
  relations: string
  modified: string
  itemCount: (count: number) => string
  fieldLabel: (namespace: string) => string
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
  }: {
    language: string | undefined
    copy: HistorySummaryCopy
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
    lines.push({
      label: copy.assignee,
      value: patch.assignee ?? copy.unassigned,
    })
  }

  if (patch.body !== undefined) {
    lines.push({
      label: copy.body,
      value: summarizeBodyPatch(patch.body, copy),
    })
  }

  if (patch.assets !== undefined) {
    lines.push({
      label: copy.assets,
      value: copy.itemCount(patch.assets.length),
    })
  }

  if (patch.relations !== undefined) {
    lines.push({
      label: copy.relations,
      value: copy.itemCount(patch.relations.length),
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
  return translate(`history.relation.${constraint}`, constraint)
}

export function formatRelationTarget(
  target: string,
  references: Record<string, HistoryReference> | undefined
): string {
  const reference = references?.[target]
  if (reference) {
    return `${reference.pid} ${reference.title}`.trim()
  }
  return shortRecordId(target)
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
  return (relations ?? []).map((relation) => {
    const constraint = formatRelationConstraint(relation.constraint, translate)
    const target = formatRelationTarget(relation.target, references)
    return relation.description
      ? `${constraint}${separator}${target} (${relation.description})`
      : `${constraint}${separator}${target}`
  })
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
  return keys.length > 0 ? keys.join(tagDelimiter(undefined)) : copy.modified
}

function tagDelimiter(language: string | undefined): string {
  return language === 'zh-CN' ? '\u3001' : ', '
}
