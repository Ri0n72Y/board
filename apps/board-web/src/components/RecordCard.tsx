import { useState } from 'react'
import type { Ref } from 'react'
import type {
  Profile,
  RecordBody,
  RecordItem,
  RecordResponse,
  Tag,
} from '@labour-board/shared'
import { useTranslation } from 'react-i18next'
import { TagChipRow } from './BoardFilters'
import { ProfileAvatar } from './ProfileAvatar'
import { lookupProfile } from '../utils/board'
import {
  formatRelationLine,
  type RelationTranslator,
} from '../utils/relationDisplay'
import type { RecordReferenceOption } from '../utils/recordReferenceOptions'
import {
  summarizeReferenceList,
  type ReferenceDisplayItem,
} from '../utils/referenceDisplay'
import { formatProfileCompact } from '../utils/profileDisplay'
import { formatTagLabel } from '../utils/tagDisplay'
import { cn } from '../lib/cn'

/** Tags that, when clicked inside a card, should NOT trigger card detail open. */
const INTERACTIVE_SELECTOR =
  'button, a, input, select, textarea, [data-card-interactive="true"]'

function isInteractiveTarget(
  target: EventTarget | null,
  currentTarget: EventTarget
): boolean {
  if (target === currentTarget) return false
  if (!(target instanceof Element)) return false
  return target.closest(INTERACTIVE_SELECTOR) !== null
}

interface RecordCardProps {
  record: RecordResponse<RecordItem<RecordBody>>
  /** Profiles for assignee name resolution. */
  profiles?: Profile[] | null
  assetOptions: RecordReferenceOption[]
  relationTargetOptions: RecordReferenceOption[]
  compact?: boolean
  moveStatusError?: string | null
  isMovingStatus?: boolean
  isDragging?: boolean
  dragRef?: Ref<HTMLElement>
  statusTags?: Tag[]
  onStatusChange?: (
    record: RecordResponse<RecordItem<RecordBody>>,
    statusTag: Tag
  ) => void
  onCardClick?: (record: RecordResponse<RecordItem<RecordBody>>) => void
}

