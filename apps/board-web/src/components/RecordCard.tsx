import type {
  Profile,
  RecordBody,
  RecordItem,
  RecordResponse,
} from '@labour-board/shared'
import { ClockIcon, PencilSquareIcon } from '@heroicons/react/20/solid'
import { useTranslation } from 'react-i18next'
import { Button } from './ui/Button'
import { TagChipRow } from './BoardFilters'
import { lookupProfile } from '../utils/board'

interface RecordCardProps {
  record: RecordResponse<RecordItem<RecordBody>>
  /** Profiles for assignee name resolution. */
  profiles?: Profile[] | null
  compact?: boolean
  onHistoryClick?: (record: RecordResponse<RecordItem<RecordBody>>) => void
  onEditClick?: (record: RecordResponse<RecordItem<RecordBody>>) => void
}

export function RecordCard({
  record,
  profiles,
  compact = false,
  onHistoryClick,
  onEditClick,
}: RecordCardProps) {
  const { t } = useTranslation()
  const current = record.body
  const body = asDisplayBody(current.body)
  const title = body.title ?? current.pid

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
              title="Edit record"
              icon={<PencilSquareIcon className="h-4 w-4" />}
            >
              Edit
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="min-h-8 px-2.5 text-xs"
              onClick={() => onHistoryClick?.(record)}
              title="Open history"
              icon={<ClockIcon className="h-4 w-4" />}
            >
              History
            </Button>
          </div>
        </div>

        <dl className="grid gap-2">
          <MetaItem
            label="Assignee"
            value={formatAssignee(current.assignee, profiles, t)}
          />
        </dl>

        {current.tags.length > 0 ? (
          <TagChipRow tags={current.tags} readonly />
        ) : (
          <p className="text-sm text-slate-500">No tags</p>
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
            title="Edit record"
            icon={<PencilSquareIcon className="h-4 w-4" />}
          >
            Edit
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onHistoryClick?.(record)}
            title="Open history"
            icon={<ClockIcon className="h-4 w-4" />}
          >
            History
          </Button>
        </div>
      </div>

      <dl className="grid gap-2 sm:grid-cols-3">
        <MetaItem
          label="Assignee"
          value={formatAssignee(current.assignee, profiles, t)}
        />
        <MetaItem label="Schema" value={current.schema} />
        <MetaItem label="Created" value={formatDate(record.createdAt)} />
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
        <p className="text-slate-500">No tags</p>
      )}

      <ReferenceList label="Assets" values={current.assets ?? []} />
      <RelationsList relations={current.relations ?? []} />
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

function ReferenceList({ label, values }: { label: string; values: string[] }) {
  return (
    <section className="grid gap-2">
      <h3 className="text-sm font-semibold text-slate-500">{label}</h3>
      {values.length > 0 ? (
        <ul className="grid gap-1.5">
          {values.map((value) => (
            <li className="break-all font-mono text-xs" key={value}>
              {value}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-slate-500">None</p>
      )}
    </section>
  )
}

function RelationsList({
  relations,
}: {
  relations: RecordItem<RecordBody>['relations']
}) {
  return (
    <section className="grid gap-2">
      <h3 className="text-sm font-semibold text-slate-500">Relations</h3>
      {relations && relations.length > 0 ? (
        <ul className="grid gap-1.5">
          {relations.map((relation) => (
            <li
              className="flex min-w-0 flex-wrap gap-2 break-all font-mono text-xs"
              key={`${relation.constraint}:${relation.target}`}
            >
              <strong>{relation.constraint}</strong>
              <span>{relation.target}</span>
              {relation.description && (
                <em className="font-sans text-slate-500">
                  {relation.description}
                </em>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-slate-500">None</p>
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
    return `${profile.name} (${pk})`
  }
  return pk
}
