import type {
  RecordBody,
  RecordItem,
  RecordResponse,
} from '@labour-board/shared'

export const PRIORITY_ORDER = ['p0', 'p1', 'p2', 'p3'] as const
export type PriorityLevel = (typeof PRIORITY_ORDER)[number]

export function priorityLevel(
  record: RecordResponse<RecordItem<RecordBody>>
): PriorityLevel | null {
  const tag = record.body.tags.find((t) => t.startsWith('priority:'))
  if (!tag) return null
  const level = tag.slice('priority:'.length).toLowerCase()
  return (PRIORITY_ORDER as readonly string[]).includes(level)
    ? (level as PriorityLevel)
    : null
}

export interface ColumnDensity {
  priorityCounts: Map<PriorityLevel, number>
  /** Sorted public keys of assignees, most frequent first. */
  assignees: string[]
  totalAssignees: number
}

export function buildColumnDensity(
  records: RecordResponse<RecordItem<RecordBody>>[]
): ColumnDensity {
  const priorityCounts = new Map<PriorityLevel, number>()
  const assigneeFreq = new Map<string, number>()

  for (const record of records) {
    const level = priorityLevel(record)
    if (level) priorityCounts.set(level, (priorityCounts.get(level) ?? 0) + 1)
    const assignee = record.body.assignee
    if (assignee)
      assigneeFreq.set(assignee, (assigneeFreq.get(assignee) ?? 0) + 1)
  }

  const assignees = [...assigneeFreq.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([pk]) => pk)

  return {
    priorityCounts,
    assignees,
    totalAssignees: assigneeFreq.size,
  }
}