export function RecordCard({
  record,
  profiles,
  assetOptions,
  relationTargetOptions,
  compact = false,
  moveStatusError,
  isMovingStatus = false,
  isDragging = false,
  dragRef,
  statusTags,
  onStatusChange,
  onCardClick,
}: RecordCardProps) {
  const { t, i18n } = useTranslation()
  const isZh = (i18n.resolvedLanguage ?? i18n.language).startsWith('zh')
  const movingLabel = t('move.moving', {
    defaultValue: isZh ? '移动中…' : 'Moving…',
  })
  const current = record.body
  const body = asDisplayBody(current.body)
  const title = body.title ?? current.pid
  const profile = lookupProfile(profiles ?? null, current.assignee ?? '')
  const assigneeDisplay = formatProfileCompact(
    current.assignee,
    profile,
    t('record.unassigned'),
    t('record.unknownMember')
  )
  const statusTag = current.tags.find((tag) => tag.startsWith('status:')) ?? null
  const nonStatusTags = current.tags.filter((tag) => !tag.startsWith('status:'))

  const handleClick = (event: React.MouseEvent) => {
    if (isInteractiveTarget(event.target as EventTarget, event.currentTarget))
      return
    onCardClick?.(record)
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.target !== event.currentTarget) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onCardClick?.(record)
    }
  }

  if (compact) {
    return (
      <article
        ref={dragRef}
        className={cn(
          'flex h-fit w-full cursor-pointer flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 transition hover:border-slate-400 hover:shadow-sm',
          isDragging && 'border-emerald-400 opacity-70 ring-2 ring-emerald-200'
        )}
        onClick={handleClick}
        role="button"
        tabIndex={0}
        onKeyDown={handleKeyDown}
      >
        <div className="flex min-w-0 shrink-0 items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="mb-0.5 font-mono text-xs text-slate-500">
              {current.pid}
            </p>
            <h3 className="line-clamp-2 text-sm font-semibold leading-tight text-slate-950">
              {title}
            </h3>
          </div>
        </div>

        {statusTag && (
          <div className="shrink-0">
            <StatusBadgeMenu
              tag={statusTag}
              tags={statusTags ?? []}
              onChange={(nextTag) => onStatusChange?.(record, nextTag)}
            />
          </div>
        )}

        <div className="min-w-0 shrink-0">
          <AssigneeCompact
            pk={current.assignee}
            profile={profile}
            displayText={assigneeDisplay}
          />
        </div>

        {nonStatusTags.length > 0 ? (
          <div className="max-h-7 shrink-0 overflow-hidden">
            <TagChipRow tags={nonStatusTags} readonly />
          </div>
        ) : (
          <p className="text-xs text-slate-400">{t('record.noTags')}</p>
        )}

        <ReferenceList
          label={t('record.assets')}
          values={current.assets ?? []}
          options={assetOptions}
          maxVisible={1}
          compact
        />

        <RelationsList
          relations={current.relations ?? []}
          relationTargetOptions={relationTargetOptions}
          maxVisible={1}
          compact
        />

        {(isMovingStatus || moveStatusError) && (
          <div data-card-interactive="true" className="grid gap-1">
            {isMovingStatus && (
              <p className="rounded-md bg-emerald-50 px-2 py-1.5 text-xs font-medium text-emerald-700">
                {movingLabel}
              </p>
            )}
            {moveStatusError && (
              <p
                className="rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-700"
                role="alert"
              >
                {t(moveStatusError, { defaultValue: moveStatusError })}
              </p>
            )}
          </div>
        )}
      </article>
    )
  }

  return (
    <article
      className="grid cursor-pointer gap-4 rounded-lg border border-slate-200 bg-white p-5 transition hover:border-slate-400 hover:shadow-sm max-w-3xl"
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <div className="grid gap-3 sm:flex sm:justify-between">
        <div>
          <p className="mb-1 font-mono text-xs text-slate-500">{current.pid}</p>
          <h2 className="text-lg font-semibold leading-tight text-slate-950">
            {title}
          </h2>
        </div>
        <AssigneeCompact
          pk={current.assignee}
          profile={profile}
          displayText={assigneeDisplay}
        />
      </div>

      <dl className="grid gap-2 sm:grid-cols-2">
        <MetaItem label={t('record.schema')} value={current.schema} />
        <MetaItem
          label={t('record.created')}
          value={formatDate(record.createdAt)}
        />
      </dl>

      {(body.description || body.content) && (
        <div className="grid gap-2 leading-relaxed text-slate-800">
          {body.description && <p>{body.description}</p>}
          {body.content && (
            <pre className="whitespace-pre-wrap wrap-break-word font-sans">
              {body.content}
            </pre>
          )}
        </div>
      )}

      {current.tags.length > 0 ? (
        <TagChipRow tags={current.tags} readonly />
      ) : (
        <p className="text-slate-500">{t('record.noTags')}</p>
      )}

      <ReferenceList
        label={t('record.assets')}
        values={current.assets ?? []}
        options={assetOptions}
        maxVisible={3}
      />
      <RelationsList
        relations={current.relations ?? []}
        relationTargetOptions={relationTargetOptions}
        maxVisible={3}
      />
    </article>
  )
}

const STATUS_DOT_STYLES: Record<string, string> = {
  'status:todo': 'bg-slate-400',
  'status:backlog': 'bg-amber-400',
  'status:doing': 'bg-blue-500',
  'status:done': 'bg-emerald-500',
  'status:blocked': 'bg-red-500',
}

