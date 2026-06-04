import type {
  DeepPartial,
  PatchItem,
  Profile,
  RecordBody,
  RecordHistoryResponse,
  RecordItem,
  RecordResponse,
} from '@labour-board/shared'
import { ExclamationTriangleIcon, XMarkIcon } from '@heroicons/react/20/solid'
import { Button } from './ui/Button'
import { Badge } from './ui/Badge'
import { TagChipRow } from './BoardFilters'
import { lookupProfile } from '../utils/board'

interface RecordHistoryDrawerProps {
  open: boolean
  recordId: string | null
  title?: string
  pid?: string
  history: RecordHistoryResponse | null
  isLoading: boolean
  error: string | null
  profiles?: Profile[] | null
  onClose: () => void
}

export function RecordHistoryDrawer({
  open,
  recordId,
  title,
  pid,
  history,
  isLoading,
  error,
  profiles,
  onClose,
}: RecordHistoryDrawerProps) {
  if (!open) return null

  const baseRecord = history?.record.body
  const finalState = history?.replay?.finalState
  const displayTitle =
    title ?? titleFromBody(finalState?.body) ?? titleFromBody(baseRecord?.body)

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/30"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <aside
        aria-labelledby="record-history-title"
        aria-modal="true"
        className="ml-auto grid h-full w-full max-w-3xl grid-rows-[auto_1fr] overflow-hidden border-l border-slate-200 bg-stone-50 text-slate-950 shadow-xl"
        role="dialog"
      >
        <header className="flex min-w-0 items-start justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4">
          <div className="min-w-0">
            <p className="mb-1 font-mono text-xs text-slate-500">
              {pid ?? recordId ?? 'History'}
            </p>
            <h2
              className="wrap-break-word text-xl font-semibold leading-tight"
              id="record-history-title"
            >
              {displayTitle ?? 'Record history'}
            </h2>
          </div>
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            title="Close history"
            icon={<XMarkIcon className="h-4 w-4" />}
          >
            Close
          </Button>
        </header>

        <div className="min-h-0 overflow-y-auto px-5 py-4">
          {isLoading && (
            <section className="rounded-lg border border-slate-200 bg-white p-5 text-slate-500">
              Loading record history...
            </section>
          )}

          {error && (
            <section
              className="grid gap-1.5 rounded-lg border border-red-300 bg-red-50 p-5 text-red-800"
              role="alert"
            >
              <strong>Failed to load record history</strong>
              <span>{error}</span>
            </section>
          )}

          {!isLoading && !error && history && (
            <div className="grid gap-4">
              <HistoryStatus history={history} />
              <RecordOverview
                record={history.record}
                finalState={history.replay?.finalState}
                profiles={profiles}
              />
              <RecordSnapshot
                title="Base record"
                record={history.record.body}
                profiles={profiles}
              />
              <PatchList patches={history.patches} />
              <FinalState finalState={history.replay?.finalState} />
              <Diagnostics diagnostics={history.diagnostics ?? []} />
            </div>
          )}

          {!isLoading && !error && !history && (
            <section className="rounded-lg border border-slate-200 bg-white p-5 text-slate-500">
              No history loaded.
            </section>
          )}
        </div>
      </aside>
    </div>
  )
}

function HistoryStatus({ history }: { history: RecordHistoryResponse }) {
  const isComplete = history.status === 'complete' || history.status === 'empty'

  return (
    <section
      className={
        isComplete
          ? 'flex flex-wrap items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-900'
          : 'flex flex-wrap items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900'
      }
      role={isComplete ? undefined : 'alert'}
    >
      {!isComplete && <ExclamationTriangleIcon className="h-5 w-5 shrink-0" />}
      <span className="text-sm font-semibold">History status</span>
      <Badge>{history.status}</Badge>
      {!isComplete && (
        <span className="text-sm">
          Replay is not complete. Review diagnostics before trusting final state.
        </span>
      )}
    </section>
  )
}

function RecordOverview({
  record,
  finalState,
  profiles,
}: {
  record: RecordResponse<RecordItem<RecordBody>>
  finalState?: RecordItem<RecordBody>
  profiles?: Profile[] | null
}) {
  const current = finalState ?? record.body

  return (
    <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-5">
      <h3 className="text-sm font-semibold uppercase text-slate-500">
        Basic information
      </h3>
      <dl className="grid gap-2 sm:grid-cols-2">
        <MetaItem label="Record id" value={record.body.id} mono />
        <MetaItem label="PID" value={record.body.pid} mono />
        <MetaItem label="Schema" value={record.body.schema} />
        <MetaItem
          label="Current title"
          value={titleFromBody(current.body) ?? 'None'}
        />
        <MetaItem label="Created at" value={formatDate(record.createdAt)} />
        <MetaItem label="Created by" value={record.createdBy} mono />
        <MetaItem
          label="Assignee"
          value={formatAssignee(current.assignee, profiles)}
        />
      </dl>
    </section>
  )
}

