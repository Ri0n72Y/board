import {
  shortReferenceId,
  type RecordReferenceOption,
} from './recordReferenceOptions'

export type ReferenceDisplayItem = {
  value: string
  label: string
  meta?: string
  resolved: boolean
}

export function formatReferenceLabel(
  value: string,
  options: readonly RecordReferenceOption[],
): string {
  return formatReferenceItem(value, options).label
}

export function formatReferenceItem(
  value: string,
  options: readonly RecordReferenceOption[],
): ReferenceDisplayItem {
  const trimmed = value.trim()
  const option = options.find((candidate) => candidate.value === trimmed)
  if (option) {
    return {
      value: trimmed,
      label: option.label,
      meta: option.meta ?? trimmed,
      resolved: option.referenceState === 'resolved',
    }
  }
  return {
    value: trimmed,
    label: shortReferenceId(trimmed),
    meta: trimmed,
    resolved: false,
  }
}

export function formatReferenceList(
  values: readonly string[] | undefined,
  options: readonly RecordReferenceOption[],
): ReferenceDisplayItem[] {
  return (values ?? [])
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => formatReferenceItem(value, options))
}

export function summarizeReferenceList(
  values: readonly string[] | undefined,
  options: readonly RecordReferenceOption[],
  maxVisible: number,
): {
  visible: ReferenceDisplayItem[]
  hiddenCount: number
} {
  const items = formatReferenceList(values, options)
  const visibleCount = Math.max(0, maxVisible)
  return {
    visible: items.slice(0, visibleCount),
    hiddenCount: Math.max(items.length - visibleCount, 0),
  }
}