function StatusBadgeMenu({
  tag,
  tags,
  onChange,
}: {
  tag: Tag
  tags: Tag[]
  onChange: (tag: Tag) => void
}) {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage ?? i18n.language
  const [open, setOpen] = useState(false)
  const statusLabel = formatTagLabel(tag, lang)
  const options = tags.length > 0 ? tags : [tag]
  const dotColor = STATUS_DOT_STYLES[tag] ?? 'bg-emerald-500'

  return (
    <div className="relative inline-block">
      <button
        type="button"
        data-card-interactive="true"
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition',
          open
            ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
            : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-400 hover:text-emerald-700'
        )}
        onClick={(event) => {
          event.stopPropagation()
          setOpen((value) => !value)
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={cn('h-1.5 w-1.5 rounded-full', dotColor)} />
        <span>{statusLabel}</span>
        <span aria-hidden="true" className="text-[10px] opacity-70">
          ▾
        </span>
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            data-card-interactive="true"
            onClick={(event) => {
              event.stopPropagation()
              setOpen(false)
            }}
          />
          <div
            role="listbox"
            aria-label={t('move.statusOptions', {
              defaultValue: 'Change status',
            })}
            className="absolute left-0 top-full z-20 mt-1 min-w-36 rounded-lg border border-slate-200 bg-white p-1 shadow-lg"
          >
            {options.map((option) => (
              <button
                key={option}
                type="button"
                role="option"
                aria-selected={option === tag}
                data-card-interactive="true"
                className={cn(
                  'flex w-full items-center gap-1.5 rounded-md px-2.5 py-1.5 text-left text-xs transition',
                  option === tag
                    ? 'bg-emerald-50 font-semibold text-emerald-700'
                    : 'text-slate-700 hover:bg-slate-100'
                )}
                onClick={(event) => {
                  event.stopPropagation()
                  if (option !== tag) onChange(option)
                  setOpen(false)
                }}
              >
                <span
                  className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    STATUS_DOT_STYLES[option] ?? 'bg-emerald-500'
                  )}
                />
                <span>{formatTagLabel(option, lang)}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function AssigneeCompact({
  pk,
  profile,
  displayText,
}: {
  pk?: string | null
  profile: Profile | undefined | null
  displayText: string
}) {
  if (!pk) return null
  return (
    <div className="flex shrink-0 items-center gap-2" title={displayText}>
      <ProfileAvatar
        name={profile?.name ?? pk}
        pk={pk}
        avatarUrl={profile?.avatarUrl ?? null}
        size={24}
      />
      <span className="truncate text-xs text-slate-500">{displayText}</span>
    </div>
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

function ReferenceList({
  label,
  values,
  options,
  maxVisible,
  compact = false,
}: {
  label: string
  values: string[]
  options: RecordReferenceOption[]
  maxVisible: number
  compact?: boolean
}) {
  const { t } = useTranslation()
  const summary = summarizeReferenceList(values, options, maxVisible)
  if (compact && summary.visible.length === 0) return null

  return (
    <section className={compact ? 'grid gap-1.5' : 'grid gap-2'}>
      <h3 className="text-sm font-semibold text-slate-500">{label}</h3>
      {summary.visible.length > 0 ? (
        <ul className="grid gap-1.5">
          {summary.visible.map((item, index) => (
            <ReferenceListItem
              item={item}
              key={`${item.value}:${index}`}
              compact={compact}
            />
          ))}
          {summary.hiddenCount > 0 && (
            <li className="text-xs font-medium text-slate-500">
              {t('record.moreAssets', { count: summary.hiddenCount })}
            </li>
          )}
        </ul>
      ) : (
        <p className="text-slate-500">{t('history.assetListEmpty')}</p>
      )}
    </section>
  )
}

function ReferenceListItem({
  item,
  compact = false,
}: {
  item: ReferenceDisplayItem
  compact?: boolean
}) {
  return (
    <li
      className={
        compact
          ? 'min-w-0 truncate text-xs text-slate-700'
          : 'min-w-0 wrap-break-word text-xs text-slate-700'
      }
      title={item.meta}
    >
      {item.label}
    </li>
  )
}

function RelationsList({
  relations,
  relationTargetOptions,
  maxVisible,
  compact = false,
}: {
  relations: RecordItem<RecordBody>['relations']
  relationTargetOptions: RecordReferenceOption[]
  maxVisible: number
  compact?: boolean
}) {
  const { t } = useTranslation()
  const translator: RelationTranslator = (key, params) =>
    t(key, params ?? {}) as string
  const items = (relations ?? []).map((relation) =>
    formatRelationLine(relation, relationTargetOptions, translator)
  )
  if (compact && items.length === 0) return null
  const visible = items.slice(0, maxVisible)
  const hiddenCount = Math.max(0, items.length - visible.length)

  return (
    <section className={compact ? 'grid gap-1.5' : 'grid gap-2'}>
      <h3 className="text-sm font-semibold text-slate-500">
        {t('record.relations')}
      </h3>
      {visible.length > 0 ? (
        <ul className="grid gap-1.5">
          {visible.map((item, index) => (
            <li
              key={`${item}:${index}`}
              className={
                compact
                  ? 'min-w-0 truncate text-xs text-slate-700'
                  : 'min-w-0 wrap-break-word text-xs text-slate-700'
              }
              title={item}
            >
              {item}
            </li>
          ))}
          {hiddenCount > 0 && (
            <li className="text-xs font-medium text-slate-500">
              {t('record.moreRelations', { count: hiddenCount })}
            </li>
          )}
        </ul>
      ) : (
        <p className="text-slate-500">{t('relations.none')}</p>
      )}
    </section>
  )
}

function asDisplayBody(body: RecordBody): Record<string, string> {
  if (!body || typeof body !== 'object') return {}
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(body)) {
    if (typeof value === 'string') result[key] = value
  }
  return result
}

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return dateTimeFormatter.format(date)
}
