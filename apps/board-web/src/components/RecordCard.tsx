import type {
  Profile,
  RecordBody,
  RecordItem,
  RecordResponse,
  Tag,
} from '@labour-board/shared'
import { ClockIcon, PencilSquareIcon } from '@heroicons/react/20/solid'
import { useTranslation } from 'react-i18next'
import { Button } from './ui/Button'
import { TagChipRow } from './BoardFilters'
import { MoveStatusControl } from './MoveStatusControl'
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
import type { MoveStatusOption } from '../utils/statusMove'

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
  onHistoryClick?: (record: RecordResponse<RecordItem<RecordBody>>) => void
  onEditClick?: (record: RecordResponse<RecordItem<RecordBody>>) => void
  onMoveStatus?: (
    record: RecordResponse<RecordItem<RecordBody>>,
    targetStatusTag: Tag,
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
  onHistoryClick,
  onEditClick,
  onMoveStatus,
}: RecordCardProps) {
  const { t } = useTranslation()
  const current = record.body
  const body = asDisplayBody(current.body)
  const title = body.title ?? current.pid
  const currentStatus = current.tags.find((tag) => tag.startsWith('status:')) ?? null

  if (compact) {
    return (
      <article className="grid gap-3 rounded-lg border border-slate-200 bg-white p-3">
        <div className="grid gap-2">
          <div className="min-w-0">
            <p className="mb-1 font-mono text-xs text-slate-500">
              {current.pid}
            </p>
            <h3 className="wrap-break-word text-base font-semibold leading-tight text-slate-950">
              {title}
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              className="min-h-8 px-2.5 text-xs"
              onClick={() => onEditClick?.(record)}
              title={t('record.editTitle')}
              icon={<PencilSquareIcon className="h-4 w-4" />}
            >
              {t('record.edit')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="min-h-8 px-2.5 text-xs"
              onClick={() => onHistoryClick?.(record)}
              title={t('record.openHistory')}
              icon={<ClockIcon className="h-4 w-4" />}
            >
              {t('record.history')}
            </Button>
          </div>
        </div>

        <dl className="grid gap-2">
          <MetaItem
            label={t('record.assignee')}
            value={formatAssignee(current.assignee, profiles, t)}
          />
        </dl>

        {current.tags.length > 0 ? (
          <TagChipRow tags={current.tags} readonly />
        ) : (
          <p className="text-sm text-slate-500">{t('record.noTags')}</p>
        )}

        <ReferenceList
          label={t('record.assets')}
          values={current.assets ?? []}
          options={assetOptions}
          maxVisible={2}
          compact
        />

        <RelationsList
          relations={current.relations ?? []}
          relationTargetOptions={relationTargetOptions}
          maxVisible={2}
          compact
        />

        {onMoveStatus && moveStatusOptions.length > 0 && (
          <MoveStatusControl
            currentStatus={currentStatus}
            options={moveStatusOptions}
            isMoving={isMovingStatus}
            error={moveStatusError}
            onMove={(targetStatusTag) => onMoveStatus(record, targetStatusTag)}
          />
        )}
      </article>
    )
  }

  return (
    <article className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5">
      <div className="grid gap-3 sm:flex sm:justify-between">
        <div>
          <p className="mb-1 font-mono text-xs text-slate-500">{current.pid}</p>
          <h2 className="text-lg font-semibold leading-tight text-slate-950">
            {title}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onEditClick?.(record)}
            title={t('record.editTitle')}
            icon={<PencilSquareIcon className="h-4 w-4" />}
          >
            {t('record.edit')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onHistoryClick?.(record)}
            title={t('record.openHistory')}
            icon={<ClockIcon className="h-4 w-4" />}
          >
            {t('record.history')}
          </Button>
        </div>
      </div>

      <dl className="grid gap-2 sm:grid-cols-3">
        <MetaItem
          label={t('record.assignee')}
          value={formatAssignee(current.assignee, profiles, t)}
        />
        <MetaItem label={t('record.schema')} value={current.schema} />
        <MetaItem label={t('record.created')} value={formatDate(record.createdAt)} />
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
            <ReferenceListItem item={item} key={`${item.value}:${index}`} />
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

function ReferenceListItem({ item }: { item: ReferenceDisplayItem }) {
  return (
    <li className="min-w-0 wrap-break-word text-xs text-slate-700" title={item.meta}>
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
  const hiddenCount = Math.max((relations?.length ?? 0) - visibleRelations.length, 0)
  const translate: RelationTranslator = (key, options) =>
    t(key, { defaultValue: options?.defaultValue ?? key })
  if (compact && (!relations || relations.length === 0)) return null

  return (
    <section className={compact ? 'grid gap-1.5' : 'grid gap-2'}>
      <h3 className="text-sm font-semibold text-slate-500">{t('record.relations')}</h3>
      {relations && relations.length > 0 ? (
        <ul className="grid gap-1.5">
          {visibleRelations.map((relation, index) => (
            <li
              className="min-w-0 wrap-break-word text-xs text-slate-700"
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

function formatAssignee(
  pk: string | undefined | null,
  profiles: Profile[] | null | undefined,
  t: (key: string) => string,
): string {
  if (!pk || pk.trim() === '') return t('record.unassigned')
  const profile = lookupProfile(profiles ?? null, pk)
  if (profile) {
    return `${profile.name} (${pk.slice(0, 6)}…${pk.slice(-4)})`
  }
  return `${t('record.unknownMember')} (${pk.slice(0, 6)}…${pk.slice(-4)})`
}
