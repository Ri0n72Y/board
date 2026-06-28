export type TagGroupKey =
  | 'status'
  | 'priority'
  | 'epic'
  | 'sprint'
  | 'owner'
  | 'scope'
  | 'type'
  | 'milestone'
  | 'asset'
  | 'transaction'
  | 'other'

export interface TagGroup {
  key: TagGroupKey
  tags: string[]
}

const NAMESPACE_ORDER: readonly TagGroupKey[] = [
  'status',
  'priority',
  'epic',
  'sprint',
  'owner',
  'scope',
  'type',
  'milestone',
  'asset',
  'transaction',
  'other',
]

const NAMESPACE_PREFIXES: Record<string, TagGroupKey> = {
  status: 'status',
  priority: 'priority',
  epic: 'epic',
  sprint: 'sprint',
  owner: 'owner',
  scope: 'scope',
  type: 'type',
  milestone: 'milestone',
  asset: 'asset',
  transaction: 'transaction',
}

/**
 * Group tags by their canonical namespace.
 * Unknown / custom / bare tags go to `other`.
 */
export function groupTagsByNamespace(tags: string[]): TagGroup[] {
  const groups = new Map<TagGroupKey, string[]>()

  for (const tag of tags) {
    const ns = inferNamespace(tag)
    const list = groups.get(ns) ?? []
    list.push(tag)
    groups.set(ns, list)
  }

  const result: TagGroup[] = []
  for (const key of NAMESPACE_ORDER) {
    const list = groups.get(key)
    if (list && list.length > 0) {
      result.push({ key, tags: sortTagsInGroup(key, list) })
    }
  }

  return result
}

function inferNamespace(tag: string): TagGroupKey {
  const colonIdx = tag.indexOf(':')
  if (colonIdx > 0) {
    const prefix = tag.slice(0, colonIdx)
    if (prefix in NAMESPACE_PREFIXES) {
      return NAMESPACE_PREFIXES[prefix]
    }
  }
  return 'other'
}

function sortTagsInGroup(key: TagGroupKey, tags: string[]): string[] {
  const sorted = [...tags]
  switch (key) {
    case 'sprint':
    case 'epic': {
      // Numeric sort for epic/sprint
      sorted.sort((a, b) => {
        const na = extractNumber(a)
        const nb = extractNumber(b)
        if (na !== null && nb !== null) return na - nb
        return a.localeCompare(b)
      })
      return sorted
    }
    default: {
      sorted.sort((a, b) => a.localeCompare(b))
      return sorted
    }
  }
}

function extractNumber(tag: string): number | null {
  const match = /(\d+)$/.exec(tag)
  return match ? Number(match[1]) : null
}

/** I18n labels for tag group headings. */
export const TAG_GROUP_I18N_KEYS: Record<TagGroupKey, string> = {
  status: 'filters.group.status',
  priority: 'filters.group.priority',
  epic: 'filters.group.epic',
  sprint: 'filters.group.sprint',
  owner: 'filters.group.owner',
  scope: 'filters.group.scope',
  type: 'filters.group.type',
  milestone: 'filters.group.milestone',
  asset: 'filters.group.asset',
  transaction: 'filters.group.transaction',
  other: 'filters.group.other',
}
