import type {
  RecordBody,
  RecordItem,
  RecordResponse,
} from '@labour-board/shared'
import type { SearchSelectOption } from './searchSelect'

export interface RecordReferenceOption extends SearchSelectOption {
  referenceState?: 'resolved' | 'unknown-asset' | 'unknown-record'
}

export interface RecordReferenceCopy {
  unknownAsset: string
  unknownRecord: string
  rawId: string
}

export const DEFAULT_RECORD_REFERENCE_COPY: RecordReferenceCopy = {
  unknownAsset: 'Unknown asset',
  unknownRecord: 'Unknown record',
  rawId: 'Raw ID',
}

type CurrentRecord = RecordResponse<RecordItem<RecordBody>>
type UnknownReferenceKind = 'asset' | 'record'

export function buildRecordReferenceOptions(
  records: CurrentRecord[]
): RecordReferenceOption[] {
  return records.map(formatRecordReference).sort(compareResolvedOptions)
}

export function buildAssetReferenceOptions(
  records: CurrentRecord[],
  copy: RecordReferenceCopy = DEFAULT_RECORD_REFERENCE_COPY
): RecordReferenceOption[] {
  const recordById = buildRecordMap(records)
  const resolved = new Map<string, RecordReferenceOption>()
  const unknown = new Map<string, RecordReferenceOption>()

  for (const record of records) {
    if (record.body.schema === 'AssetBody') {
      resolved.set(record.body.id, formatRecordReference(record))
    }
  }

  for (const record of records) {
    for (const assetId of record.body.assets ?? []) {
      const target = recordById.get(assetId)
      if (target) {
        resolved.set(assetId, formatRecordReference(target))
        unknown.delete(assetId)
      } else if (!resolved.has(assetId) && !unknown.has(assetId)) {
        unknown.set(assetId, formatUnknownReference(assetId, 'asset', copy))
      }
    }
  }

  return [
    ...[...resolved.values()].sort(compareResolvedOptions),
    ...[...unknown.values()].sort(compareRawValueOptions),
  ]
}

export function buildRelationTargetOptions(
  records: CurrentRecord[],
  copy: RecordReferenceCopy = DEFAULT_RECORD_REFERENCE_COPY
): RecordReferenceOption[] {
  const recordById = buildRecordMap(records)
  const resolved = new Map<string, RecordReferenceOption>()
  const unknown = new Map<string, RecordReferenceOption>()

  for (const record of records) {
    resolved.set(record.body.id, formatRecordReference(record))
  }

  for (const record of records) {
    for (const relation of record.body.relations ?? []) {
      const target = recordById.get(relation.target)
      if (target) {
        resolved.set(relation.target, formatRecordReference(target))
        unknown.delete(relation.target)
      } else if (
        !resolved.has(relation.target) &&
        !unknown.has(relation.target)
      ) {
        unknown.set(
          relation.target,
          formatUnknownReference(relation.target, 'record', copy)
        )
      }
    }
  }

  return [
    ...[...resolved.values()].sort(compareResolvedOptions),
    ...[...unknown.values()].sort(compareRawValueOptions),
  ]
}

export function formatRecordReference(
  record: CurrentRecord
): RecordReferenceOption {
  const id = record.body.id
  const pid = record.body.pid?.trim()
  const title = titleFromBody(record.body.body)
  const displayTitle = title || pid || shortReferenceId(id)
  const label = pid && title ? `${pid} - ${displayTitle}` : displayTitle
  const assignee = record.body.assignee?.trim()

  return {
    value: id,
    label,
    description: assignee
      ? `${record.body.schema} / ${assignee}`
      : record.body.schema,
    meta: id,
    referenceState: 'resolved',
  }
}

export function formatUnknownReference(
  id: string,
  kind: UnknownReferenceKind = 'record',
  copy: RecordReferenceCopy = DEFAULT_RECORD_REFERENCE_COPY
): RecordReferenceOption {
  const referenceState = kind === 'asset' ? 'unknown-asset' : 'unknown-record'
  return {
    value: id,
    label: shortReferenceId(id),
    description: kind === 'asset' ? copy.unknownAsset : copy.unknownRecord,
    meta: id,
    referenceState,
  }
}

export function ensureReferenceOptions(
  options: RecordReferenceOption[],
  selectedValues: readonly string[],
  kind: UnknownReferenceKind = 'record',
  copy: RecordReferenceCopy = DEFAULT_RECORD_REFERENCE_COPY
): RecordReferenceOption[] {
  const byValue = new Map(options.map((option) => [option.value, option]))
  const missing = selectedValues
    .filter((value) => value && !byValue.has(value))
    .map((value) => formatUnknownReference(value, kind, copy))

  return missing.length > 0 ? [...options, ...missing] : options
}

export function mergeReferenceOptions(
  previous: readonly RecordReferenceOption[],
  current: readonly RecordReferenceOption[]
): RecordReferenceOption[] {
  const merged = new Map(previous.map((option) => [option.value, option]))
  for (const option of current) {
    const existing = merged.get(option.value)
    if (existing && !isUnknownOption(existing) && isUnknownOption(option)) {
      continue
    }
    merged.set(option.value, option)
  }
  return [...merged.values()]
}

export function getReferenceDisplayLabel(
  options: readonly RecordReferenceOption[],
  value: string
): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  return (
    options.find((option) => option.value === trimmed)?.label ??
    shortReferenceId(trimmed)
  )
}

export function shortReferenceId(id: string): string {
  const trimmed = id.trim()
  if (trimmed.length <= 12) return trimmed
  return `${trimmed.slice(0, 8)}...${trimmed.slice(-4)}`
}

function buildRecordMap(records: CurrentRecord[]) {
  return new Map(records.map((record) => [record.body.id, record]))
}

function titleFromBody(body: RecordBody): string | undefined {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return undefined
  const value = (body as Record<string, unknown>).title
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function isUnknownOption(option: RecordReferenceOption): boolean {
  return (
    option.referenceState === 'unknown-asset' ||
    option.referenceState === 'unknown-record'
  )
}

function compareResolvedOptions(
  left: RecordReferenceOption,
  right: RecordReferenceOption
): number {
  return left.label.localeCompare(right.label, undefined, {
    numeric: true,
    sensitivity: 'base',
  })
}

function compareRawValueOptions(
  left: RecordReferenceOption,
  right: RecordReferenceOption
): number {
  return left.value.localeCompare(right.value, undefined, {
    numeric: true,
    sensitivity: 'base',
  })
}
