import { useMemo, useState } from 'react'
import type {
  Profile,
  RecordBody,
  RecordItem,
  RecordResponse,
} from '@labour-board/shared'
import { useTranslation } from 'react-i18next'
import { cn } from '../lib/cn'
import { ProfileAvatar } from './ProfileAvatar'
import { lookupProfile } from '../utils/board'
import { formatTagLabel } from '../utils/tagDisplay'
import {
  priorityLevel,
  PRIORITY_ORDER,
} from '../utils/columnDensity'
import type { BoardStatusColumn } from '../utils/boardView'

export type ListSortKey = 'pid' | 'title' | 'status' | 'priority' | 'assignee' | 'createdAt'
export type ListSortDirection = 'asc' | 'desc'

interface ListViewTableProps {
  records: RecordResponse<RecordItem<RecordBody>>[]
  profiles?: Profile[] | null
  columns: BoardStatusColumn[]
  lang?: string
  onCardClick: (record: RecordResponse<RecordItem<RecordBody>>) => void
}

const PRIORITY_RANK: Record<string, number> = {
  p0: 0,
  p1: 1,
  p2: 2,
  p3: 3,
}

function statusOf(record: RecordResponse<RecordItem<RecordBody>>) {
  return record.body.tags.find((tag) => tag.startsWith('status:')) ?? ''
}

function titleOf(record: RecordResponse<RecordItem<RecordBody>>) {
  const body = record.body.body as Record<string, unknown> | undefined
  return typeof body?.title === 'string' && body.title.trim() !== ''
    ? body.title
    : record.body.pid
}

export function ListViewTable({
  records,
  profiles,
  columns,
  lang = 'en-US',
  onCardClick,
}: ListViewTableProps) {
  const { t } = useTranslation()
  const [sortKey, setSortKey] = useState<ListSortKey>('pid')
  const [sortDir, setSortDir] = useState<ListSortDirection>('asc')

  const sorted = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1
    return [...records].sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'pid':
          cmp = a.body.pid.localeCompare(b.body.pid)
          break
        case 'title':
          cmp = titleOf(a).localeCompare(titleOf(b))
          break
        case 'status': {
          const sa = statusOf(a)
          const sb = statusOf(b)
          const ia = columns.findIndex((c) => c.tag === sa)
          const ib = columns.findIndex((c) => c.tag === sb)
          cmp = (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib)
          break
        }
        case 'priority': {
          const pa = priorityLevel(a)
          const pb = priorityLevel(b)
          cmp = (pa == null ? 99 : PRIORITY_RANK[pa]) - (pb == null ? 99 : PRIORITY_RANK[pb])
          break
        }
        case 'assignee':
          cmp = (a.body.assignee ?? '').localeCompare(b.body.assignee ?? '')
          break
        case 'createdAt':
          cmp = a.createdAt.localeCompare(b.createdAt)
          break
      }
      return cmp * dir
    })
  }, [records, sortKey, sortDir, columns])

  const toggleSort = (key: ListSortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const headerCell = (key: ListSortKey, label: string) => {
    const active = sortKey === key
    return (
      <th
        scope="col"
        className="px-3 py-2 text-left"
        aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined}
      >
        <button
          type="button"
          onClick={() => toggleSort(key)}
          className={cn(
            'inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide transition-colors',
            active
              ? 'text-slate-950'
              : 'text-slate-500 hover:text-slate-800'
          )}
        >
          {label}
          <span aria-hidden="true" className="text-[10px]">
            {active ? (sortDir === 'asc' ? '↑' : '↓') : ''}
          </span>
        </button>
      </th>
    )
  }

  return (
    <div className="overflow-x-auto overscroll-behavior-contain rounded-lg border border-slate-200 bg-white">
      <table className="w-full min-w-[44rem] border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            {headerCell('pid', t('list.pid'))}
            {headerCell('title', t('list.title'))}
            {headerCell('status', t('list.status'))}
            {headerCell('priority', t('list.priority'))}
            {headerCell('assignee', t('list.assignee'))}
            {headerCell('createdAt', t('list.createdAt'))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((record) => {
            const statusTag = statusOf(record)
            const level = priorityLevel(record)
            const assignee = record.body.assignee
            const profile = assignee ? lookupProfile(profiles ?? null, assignee) : null
            const dotClass = level ? PRIORITY_ORDER.includes(level) : false
            return (
              <tr
                key={record.body.id}
                className="cursor-pointer border-b border-slate-100 transition-colors last:border-b-0 hover:bg-slate-50"
                onClick={() => onCardClick(record)}
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onCardClick(record)
                  }
                }}
              >
                <td className="px-3 py-2 font-mono text-xs text-slate-500">
                  {record.body.pid}
                </td>
                <td className="max-w-[22rem] truncate px-3 py-2 font-medium text-slate-950">
                  {titleOf(record)}
                </td>
                <td className="px-3 py-2">
                  <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                    {statusTag ? formatTagLabel(statusTag, lang) : '—'}
                  </span>
                </td>
                <td className="px-3 py-2">
                  {level && dotClass ? (
                    <span
                      className="inline-flex items-center gap-1 text-xs text-slate-600"
                      title={formatTagLabel(`priority:${level}`, lang)}
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          'h-1.5 w-1.5 rounded-full',
                          {
                            p0: 'bg-red-500',
                            p1: 'bg-amber-500',
                            p2: 'bg-sky-500',
                            p3: 'bg-slate-300',
                          }[level]
                        )}
                      />
                      {formatTagLabel(`priority:${level}`, lang)}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {assignee && profile ? (
                    <span className="inline-flex items-center gap-1.5">
                      <ProfileAvatar
                        name={profile.name ?? assignee}
                        pk={assignee}
                        avatarUrl={profile.avatarUrl}
                        size={18}
                        className="ring-1 ring-slate-200"
                      />
                      <span className="truncate text-xs text-slate-600">
                        {profile.name ?? assignee}
                      </span>
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </td>
                <td className="px-3 py-2 text-xs tabular-nums text-slate-500">
                  {new Intl.DateTimeFormat(lang, {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  }).format(new Date(record.createdAt))}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
