import type {
  Profile,
  RecordBody,
  RecordItem,
  RecordResponse,
} from '@labour-board/shared'
import { useTranslation } from 'react-i18next'
import { ProfileAvatar } from './ProfileAvatar'
import { lookupProfile } from '../utils/board'
import { formatTagLabel } from '../utils/tagDisplay'

const PRIORITY_ORDER = ['p0', 'p1', 'p2', 'p3']

const PRIORITY_DOT_CLASS: Record<string, string> = {
  p0: 'bg-red-500',
  p1: 'bg-amber-500',
  p2: 'bg-sky-500',
  p3: 'bg-slate-300',
}

function priorityLevel(record: RecordResponse<RecordItem<RecordBody>>) {
  const tag = record.body.tags.find((tag) => tag.startsWith('priority:'))
  if (!tag) return null
  const level = tag.slice('priority:'.length).toLowerCase()
  return PRIORITY_ORDER.includes(level) ? level : null
}

interface ColumnDensitySummaryProps {
  records: RecordResponse<RecordItem<RecordBody>>[]
  profiles?: Profile[] | null
  lang?: string
}

/**
 * Aggregated metadata shown under a board column header: priority distribution
 * dots and stacked assignee avatars.
 */
export function ColumnDensitySummary({
  records,
  profiles,
  lang = 'en-US',
}: ColumnDensitySummaryProps) {
  const { t } = useTranslation()

  if (records.length === 0) return null

  const priorityCounts = new Map<string, number>()
  const assigneeCounts = new Map<string, number>()
  for (const record of records) {
    const level = priorityLevel(record)
    if (level) priorityCounts.set(level, (priorityCounts.get(level) ?? 0) + 1)
    const assignee = record.body.assignee
    if (assignee) assigneeCounts.set(assignee, (assigneeCounts.get(assignee) ?? 0) + 1)
  }

  const shownPriorities = PRIORITY_ORDER.filter((level) =>
    priorityCounts.has(level)
  )
  const shownAssignees = [...assigneeCounts.keys()].slice(0, 4)
  const hiddenAssigneeCount = Math.max(
    assigneeCounts.size - shownAssignees.length,
    0
  )

  if (shownPriorities.length === 0 && shownAssignees.length === 0) return null

  return (
    <div className="mt-1.5 flex min-w-0 items-center gap-2">
      {shownPriorities.length > 0 && (
        <div
          className="flex min-w-0 items-center gap-1"
          aria-label={t('board.columnPriorityDistribution')}
        >
          {shownPriorities.map((level) => (
            <span
              key={level}
              className="inline-flex min-w-[1.375rem] items-center justify-center gap-1 rounded-full bg-white px-1 py-0.5 text-[10px] font-semibold text-slate-600"
              title={formatTagLabel(`priority:${level}`, lang)}
            >
              <span
                aria-hidden="true"
                className={`h-1.5 w-1.5 rounded-full ${PRIORITY_DOT_CLASS[level]}`}
              />
              {priorityCounts.get(level)}
            </span>
          ))}
        </div>
      )}

      {shownAssignees.length > 0 && (
        <div
          className="ml-auto flex shrink-0 items-center"
          aria-label={t('board.columnAssignees')}
        >
          <div className="flex -space-x-1.5">
            {shownAssignees.map((pk) => {
              const profile = lookupProfile(profiles ?? null, pk)
              return (
                <ProfileAvatar
                  key={pk}
                  name={profile?.name ?? pk}
                  pk={pk}
                  avatarUrl={profile?.avatarUrl}
                  size={20}
                  className="ring-2 ring-slate-100"
                />
              )
            })}
          </div>
          {hiddenAssigneeCount > 0 && (
            <span className="ml-1 text-[10px] font-medium text-slate-400">
              +{hiddenAssigneeCount}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
