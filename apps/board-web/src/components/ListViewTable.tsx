import { useMemo, useState } from 'react'
import type {
  Profile,
  RecordBody,
  RecordItem,
  RecordResponse,
} from '@labour-board/shared'
import { useTranslation } from 'react-i18next'
import {
  EllipsisHorizontalIcon,
  ChevronUpIcon,
  ChevronDownIcon,
} from '@heroicons/react/20/solid'
import { cn } from '../lib/cn'
import { ProfileAvatar } from './ProfileAvatar'
import { Button } from './ui/Button'
import { AnimatedDrawer } from './ui/AnimatedDrawer'
import { lookupProfile } from '../utils/board'
import { formatTagLabel } from '../utils/tagDisplay'
import { priorityLevel } from '../utils/columnDensity'
import {
  moveListViewColumnByOffset,
  readListViewColumnOrder,
  resolveListViewColumnOrder,
  writeListViewColumnOrder,
} from '../utils/listViewPreference'
import {
  LIST_COLUMNS,
  type ListColumnDef,
  type ListSortKey,
} from '../utils/listViewColumns'
import type { BoardStatusColumn } from '../utils/boardView'

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
  const [isManageColumnsOpen, setIsManageColumnsOpen] = useState(false)
  const [columnOrder, setColumnOrder] = useState<string[]>(() =>
    resolveListViewColumnOrder(
      LIST_COLUMNS.map((c) => c.key),
      readListViewColumnOrder()
    )
  )

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(lang, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }),
    [lang]
  )

  const formatCreatedAt = (value: string) => {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return dateFormatter.format(date)
  }

  const orderedColumns = useMemo(
    () =>
      columnOrder
        .map((key) => LIST_COLUMNS.find((c) => c.key === key))
        .filter((c): c is ListColumnDef => c != null),
    [columnOrder]
  )

  const sorted = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1
    return [...records].sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'pid':
          cmp = a.body.pid.localeCompare(b.body.pid, undefined, {
            numeric: true,
          })
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
          cmp =
            (pa == null ? 99 : PRIORITY_RANK[pa]) -
            (pb == null ? 99 : PRIORITY_RANK[pb])
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

  const moveColumn = (key: string, offset: number) => {
    setColumnOrder((order) => {
      const next = moveListViewColumnByOffset(order, key, offset)
      writeListViewColumnOrder(next)
      return next
    })
  }

  const headerCell = (column: ListColumnDef) => {
    const active = sortKey === column.key
    return (
      <th
        scope="col"
        className="px-3 py-2 text-left"
        aria-sort={
          active ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined
        }
      >
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => toggleSort(column.key)}
            className={cn(
              'inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide transition-colors',
              active
                ? 'text-slate-950'
                : 'text-slate-500 hover:text-slate-800'
            )}
          >
            {t(column.labelKey)}
            <span aria-hidden="true" className="text-[10px]">
              {active ? (sortDir === 'asc' ? '↑' : '↓') : ''}
            </span>
          </button>
          <button
            type="button"
            className="inline-flex h-5 w-5 items-center justify-center rounded text-slate-400 hover:bg-slate-200 hover:text-slate-700"
            title={t('list.columnMenu')}
            aria-label={`${t('list.columnMenu')}: ${t(column.labelKey)}`}
            onClick={() => setIsManageColumnsOpen(true)}
          >
            <EllipsisHorizontalIcon className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </th>
    )
  }

  const renderCell = (record: RecordResponse<RecordItem<RecordBody>>, key: ListSortKey) => {
    switch (key) {
      case 'pid':
        return (
          <td className="px-3 py-2 font-mono text-xs text-slate-500">
            {record.body.pid}
          </td>
        )
      case 'title':
        return (
          <td className="max-w-[22rem] truncate px-3 py-2 font-medium text-slate-950">
            {titleOf(record)}
          </td>
        )
      case 'status': {
        const statusTag = statusOf(record)
        return (
          <td className="px-3 py-2">
            <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
              {statusTag ? formatTagLabel(statusTag, lang) : '—'}
            </span>
          </td>
        )
      }
      case 'priority': {
        const level = priorityLevel(record)
        return (
          <td className="px-3 py-2">
            {level != null ? (
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
        )
      }
      case 'assignee': {
        const assignee = record.body.assignee
        const profile = assignee
          ? lookupProfile(profiles ?? null, assignee)
          : null
        return (
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
        )
      }
      case 'createdAt':
        return (
          <td className="px-3 py-2 text-xs tabular-nums text-slate-500">
            {formatCreatedAt(record.createdAt)}
          </td>
        )
    }
  }

  return (
    <>
      <div className="overflow-x-auto overscroll-behavior-contain rounded-lg border border-slate-200 bg-white">
        <table className="w-full min-w-[44rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              {orderedColumns.map((column) => headerCell(column))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((record) => {
              const rowLabel = `${record.body.pid} ${titleOf(record)}`
              return (
                <tr
                  key={record.body.id}
                  aria-label={rowLabel}
                  className="cursor-pointer border-b border-slate-100 transition-colors last:border-b-0 hover:bg-slate-50 [content-visibility:auto] [contain-intrinsic-size:auto_44px]"
                  onClick={() => onCardClick(record)}
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      onCardClick(record)
                    }
                  }}
                >
                  {orderedColumns.map((column) =>
                    renderCell(record, column.key)
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <ManageColumnsDrawer
        open={isManageColumnsOpen}
        columns={orderedColumns}
        onClose={() => setIsManageColumnsOpen(false)}
        onMoveColumn={moveColumn}
        t={t}
      />
    </>
  )
}

function ManageColumnsDrawer({
  open,
  columns,
  onClose,
  onMoveColumn,
  t,
}: {
  open: boolean
  columns: ListColumnDef[]
  onClose: () => void
  onMoveColumn: (key: string, offset: number) => void
  t: (key: string) => string
}) {
  return (
    <AnimatedDrawer
      open={open}
      onClose={onClose}
      title={t('list.manageColumns')}
      subtitle={t('list.manageColumnsSubtitle')}
      size="sm"
      closeLabel={t('list.close')}
    >
      <ol className="grid gap-1.5">
        {columns.map((column, index) => (
          <li
            key={column.key}
            className="flex min-h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
          >
            <span className="min-w-0 flex-1 truncate">
              {t(column.labelKey)}
            </span>
            <span className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                disabled={index === 0}
                onClick={() => onMoveColumn(column.key, -1)}
                title={t('list.moveLeft')}
                aria-label={`${t('list.moveLeft')}: ${t(column.labelKey)}`}
                className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-200 bg-white text-slate-500 transition-colors hover:border-emerald-500 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronUpIcon className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                disabled={index === columns.length - 1}
                onClick={() => onMoveColumn(column.key, 1)}
                title={t('list.moveRight')}
                aria-label={`${t('list.moveRight')}: ${t(column.labelKey)}`}
                className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-200 bg-white text-slate-500 transition-colors hover:border-emerald-500 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronDownIcon className="h-4 w-4" aria-hidden="true" />
              </button>
            </span>
          </li>
        ))}
      </ol>
      <div className="mt-4 flex justify-end">
        <Button type="button" variant="ghost" onClick={onClose}>
          {t('list.done')}
        </Button>
      </div>
    </AnimatedDrawer>
  )
}
