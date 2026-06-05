import type {
  BoardCurrentProjection,
  SnapshotDetail,
  SnapshotSummary,
} from '@labour-board/shared'
import {
  ArrowDownTrayIcon,
  ArrowPathIcon,
  CameraIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
} from '@heroicons/react/20/solid'
import { Button } from './ui/Button'
import { Badge } from './ui/Badge'
import { TagChipRow } from './BoardFilters'

interface SnapshotDrawerProps {
  open: boolean
  snapshots: SnapshotSummary[]
  selectedSnapshot: SnapshotDetail | null
  reason: string
  isListLoading: boolean
  isDetailLoading: boolean
  isCreating: boolean
  listError: string | null
  detailError: string | null
  createError: string | null
  isExporting?: boolean
  exportError?: string | null
  onReasonChange: (value: string) => void
  onCreateSnapshot: () => void
  onSelectSnapshot: (snapshotId: string) => void
  onRefreshList: () => void
  onExportSnapshot?: () => void
  onClose: () => void
}

export function SnapshotDrawer({
  open,
  snapshots,
  selectedSnapshot,
  reason,
  isListLoading,
  isDetailLoading,
  isCreating,
  listError,
  detailError,
  createError,
  isExporting = false,
  exportError = null,
  onReasonChange,
  onCreateSnapshot,
  onSelectSnapshot,
  onRefreshList,
  onExportSnapshot,
  onClose,
}: SnapshotDrawerProps) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/30"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <aside
        aria-labelledby="snapshots-title"
        aria-modal="true"
        className="ml-auto grid h-full w-full max-w-5xl grid-rows-[auto_1fr] overflow-hidden border-l border-slate-200 bg-stone-50 text-slate-950 shadow-xl"
        role="dialog"
      >
        <header className="flex min-w-0 items-start justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4">
          <div className="min-w-0">
            <p className="mb-1 text-xs font-bold uppercase text-slate-500">
              Checkpoints
            </p>
            <h2 className="text-xl font-semibold leading-tight" id="snapshots-title">
              Snapshots
            </h2>
          </div>
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            title="Close snapshots"
            icon={<XMarkIcon className="h-4 w-4" />}
          >
            Close
          </Button>
        </header>

        <div className="grid min-h-0 gap-4 overflow-y-auto px-5 py-4 lg:grid-cols-[20rem_1fr]">
          <section className="grid content-start gap-4">
            <div className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4">
              <label className="grid gap-1.5 text-xs font-bold uppercase text-slate-500">
                Reason
                <textarea
                  className="min-h-20 resize-y rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-normal normal-case text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
                  value={reason}
                  onChange={(event) => onReasonChange(event.target.value)}
                  placeholder="Why create this checkpoint?"
                  disabled={isCreating}
                />
              </label>
              {createError && <ErrorBlock title="Create failed" message={createError} />}
              <Button
                type="button"
                onClick={onCreateSnapshot}
                disabled={isCreating}
                icon={
                  isCreating ? (
                    <ArrowPathIcon className="h-4 w-4 animate-spin" />
                  ) : (
                    <CameraIcon className="h-4 w-4" />
                  )
                }
              >
                {isCreating ? 'Creating...' : 'Create Snapshot'}
              </Button>
            </div>

            <div className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold uppercase text-slate-500">
                  Snapshot list
                </h3>
                <Button
                  type="button"
                  variant="ghost"
                  className="min-h-8 px-2.5 text-xs"
                  onClick={onRefreshList}
                  disabled={isListLoading}
                  icon={<ArrowPathIcon className={isListLoading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />}
                >
                  Refresh
                </Button>
              </div>
              {listError && <ErrorBlock title="List failed" message={listError} />}
              {isListLoading && (
                <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                  Loading snapshots...
                </p>
              )}
              {!isListLoading && snapshots.length === 0 && (
                <p className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-sm text-slate-500">
                  No snapshots yet.
                </p>
              )}
              {snapshots.length > 0 && (
                <ol className="grid gap-2">
                  {snapshots.map((snapshot) => (
                    <li key={snapshot.id}>
                      <button
                        type="button"
                        className={
                          selectedSnapshot?.id === snapshot.id
                            ? 'grid w-full gap-1.5 rounded-md border border-emerald-500 bg-emerald-50 px-3 py-2 text-left'
                            : 'grid w-full gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-left hover:border-emerald-500'
                        }
                        onClick={() => onSelectSnapshot(snapshot.id)}
                      >
                        <span className="text-sm font-semibold text-slate-950">
                          {formatDate(snapshot.createdAt)}
                        </span>
                        <span className="wrap-break-word text-xs text-slate-600">
                          {snapshot.reason ?? 'No reason'}
                        </span>
                        <span className="flex flex-wrap items-center gap-1.5">
                          <Badge>{snapshot.recordCount.toString()} records</Badge>
                          <Badge>{snapshot.projectionStatus}</Badge>
                        </span>
                      </button>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </section>

          <section className="min-w-0">
            {isDetailLoading && (
              <div className="rounded-lg border border-slate-200 bg-white p-5 text-slate-500">
                Loading snapshot detail...
              </div>
            )}
            {detailError && <ErrorBlock title="Detail failed" message={detailError} />}
            {!isDetailLoading && !detailError && selectedSnapshot && (
              <SnapshotDetailView
                snapshot={selectedSnapshot}
                isExporting={isExporting}
                exportError={exportError}
                onExportSnapshot={onExportSnapshot}
              />
            )}
            {!isDetailLoading && !detailError && !selectedSnapshot && (
              <div className="rounded-lg border border-slate-200 bg-white p-5 text-slate-500">
                Select a snapshot to view its static records.
              </div>
            )}
          </section>
        </div>
      </aside>
    </div>
  )
}

function SnapshotDetailView({
  snapshot,
  isExporting,
  exportError,
  onExportSnapshot,
}: {
  snapshot: SnapshotDetail
  isExporting: boolean
  exportError: string | null
  onExportSnapshot?: () => void
}) {
  return (
    <div className="grid gap-4">
      <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-slate-950">
              Snapshot detail
            </h3>
            <p className="break-all font-mono text-xs text-slate-500">
              {snapshot.id}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              onClick={onExportSnapshot}
              disabled={isExporting || !onExportSnapshot}
              icon={
                isExporting ? (
                  <ArrowPathIcon className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowDownTrayIcon className="h-4 w-4" />
                )
              }
            >
              {isExporting ? 'Exporting...' : 'Export Snapshot'}
            </Button>
            <Button type="button" disabled title="Restore not implemented">
              Restore not implemented
            </Button>
          </div>
        </div>
        {exportError && <ErrorBlock title="Export failed" message={exportError} />}
        <dl className="grid gap-2 sm:grid-cols-2">
          <MetaItem label="Created" value={formatDate(snapshot.createdAt)} />
          <MetaItem label="Created by" value={snapshot.createdBy} mono />
          <MetaItem label="Reason" value={snapshot.reason ?? 'None'} />
          <MetaItem label="Source" value={snapshot.source} />
          <MetaItem label="Records" value={snapshot.recordCount.toString()} />
          <MetaItem label="Patches" value={(snapshot.patchCount ?? 0).toString()} />
          <MetaItem
            label="Projection"
            value={snapshot.projectionStatus}
          />
        </dl>
      </section>

      <ProjectionSummary projection={snapshot.projection} />
      <SnapshotRecords projection={snapshot.projection} />
      <Diagnostics projection={snapshot.projection} />
    </div>
  )
}

function ProjectionSummary({
  projection,
}: {
  projection: BoardCurrentProjection
}) {
  return (
    <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-5">
      <h3 className="text-sm font-semibold uppercase text-slate-500">
        Projection summary
      </h3>
      <dl className="grid gap-2 sm:grid-cols-3">
        <MetaItem
          label="Snapshot head"
          value={projection.snapshotHeadVersion.toString()}
        />
        <MetaItem
          label="Visible"
          value={projection.summary.visibleCurrentRecords.toString()}
        />
        <MetaItem
          label="Base"
          value={projection.summary.totalBaseRecords.toString()}
        />
        <MetaItem
          label="Archived"
          value={projection.summary.archivedRecords.toString()}
        />
        <MetaItem
          label="Blocked"
          value={projection.summary.blockedRecords.toString()}
        />
        <MetaItem
          label="Status"
          value={projection.summary.projectionStatus}
        />
      </dl>
    </section>
  )
}

function SnapshotRecords({
  projection,
}: {
  projection: BoardCurrentProjection
}) {
  return (
    <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-5">
      <h3 className="text-sm font-semibold uppercase text-slate-500">
        Static records
      </h3>
      {projection.records.length === 0 ? (
        <p className="text-slate-500">No records in this snapshot.</p>
      ) : (
        <ol className="grid gap-3">
          {projection.records.map((record) => (
            <li
              className="grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-4"
              key={record.body.id}
            >
              <div className="min-w-0">
                <p className="font-mono text-xs text-slate-500">
                  {record.body.pid}
                </p>
                <h4 className="wrap-break-word text-base font-semibold text-slate-950">
                  {titleFromBody(record.body.body) ?? record.body.pid}
                </h4>
              </div>
              {record.body.tags.length > 0 ? (
                <TagChipRow tags={record.body.tags} readonly />
              ) : (
                <p className="text-sm text-slate-500">No tags</p>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

function Diagnostics({
  projection,
}: {
  projection: BoardCurrentProjection
}) {
  const diagnostics = projection.diagnostics ?? []
  const blocked = projection.blockedRecords ?? []

  return (
    <section className="grid gap-3 rounded-lg border border-amber-300 bg-amber-50 p-5 text-amber-950">
      <div className="flex flex-wrap items-center gap-2">
        <ExclamationTriangleIcon className="h-5 w-5 shrink-0" />
        <h3 className="text-sm font-semibold uppercase">Diagnostics</h3>
        <Badge>{(diagnostics.length + blocked.length).toString()}</Badge>
      </div>
      {diagnostics.length === 0 && blocked.length === 0 ? (
        <p>No snapshot diagnostics.</p>
      ) : (
        <div className="grid gap-2">
          {diagnostics.map((item) => (
            <div
              className="rounded-md border border-amber-200 bg-white/70 p-3"
              key={`${item.code}:${item.message}`}
            >
              <strong>{item.code}</strong>
              <p>{item.message}</p>
            </div>
          ))}
          {blocked.map((item) => (
            <div
              className="rounded-md border border-amber-200 bg-white/70 p-3"
              key={item.recordId}
            >
              <strong>{item.status}</strong>
              <p className="break-all font-mono text-xs">{item.recordId}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function ErrorBlock({ title, message }: { title: string; message: string }) {
  return (
    <section
      className="grid gap-1 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800"
      role="alert"
    >
      <strong>{title}</strong>
      <span>{message}</span>
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

function titleFromBody(body: unknown): string | undefined {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return undefined
  const value = (body as Record<string, unknown>).title
  return typeof value === 'string' && value.trim() ? value : undefined
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}