function RecordSnapshot({
  title,
  record,
  profiles,
}: {
  title: string
  record: RecordItem<RecordBody>
  profiles?: Profile[] | null
}) {
  return (
    <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-5">
      <h3 className="text-sm font-semibold uppercase text-slate-500">
        {title}
      </h3>
      <dl className="grid gap-2 sm:grid-cols-2">
        <MetaItem label="PID" value={record.pid} mono />
        <MetaItem label="Schema" value={record.schema} />
        <MetaItem
          label="Assignee"
          value={formatAssignee(record.assignee, profiles)}
        />
        <MetaItem label="Assets" value={record.assets?.length.toString() ?? '0'} />
        <MetaItem
          label="Relations"
          value={record.relations?.length.toString() ?? '0'}
        />
      </dl>
      {record.tags.length > 0 ? (
        <TagChipRow tags={record.tags} readonly />
      ) : (
        <p className="text-slate-500">No tags</p>
      )}
      <ReferenceList label="Assets" values={record.assets ?? []} />
      <RelationsList relations={record.relations ?? []} />
      <JsonBlock value={record.body} />
    </section>
  )
}

function PatchList({
  patches,
}: {
  patches: RecordResponse<PatchItem<DeepPartial<RecordBody>>>[]
}) {
  return (
    <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold uppercase text-slate-500">
          Patches
        </h3>
        <Badge>{patches.length.toString()}</Badge>
      </div>

      {patches.length === 0 ? (
        <p className="text-slate-500">No patches for this record.</p>
      ) : (
        <ol className="grid gap-3">
          {patches.map((patch, index) => (
            <li
              className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-4"
              key={patch.body.id}
            >
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <Badge>#{index + 1}</Badge>
                <span className="break-all font-mono text-xs text-slate-700">
                  {patch.body.id}
                </span>
              </div>
              <dl className="grid gap-2 sm:grid-cols-2">
                <MetaItem label="Created at" value={formatDate(patch.createdAt)} />
                <MetaItem label="Created by" value={patch.createdBy} mono />
                <MetaItem
                  label="Parent id"
                  value={patch.body.parentId ?? 'None'}
                  mono
                />
                <MetaItem
                  label="Description"
                  value={patch.body.description ?? 'None'}
                />
              </dl>
              {patch.body.tags && patch.body.tags.length > 0 && (
                <TagChipRow tags={patch.body.tags} readonly />
              )}
              <JsonBlock value={patch.body} />
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

function FinalState({
  finalState,
}: {
  finalState: RecordItem<RecordBody> | undefined
}) {
  return (
    <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-5">
      <h3 className="text-sm font-semibold uppercase text-slate-500">
        Final state
      </h3>
      {finalState ? (
        <JsonBlock value={finalState} />
      ) : (
        <p className="text-amber-800">
          Final state is unavailable for this history status.
        </p>
      )}
    </section>
  )
}

function Diagnostics({
  diagnostics,
}: {
  diagnostics: RecordHistoryResponse['diagnostics']
}) {
  const items = diagnostics ?? []

  return (
    <section className="grid gap-3 rounded-lg border border-amber-300 bg-amber-50 p-5 text-amber-950">
      <div className="flex flex-wrap items-center gap-2">
        <ExclamationTriangleIcon className="h-5 w-5 shrink-0" />
        <h3 className="text-sm font-semibold uppercase">Diagnostics</h3>
        <Badge>{items.length.toString()}</Badge>
      </div>
      {items.length === 0 ? (
        <p>No history diagnostics.</p>
      ) : (
        <ul className="grid gap-2">
          {items.map((item, index) => (
            <li
              className="grid gap-1 rounded-md border border-amber-200 bg-white/70 p-3"
              key={`${item.code}:${item.patchId ?? item.parentId ?? index}`}
            >
              <strong>{item.code}</strong>
              <span>{item.message}</span>
              {item.patchId && (
                <span className="break-all font-mono text-xs">
                  patchId: {item.patchId}
                </span>
              )}
              {item.parentId !== undefined && (
                <span className="break-all font-mono text-xs">
                  parentId: {item.parentId ?? 'null'}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function MetaItem({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="grid min-w-0 gap-0.5 rounded-md bg-slate-100 p-2.5">
      <dt className="text-xs font-bold uppercase text-slate-500">{label}</dt>
      <dd
        className={
          mono
            ? 'm-0 break-all font-mono text-xs text-slate-950'
            : 'm-0 wrap-break-word text-slate-950'
        }
      >
        {value}
      </dd>
    </div>
  )
}

function ReferenceList({ label, values }: { label: string; values: string[] }) {
  return (
    <section className="grid gap-2">
      <h4 className="text-sm font-semibold text-slate-500">{label}</h4>
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
      <h4 className="text-sm font-semibold text-slate-500">Relations</h4>
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

function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre className="max-h-96 overflow-auto rounded-md border border-slate-200 bg-slate-950 p-3 text-xs leading-relaxed text-slate-50">
      {JSON.stringify(value, null, 2)}
    </pre>
  )
}

function titleFromBody(body: RecordBody | undefined): string | undefined {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return undefined
  const value = (body as Record<string, unknown>).title
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
): string {
  if (!pk || pk.trim() === '') return 'Unassigned'
  const profile = lookupProfile(profiles ?? null, pk)
  if (profile) {
    return `${profile.name} (${pk})`
  }
  return pk
}
