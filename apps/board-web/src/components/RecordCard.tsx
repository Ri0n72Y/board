import type {
  Profile,
  RecordBody,
  RecordItem,
  RecordResponse,
  Tag,
} from '@labour-board/shared'
import { useTranslation } from 'react-i18next'
import { TagChipRow } from './BoardFilters'
import { MoveStatusControl } from './MoveStatusControl'
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
import type { MoveStatusOption } from '../utils/statusMove'

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
  moveStatusOptions?: MoveStatusOption[]
  moveStatusError?: string | null
  isMovingStatus?: boolean
  onCardClick?: (record: RecordResponse<RecordItem<RecordBody>>) => void
  onMoveStatus?: (
    record: RecordResponse<RecordItem<RecordBody>>,
    targetStatusTag: Tag
  ) => void
}

export function RecordCard({
  record,
  profiles,
  assetOptions,
  relationTargetOptions,
  compact = false,
  moveStatusOptions = [],
  moveStatusError,
  isMovingStatus = false,
  onCardClick,
  onMoveStatus,
}: RecordCardProps) {
  const { t } = useTranslation()
  const current = record.body
  const body = asDisplayBody(current.body)
  const title = body.title ?? current.pid
  const currentStatus =
    current.tags.find((tag) => tag.startsWith('status:')) ?? null
  const profile = lookupProfile(profiles ?? null, current.assignee ?? '')
  const assigneeDisplay = formatProfileCompact(
    current.assignee,
    profile,
    t('record.unassigned'),
    t('record.unknownMember')
  )

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
        className="flex h-fit w-full cursor-pointer flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 transition hover:border-slate-400 hover:shadow-sm"
        onClick={handleClick}
        role="button"
        tabIndex={0}
        onKeyDown={handleKeyDown}
      >
        <div className="min-w-0 shrink-0">
          <p className="mb-0.5 font-mono text-xs text-slate-500">
            {current.pid}
          </p>
          <h3 className="line-clamp-2 text-sm font-semibold leading-tight text-slate-950">
            {title}
          </h3>
        </div>

        <div className="min-w-0 shrink-0">
          <AssigneeCompact
            pk={current.assignee}
            profile={profile}
            displayText={assigneeDisplay}
          />
        </div>

        {current.tags.length > 0 ? (
          <div className="max-h-7 shrink-0 overflow-hidden">
            <TagChipRow tags={current.tags} readonly />
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

        {onMoveStatus && moveStatusOptions.length > 0 && (
          <div
            data-card-interactive="true"
            className="shrink-0 border-t border-slate-100 pt-2"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <MoveStatusControl
              currentStatus={currentStatus}
              options={moveStatusOptions}
              isMoving={isMovingStatus}
              error={moveStatusError}
              onMove={(targetStatusTag) =>
                onMoveStatus(record, targetStatusTag)
              }
            />
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
  const visibleRelations = (relations ?? []).slice(0, maxVisible)
  const hiddenCount = Math.max(
    (relations?.length ?? 0) - visibleRelations.length,
    0
  )
  const translate: RelationTranslator = (key, options) =>
    t(key, { defaultValue: options?.defaultValue ?? key })
  if (compact && (!relations || relations.length === 0)) return null

  return (
    <section className={compact ? 'grid gap-1.5' : 'grid gap-2'}>
      <h3 className="text-sm font-semibold text-slate-500">
        {t('record.relations')}
      </h3>
      {relations && relations.length > 0 ? (
        <ul className="grid gap-1.5">
          {visibleRelations.map((relation, index) => (
            <li
              className={
                compact
                  ? 'min-w-0 truncate text-xs text-slate-700'
                  : 'min-w-0 wrap-break-word text-xs text-slate-700'
              }
              key={`${relation.constraint}:${relation.target}:${index}`}
              title={relation.target}
            >
              {formatRelationLine(relation, relationTargetOptions, translate)}
            </li>
          ))}
          {hiddenCount > 0 && (
            <li className="text-xs font-medium text-slate-500">
              {t('record.moreRelations', { count: hiddenCount })}
            </li>
          )}
        </ul>
      ) : (
        !compact && <p className="text-slate-500">{t('relations.none')}</p>
      )}
    </section>
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
