import { useState } from 'react'
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
} from '@heroicons/react/20/solid'
import { useTranslation } from 'react-i18next'
import { AnimatedDrawer } from './ui/AnimatedDrawer'
import { Button } from './ui/Button'
import { Badge } from './ui/Badge'
import { TagChipRow } from './BoardFilters'
import { TextInput } from './ui/TextInput'

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
  isSavingDraft?: boolean
  draftSaveError?: string | null
  onReasonChange: (value: string) => void
  onCreateSnapshot: () => void
  onSelectSnapshot: (snapshotId: string) => void
  onRefreshList: () => void
  onExportSnapshot?: () => void
  onExportSnapshotContext?: () => void
  onSaveSnapshotDraft?: (title: string) => Promise<void>
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
  isSavingDraft = false,
  draftSaveError = null,
  onReasonChange,
  onCreateSnapshot,
  onSelectSnapshot,
  onRefreshList,
  onExportSnapshot,
  onExportSnapshotContext,
  onSaveSnapshotDraft,
  onClose,
}: SnapshotDrawerProps) {
  const { t } = useTranslation()

  if (!open) return null

  return (
    <AnimatedDrawer
      open={open}
      onClose={onClose}
      title={t('snapshot.title')}
      subtitle={t('snapshot.subtitle')}
      closeLabel={t('snapshot.close')}
      size="xl"
    >
      <div className="grid content-start gap-4 lg:grid-cols-[20rem_1fr]">
        <section className="grid content-start gap-4">
          <div className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4">
            <label className="grid gap-1.5 text-xs font-bold uppercase text-slate-500">
              {t('snapshot.reason')}
              <textarea
                className="min-h-20 resize-y rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-normal normal-case text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
                value={reason}
                onChange={(event) => onReasonChange(event.target.value)}
                placeholder={t('snapshot.reasonPlaceholder')}
                disabled={isCreating}
              />
            </label>
            {createError && (
              <ErrorBlock
                title={t('snapshot.createError')}
                message={createError}
              />
            )}
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
              {isCreating ? t('snapshot.creating') : t('snapshot.createButton')}
            </Button>
          </div>

          <div className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold uppercase text-slate-500">
                {t('snapshot.listTitle')}
              </h3>
              <Button
                type="button"
                variant="ghost"
                className="min-h-8 px-2.5 text-xs"
                onClick={onRefreshList}
                disabled={isListLoading}
                icon={
                  <ArrowPathIcon
                    className={
                      isListLoading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'
                    }
                  />
                }
              >
                {t('snapshot.refresh')}
              </Button>
            </div>
            {listError && (
              <ErrorBlock
                title={t('snapshot.listFailed')}
                message={listError}
              />
            )}
            {isListLoading && (
              <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                {t('snapshot.loadingList')}
              </p>
            )}
            {!isListLoading && snapshots.length === 0 && (
              <p className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-sm text-slate-500">
                {t('snapshot.empty')}
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
                        {snapshot.reason ?? t('snapshot.noReason')}
                      </span>
                      <span className="flex flex-wrap items-center gap-1.5">
                        <Badge>
                          {t('snapshot.recordsCount', {
                            count: snapshot.recordCount,
                          })}
                        </Badge>
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
              {t('snapshot.loadingDetail')}
            </div>
          )}
          {detailError && (
            <ErrorBlock
              title={t('snapshot.detailFailed')}
              message={detailError}
            />
          )}
          {!isDetailLoading && !detailError && selectedSnapshot && (
            <SnapshotDetailView
              snapshot={selectedSnapshot}
              isExporting={isExporting}
              exportError={exportError}
              isSavingDraft={isSavingDraft}
              draftSaveError={draftSaveError}
              onExportSnapshot={onExportSnapshot}
              onExportSnapshotContext={onExportSnapshotContext}
              onSaveSnapshotDraft={onSaveSnapshotDraft}
            />
          )}
          {!isDetailLoading && !detailError && !selectedSnapshot && (
            <div className="rounded-lg border border-slate-200 bg-white p-5 text-slate-500">
              {t('snapshot.selectHint')}
            </div>
          )}
        </section>
      </div>
    </AnimatedDrawer>
  )
}

