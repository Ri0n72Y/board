import type {
  BoardConfig,
  BoardCurrentProjection,
  Profile,
  Tag,
  TagDefinition,
} from '@labour-board/shared'
import type { BoardCurrentFilters } from '../api/boardCurrent'

export function hasEffectiveFilters(filters: BoardCurrentFilters): boolean {
  return (
    filters.q.trim().length > 0 ||
    filters.tags.length > 0 ||
    filters.assignee.trim().length > 0 ||
    filters.assetId.trim().length > 0 ||
    filters.relationTarget.trim().length > 0
  )
}

/** Extract unique tags from the current projection's records. */
export function extractKnownTags(
  projection: BoardCurrentProjection | null,
): Tag[] {
  const values = new Set<Tag>()
  for (const record of projection?.records ?? []) {
    for (const tag of record.body.tags) {
      values.add(tag)
    }
  }
  return [...values].sort()
}

/** Merge projection tags with config-defined tags, deduped and sorted. */
export function mergeKnownTags(
  projection: BoardCurrentProjection | null,
  config: BoardConfig | null,
): Tag[] {
  const values = new Set<Tag>()

  // Projection tags
  for (const record of projection?.records ?? []) {
    for (const tag of record.body.tags) {
      values.add(tag)
    }
  }

  // Config tags
  if (config) {
    const tagLists: TagDefinition[][] = [
      config.tags.status.required,
      config.tags.status.custom,
      config.tags.priority.defaults,
      config.tags.priority.custom,
      config.tags.asset.defaults,
      config.tags.asset.custom,
      config.tags.transaction.defaults,
      config.tags.transaction.custom,
      config.tags.custom,
    ]
    for (const list of tagLists) {
      for (const def of list) {
        values.add(def.id)
      }
    }
  }

  return [...values].sort()
}

/** Look up a profile by public key. Returns undefined if not found. */
export function lookupProfile(
  profiles: Profile[] | null,
  pk: string | undefined | null,
): Profile | undefined {
  if (!profiles || !pk) return undefined
  return profiles.find((p) => p.pk === pk)
}

/** Extract status tag options (Tag ids only) from config. */
export function getConfigStatusTags(config: BoardConfig | null): Tag[] {
  if (!config) return []
  const tags = new Set<Tag>()
  for (const def of config.tags.status.required) tags.add(def.id)
  for (const def of config.tags.status.custom) tags.add(def.id)
  return [...tags].sort()
}

/** Extract priority tag options (Tag ids only) from config. */
export function getConfigPriorityTags(config: BoardConfig | null): Tag[] {
  if (!config) return []
  const tags = new Set<Tag>()
  for (const def of config.tags.priority.defaults) tags.add(def.id)
  for (const def of config.tags.priority.custom) tags.add(def.id)
  return [...tags].sort()
}

/** Extract all configured non-status/non-priority tags for Create/Edit. */
export function getConfigOtherTags(config: BoardConfig | null): Tag[] {
  if (!config) return []
  const tags = new Set<Tag>()
  for (const def of config.tags.custom) tags.add(def.id)
  for (const def of config.tags.asset.defaults) tags.add(def.id)
  for (const def of config.tags.asset.custom) tags.add(def.id)
  for (const def of config.tags.transaction.defaults) tags.add(def.id)
  for (const def of config.tags.transaction.custom) tags.add(def.id)
  return [...tags].sort()
}

/** Get display name for a tag from config definitions. */
export function getTagDisplayFromConfig(
  tag: Tag,
  config: BoardConfig | null,
): string | undefined {
  if (!config) return undefined
  const allDefs: TagDefinition[] = [
    ...config.tags.status.required,
    ...config.tags.status.custom,
    ...config.tags.priority.defaults,
    ...config.tags.priority.custom,
    ...config.tags.asset.defaults,
    ...config.tags.asset.custom,
    ...config.tags.transaction.defaults,
    ...config.tags.transaction.custom,
    ...config.tags.custom,
  ]
  return allDefs.find((d) => d.id === tag)?.displayName
}

/** Extract assignee options (profiles) as {value, label} for select dropdown. */
export function getProfileOptions(
  profiles: Profile[] | null,
): { value: string; label: string }[] {
  if (!profiles) return []
  return profiles.map((p) => ({ value: p.pk, label: p.name }))
}
