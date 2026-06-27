import type {
  Profile,
  RecordBody,
  RecordItem,
  RecordResponse,
} from '@labour-board/shared'
import { ClockIcon, PencilSquareIcon } from '@heroicons/react/20/solid'
import { useTranslation } from 'react-i18next'
import { AnimatedDrawer } from './ui/AnimatedDrawer'
import { Button } from './ui/Button'
import { ProfileAvatar } from './ProfileAvatar'
import { TagChipRow } from './BoardFilters'
import { lookupProfile } from '../utils/board'
import { formatProfileCompact } from '../utils/profileDisplay'

interface RecordDetailDrawerProps {
  open: boolean
  record: RecordResponse<RecordItem<RecordBody>> | null
  profiles?: Profile[] | null
  onClose: () => void
  onEditClick: (record: RecordResponse<RecordItem<RecordBody>>) => void
  onHistoryClick: (record: RecordResponse<RecordItem<RecordBody>>) => void
}

export function RecordDetailDrawer({
  open,
  record,
  profiles,
  onClose,
  onEditClick,
  onHistoryClick,
}: RecordDetailDrawerProps) {
  const { t } = useTranslation()

  if (!open || !record) return null

  const current = record.body
  const body = asDisplayBody(current.body)
  const title = body.title ?? current.pid
  const profile = lookupProfile(profiles ?? null, current.assignee ?? '')
  const assigneeDisplay = formatProfileCompact(
    current.assignee,
    profile,
    t('record.unassigned'),
    t('record.unknownMember'),
  )

  const footer = (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <Button
        type="button"
        onClick={() => onEditClick(record)}
        icon={<PencilSquareIcon className="h-4 w-4" />}
      >
        {t('record.edit')}
      </Button>
      <Button
        type="button"
        variant="ghost"
        onClick={() => onHistoryClick(record)}
        icon={<ClockIcon className="h-4 w-4" />}
      >
        {t('record.history')}
      </Button>
    </div>
  )

  return (
    <AnimatedDrawer
      open={open}
      onClose={onClose}
      title={title}
      subtitle={current.pid}
      size="md"
      closeLabel={t('record.close')}
      footer={footer}
    >
      <div className="grid content-start gap-4">
        {/* Assignee with avatar */}
        {current.assignee && (
          <section className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-4">
            <ProfileAvatar
              name={profile?.name ?? current.assignee}
              pk={current.assignee}
              avatarUrl={profile?.avatarUrl ?? null}
              size={32}
            />
            <div>
              <p className="text-sm font-semibold text-slate-900">
                {assigneeDisplay}
              </p>
              <p className="text-xs text-slate-500">{t('record.assignee')}</p>
            </div>
          </section>
        )}

        {/* Schema + created */}
        <dl className="grid gap-2 sm:grid-cols-2">
          <MetaItem label={t('record.schema')} value={current.schema} />
          <MetaItem label={t('record.created')} value={formatDate(record.createdAt)} />
        </dl>

        {/* Summary */}
        {body.description && (
          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="mb-2 text-xs font-bold uppercase text-slate-500">
              {t('edit.summary')}
            </h3>
            <p className="text-sm leading-relaxed text-slate-800">{body.description}</p>
          </section>
        )}

        {/* Details */}
        {body.content && (
          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="mb-2 text-xs font-bold uppercase text-slate-500">
              {t('edit.details')}
            </h3>
            <pre className="max-h-60 overflow-y-auto whitespace-pre-wrap break-words rounded bg-slate-50 p-3 text-sm leading-relaxed text-slate-800">
              {body.content}
            </pre>
          </section>
        )}

        {/* Tags */}
        {current.tags.length > 0 && (
          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="mb-2 text-xs font-bold uppercase text-slate-500">
              {t('filters.tag')}
            </h3>
            <TagChipRow tags={current.tags} readonly />
          </section>
        )}

        {/* Assets */}
        {(current.assets?.length ?? 0) > 0 && (
          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="mb-2 text-xs font-bold uppercase text-slate-500">
              {t('record.assets')}
            </h3>
            <ul className="grid gap-1">
              {current.assets?.map((asset) => (
                <li
                  key={asset}
                  className="truncate font-mono text-xs text-slate-700"
                  title={asset}
                >
                  {asset}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Relations */}
        {(current.relations?.length ?? 0) > 0 && (
          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="mb-2 text-xs font-bold uppercase text-slate-500">
              {t('record.relations')}
            </h3>
            <ul className="grid gap-1">
              {current.relations?.map((rel, i) => (
                <li
                  key={`${rel.constraint}:${rel.target}:${i}`}
                  className="truncate text-xs text-slate-700"
                  title={rel.target}
                >
                  {rel.constraint}: {rel.target}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </AnimatedDrawer>
  )
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid min-w-0 gap-0.5 rounded-md bg-slate-100 p-2.5">
      <dt className="text-xs font-bold uppercase text-slate-500">{label}</dt>
      <dd className="m-0 wrap-break-word text-slate-950">{value}</dd>
    </div>
  )
}

function asDisplayBody(body: RecordBody): {
  title?: string
  description?: string
  content?: string
} {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return {}
  }
  return {
    title: stringValue(body, 'title'),
    description: stringValue(body, 'description'),
    content: stringValue(body, 'content'),
  }
}

function stringValue(source: object, key: string): string | undefined {
  const value = (source as Record<string, unknown>)[key]
  return typeof value === 'string' && value.trim() ? value : undefined
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}