function SnapshotDetailView({
  snapshot,
  isExporting,
  exportError,
  isSavingDraft = false,
  draftSaveError = null,
  onExportSnapshot,
  onExportSnapshotContext,
  onSaveSnapshotDraft,
}: {
  snapshot: SnapshotDetail
  isExporting: boolean
  exportError: string | null
  isSavingDraft?: boolean
  draftSaveError?: string | null
  onExportSnapshot?: () => void
  onExportSnapshotContext?: () => void
  onSaveSnapshotDraft?: (title: string) => Promise<void>
}) {
  const { t } = useTranslation()
  const [draftTitle, setDraftTitle] = useState('')

  return (
    <div className="grid gap-4">
      <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-slate-950">
              {t('snapshot.detailTitle')}
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
              {isExporting
                ? t('snapshot.exporting')
                : t('snapshot.exportButton')}
            </Button>
            <Button
              type="button"
              onClick={onExportSnapshotContext}
              disabled={isExporting || !onExportSnapshotContext}
              icon={
                isExporting ? (
                  <ArrowPathIcon className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowDownTrayIcon className="h-4 w-4" />
                )
              }
            >
              {isExporting
                ? t('snapshot.exporting')
                : t('snapshot.exportAgentContext')}
            </Button>
            <Button
              type="button"
              disabled
              title={t('snapshot.restoreNotImplemented')}
            >
              {t('snapshot.restoreNotImplemented')}
            </Button>
          </div>
        </div>
        {exportError && (
          <ErrorBlock
            title={t('snapshot.exportFailed')}
            message={exportError}
          />
        )}
        <dl className="grid gap-2 sm:grid-cols-2">
          <MetaItem
            label={t('snapshot.detailCreated')}
            value={formatDate(snapshot.createdAt)}
          />
          <MetaItem
            label={t('snapshot.detailCreatedBy')}
            value={snapshot.createdBy}
            mono
          />
          <MetaItem
            label={t('snapshot.detailReason')}
            value={snapshot.reason ?? t('history.none')}
          />
          <MetaItem
            label={t('snapshot.detailSource')}
            value={snapshot.source}
          />
          <MetaItem
            label={t('snapshot.detailRecords')}
            value={snapshot.recordCount.toString()}
          />
          <MetaItem
            label={t('snapshot.detailPatches')}
            value={(snapshot.patchCount ?? 0).toString()}
          />
          <MetaItem
            label={t('snapshot.detailProjection')}
            value={snapshot.projectionStatus}
          />
        </dl>
      </section>

      {onSaveSnapshotDraft && (
        <section className="grid gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-5">
          <h3 className="text-xs font-bold uppercase text-emerald-700">
            {t('snapshot.draftSectionTitle')}
          </h3>
          <p className="text-xs text-emerald-800">
            {t('snapshot.draftDescription')}
          </p>
          <TextInput
            label={t('snapshot.draftTitle')}
            value={draftTitle}
            onChange={(event) => setDraftTitle(event.target.value)}
            placeholder={t('snapshot.draftPlaceholder')}
          />
          {draftSaveError && (
            <ErrorBlock
              title={t('snapshot.draftSaveError')}
              message={draftSaveError}
            />
          )}
          <Button
            type="button"
            disabled={!draftTitle.trim() || isSavingDraft}
            onClick={() => {
              if (!draftTitle.trim()) return
              const title = draftTitle.trim()
              onSaveSnapshotDraft(title)
                .then(() => {
                  setDraftTitle('')
                })
                .catch(() => {
                  // Keep title visible on failure
                })
            }}
            icon={
              isSavingDraft ? (
                <ArrowPathIcon className="h-4 w-4 animate-spin" />
              ) : undefined
            }
          >
            {isSavingDraft
              ? t('snapshot.draftSaving')
              : t('snapshot.draftSaveButton')}
          </Button>
        </section>
      )}

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
  const { t } = useTranslation()

  return (
    <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-5">
      <h3 className="text-sm font-semibold uppercase text-slate-500">
        {t('snapshot.projectionSummary')}
      </h3>
      <dl className="grid gap-2 sm:grid-cols-3">
        <MetaItem
          label={t('snapshot.snapshotHead')}
          value={projection.snapshotHeadVersion.toString()}
        />
        <MetaItem
          label={t('snapshot.visible')}
          value={projection.summary.visibleCurrentRecords.toString()}
        />
        <MetaItem
          label={t('snapshot.base')}
          value={projection.summary.totalBaseRecords.toString()}
        />
        <MetaItem
          label={t('snapshot.archived')}
          value={projection.summary.archivedRecords.toString()}
        />
        <MetaItem
          label={t('snapshot.blocked')}
          value={projection.summary.blockedRecords.toString()}
        />
        <MetaItem
          label={t('snapshot.status')}
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
  const { t } = useTranslation()

  return (
    <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-5">
      <h3 className="text-sm font-semibold uppercase text-slate-500">
        {t('snapshot.staticRecords')}
      </h3>
      {projection.records.length === 0 ? (
        <p className="text-slate-500">{t('snapshot.noRecordsInSnapshot')}</p>
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
                <p className="text-sm text-slate-500">{t('record.noTags')}</p>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

function Diagnostics({ projection }: { projection: BoardCurrentProjection }) {
  const { t } = useTranslation()
  const diagnostics = projection.diagnostics ?? []
  const blocked = projection.blockedRecords ?? []

  return (
    <section className="grid gap-3 rounded-lg border border-amber-300 bg-amber-50 p-5 text-amber-950">
      <div className="flex flex-wrap items-center gap-2">
        <ExclamationTriangleIcon className="h-5 w-5 shrink-0" />
        <h3 className="text-sm font-semibold uppercase">
          {t('snapshot.diagnostics')}
        </h3>
        <Badge>{(diagnostics.length + blocked.length).toString()}</Badge>
      </div>
      {diagnostics.length === 0 && blocked.length === 0 ? (
        <p>{t('snapshot.noDiagnostics')}</p>
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
