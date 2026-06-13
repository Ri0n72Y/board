import type { Tag, TagChanges } from '@labour-board/shared'

const SINGLE_VALUE_NAMESPACES = new Set([
  'status',
  'priority',
  'epic',
  'sprint',
  'owner',
  'type',
  'milestone',
])

export function buildTagChanges(
  originalTags: readonly Tag[],
  editedTags: readonly Tag[],
): TagChanges | undefined {
  const originalByNamespace = groupTagsByNamespace(originalTags)
  const editedByNamespace = groupTagsByNamespace(editedTags)
  const namespaces = new Set([
    ...originalByNamespace.keys(),
    ...editedByNamespace.keys(),
  ])
  const add: Tag[] = []
  const remove: Tag[] = []
  const change: NonNullable<TagChanges['change']> = []

  for (const namespace of namespaces) {
    const original = originalByNamespace.get(namespace) ?? []
    const edited = editedByNamespace.get(namespace) ?? []

    if (SINGLE_VALUE_NAMESPACES.has(namespace)) {
      const from = original[0] ?? null
      const to = edited[0] ?? null
      if (from !== to) {
        change.push({ namespace, from, to })
      }
      continue
    }

    const originalSet = new Set(original)
    const editedSet = new Set(edited)
    for (const tag of edited) {
      if (!originalSet.has(tag)) add.push(tag)
    }
    for (const tag of original) {
      if (!editedSet.has(tag)) remove.push(tag)
    }
  }

  const tagChanges: TagChanges = {}
  if (add.length > 0) tagChanges.add = add
  if (remove.length > 0) tagChanges.remove = remove
  if (change.length > 0) tagChanges.change = change

  return Object.keys(tagChanges).length > 0 ? tagChanges : undefined
}

function groupTagsByNamespace(tags: readonly Tag[]): Map<string, Tag[]> {
  const groups = new Map<string, Tag[]>()
  for (const tag of tags) {
    const namespace = tag.slice(0, tag.indexOf(':'))
    const list = groups.get(namespace) ?? []
    list.push(tag)
    groups.set(namespace, list)
  }
  return groups
}
