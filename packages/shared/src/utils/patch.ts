import type { DeepPartial, PatchItem } from '../interfaces/patch.js'
import type { RecordItem } from '../interfaces/record.js'
import type { Tag } from '../interfaces/tag.js'
import { DEFAULT_BOARD_CONFIG } from '../constants/boardConfig.js'
import { hasTag } from './tags.js'

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  )
}

export function applyDeepPartial<T>(current: T, patch: DeepPartial<T>): T {
  if (patch === undefined) {
    return current
  }

  if (patch === null || Array.isArray(patch)) {
    return patch as T
  }

  if (!isPlainObject(current) || !isPlainObject(patch)) {
    return patch as T
  }

  const next: Record<string, unknown> = { ...current }
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) {
      continue
    }

    next[key] = applyDeepPartial(next[key], value as DeepPartial<unknown>)
  }

  return next as T
}

export function applyRecordPatch<TBody>(
  record: RecordItem<TBody>,
  patch: PatchItem<DeepPartial<TBody>>
): RecordItem<TBody> {
  // The service layer is responsible for validating patch.pid/schema/targetId.
  let assignee = patch.assignee
  if (assignee === undefined) assignee = record.assignee
  return {
    ...record,
    tags: patch.tags ?? record.tags,
    assignee,
    body:
      patch.body === undefined
        ? record.body
        : applyDeepPartial(record.body, patch.body),
    assets: patch.assets ?? record.assets,
    relations: patch.relations ?? record.relations,
  }
}

export function shouldIncludeInSnapshot(
  record: RecordItem,
  excludeTags: readonly Tag[] = DEFAULT_BOARD_CONFIG.snapshot.excludeTags
): boolean {
  return !excludeTags.some((tag) => hasTag(record.tags, tag))
}
