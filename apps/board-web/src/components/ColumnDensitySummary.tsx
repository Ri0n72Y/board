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
import {
  buildColumnDensity,
  PRIORITY_ORDER,
  type PriorityLevel,
} from '../utils/columnDensity'

const PRIORITY_DOT_CLASS: Record<PriorityLevel, string> = {
  p0: 'bg-red-500',
  p1: 'bg-amber-500',
  p2: 'bg-sky-500',
  p3: 'bg-slate-300',
}

const MAX_ASSIGNEE_AVATARS = 4

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

  const density = buildColumnDensity(records)
  const shownPriorities = PRIORITY_ORDER.filter((level) =>
    density.priorityCounts.has(level)
  )
  const shownAssignees = density.assignees.slice(0, MAX_ASSIGNEE_AVATARS)
  const hiddenAssigneeCount = Math.max(
    density.totalAssignees - shownAssignees.length,
    0
  )

  if (shownPriorities.length === 0 && shownAssignees.length === 0) return null

  return (
    <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
      {shownPriorities.length > 0 && (
        <div
          className="flex min-w-0 flex-1 flex-wrap items-center gap-1"
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
              {density.priorityCounts.get(level)}
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
