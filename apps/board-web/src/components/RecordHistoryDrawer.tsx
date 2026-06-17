import type {
  Profile,
  RecordBody,
  RecordHistoryResponse,
  RecordItem,
  RecordResponse,
} from '@labour-board/shared'
import {
  ExclamationTriangleIcon,
  PencilSquareIcon,
  XMarkIcon,
} from '@heroicons/react/20/solid'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Badge } from './ui/Badge'
import { Button } from './ui/Button'
import {
  buildPatchTimeline,
  debugInitiallyOpen,
  statusSummaryText,
  titleFromBody,
  type HistorySummaryCopy,
} from '../utils/historySummary'

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
  onEditClick?: (record: RecordResponse<RecordItem<RecordBody>>) => void
}

export function RecordHistoryDrawer({
  open,
  recordId,
  title,
  pid,
  history,
  isLoading,
  error,
  onClose,
  onEditClick,
}: RecordHistoryDrawerProps) {
  const { t, i18n } = useTranslation()
  const language = i18n.resolvedLanguage
  const baseRecord = history?.record.body
  const finalState = history?.replay?.finalState
  const editableRecord =
    history && finalState ? { ...history.record, body: finalState } : history?.record
  const displayPid = pid ?? finalState?.pid ?? baseRecord?.pid ?? recordId ?? ''
  const displayTitle =
    title ?? titleFromBody(finalState?.body) ?? titleFromBody(baseRecord?.body)
  const statusText = statusSummaryText(finalState ?? baseRecord, language)

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
        aria-labelledby="record-history-title"
        aria-modal="true"
        className="ml-auto grid h-full w-full max-w-3xl grid-rows-[auto_1fr] overflow-hidden border-l border-slate-200 bg-stone-50 text-slate-950 shadow-xl"
        role="dialog"
      >
        <header className="flex min-w-0 items-start justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4">
          <div className="min-w-0">
            <p className="mb-1 font-mono text-xs text-slate-500">
              {t('history.subtitle')}
            </p>
            <h2
              className="wrap-break-word text-xl font-semibold leading-tight"
              id="record-history-title"
            >
              {displayPid && displayTitle
                ? `${displayPid} · ${displayTitle}`
                : displayTitle ?? displayPid ?? t('history.defaultTitle')}
            </h2>
            {history && (
              <p className="mt-1 text-sm text-slate-600">
                {[statusText, t('history.changeCount', { count: history.patches.length })]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {editableRecord && onEditClick && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => onEditClick(editableRecord)}
                title={t('history.editTitle')}
                icon={<PencilSquareIcon className="h-4 w-4" />}
              >
                {t('history.edit')}
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              title={t('history.closeTitle')}
              icon={<XMarkIcon className="h-4 w-4" />}
            >
              {t('history.close')}
            </Button>
          </div>
        </header>

        <div className="min-h-0 overflow-y-auto px-5 py-4">
          {isLoading && (
            <section className="rounded-md border border-slate-200 bg-white p-4 text-slate-500">
              {t('history.loading')}
            </section>
          )}

          {error && (
            <section
              className="grid gap-1.5 rounded-md border border-red-300 bg-red-50 p-4 text-red-800"
              role="alert"
            >
              <strong>{t('history.loadError')}</strong>
              <span>{error}</span>
            </section>
          )}

          {!isLoading && !error && history && (
            <HistoryContent history={history} language={language} />
          )}

          {!isLoading && !error && !history && (
            <section className="rounded-md border border-slate-200 bg-white p-4 text-slate-500">
              {t('history.noHistory')}
            </section>
          )}
        </div>
      </aside>
    </div>
  )
}

function HistoryContent({
  history,
  language,
}: {
  history: RecordHistoryResponse
  language?: string
}) {
  return (
    <div className="grid gap-4">
      <HistoryStatus history={history} />
      <BaseRecordDetails history={history} />
      <PatchList history={history} language={language} />
      <HistoryDebug history={history} />
    </div>
  )
}

function HistoryStatus({ history }: { history: RecordHistoryResponse }) {
  const { t } = useTranslation()
  const isComplete = history.status === 'complete' || history.status === 'empty'

  if (isComplete) return null

  return (
    <section
      className="flex flex-wrap items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900"
      role="alert"
    >
      <ExclamationTriangleIcon className="h-5 w-5 shrink-0" />
      <span className="text-sm font-semibold">{t('history.statusLabel')}</span>
      <Badge>{t(`history.status.${history.status}`)}</Badge>
      <span className="text-sm">{t('history.statusIncomplete')}</span>
    </section>
  )
}

function BaseRecordDetails({ history }: { history: RecordHistoryResponse }) {
  const { t } = useTranslation()
  const record = history.record

  return (
    <details className="rounded-md border border-slate-200 bg-white p-4">
      <summary className="cursor-pointer text-sm font-semibold text-slate-700">
        {t('history.initialRecord')}
        <span className="ml-2 font-normal text-slate-500">
          {t('history.createdMeta', {
            date: formatDate(record.createdAt),
            actor: record.createdBy,
          })}
        </span>
      </summary>
      <div className="mt-3 grid gap-3">
        <JsonBlock value={record.body} />
      </div>
    </details>
  )
}

function PatchList({
  history,
  language,
}: {
  history: RecordHistoryResponse
  language?: string
}) {
  const { t } = useTranslation()
  const copy = useHistorySummaryCopy()
  const timeline = useMemo(
    () =>
      buildPatchTimeline(history.patches, {
        language,
        copy,
        references: history.references,
      }),
    [history.patches, language, copy, history.references]
  )

  return (
    <section className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold uppercase text-slate-500">
          {t('history.patches')}
        </h3>
        <Badge>{history.patches.length.toString()}</Badge>
      </div>

      {timeline.length === 0 ? (
        <p className="rounded-md border border-slate-200 bg-white p-4 text-slate-500">
          {t('history.noPatches')}
        </p>
      ) : (
        <ol className="grid gap-3">
          {timeline.map((item) => (
            <PatchCard
              item={item}
              key={item.patch.body.id}
            />
          ))}
        </ol>
      )}
    </section>
  )
}

function PatchCard({
  item,
}: {
  item: ReturnType<typeof buildPatchTimeline>[number]
}) {
  const { t } = useTranslation()
  const patch = item.patch

  return (
    <li className="grid gap-3 rounded-md border border-slate-200 bg-white p-4">
      <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm text-slate-600">
        <span className="font-mono font-semibold text-slate-900">
          #{item.ordinal}
        </span>
        <span>·</span>
        <span>{formatDate(patch.createdAt)}</span>
        <span>·</span>
        <span className="font-mono text-xs">{patch.createdBy}</span>
      </div>

      <div className="grid gap-1.5">
        {item.lines.map((line) => (
          <div className="text-sm text-slate-900" key={`${line.label}:${line.value}`}>
            <span className="font-semibold">{line.label}</span>
            <span>{t('history.summarySeparator')}</span>
            <span>{line.value}</span>
          </div>
        ))}
      </div>

      <details open={item.rawInitiallyOpen} className="grid gap-2">
        <summary className="cursor-pointer text-sm font-semibold text-slate-600">
          {t('history.rawPatch')}
        </summary>
        <div className="mt-2">
          <JsonBlock value={patch.body} />
        </div>
      </details>
    </li>
  )
}

function HistoryDebug({ history }: { history: RecordHistoryResponse }) {
  const { t } = useTranslation()

  return (
    <details open={debugInitiallyOpen()} className="rounded-md border border-slate-200 bg-white p-4">
      <summary className="cursor-pointer text-sm font-semibold text-slate-700">
        {t('history.debugInfo')}
      </summary>
      <div className="mt-3 grid gap-4">
        <DebugJson title={t('history.finalState')} value={history.replay?.finalState} />
        <DebugJson
          title={t('history.diagnostics')}
          value={history.diagnostics ?? []}
        />
        <DebugJson title={t('history.references')} value={history.references ?? {}} />
      </div>
    </details>
  )
}

function DebugJson({ title, value }: { title: string; value: unknown }) {
  return (
    <section className="grid gap-2">
      <h4 className="text-sm font-semibold text-slate-500">{title}</h4>
      <JsonBlock value={value} />
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

function useHistorySummaryCopy(): HistorySummaryCopy {
  const { t } = useTranslation()
  return useMemo(
    () => ({
      tagAdded: t('history.tagAdded'),
      tagRemoved: t('history.tagRemoved'),
      noVisibleChanges: t('history.noVisibleChanges'),
      nullValue: t('history.none'),
      assignee: t('history.field.assignee'),
      unassigned: t('history.unassigned'),
      body: t('history.field.body'),
      assets: t('history.field.assets'),
      relations: t('history.field.relations'),
      modified: t('history.modified'),
      itemCount: (count: number) => t('history.itemCount', { count }),
      fieldLabel: (namespace: string) =>
        t(`history.field.${namespace}`, { defaultValue: namespace }),
      bodyFieldLabel: (field: string) =>
        t(`history.bodyField.${field}`, { defaultValue: field }),
      relationConstraintLabel: (constraint: string) =>
        t(`relations.constraint.${constraint}`, {
          defaultValue: t(`history.relation.${constraint}`, {
            defaultValue: constraint,
          }),
        }),
    }),
    [t]
  )
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}
