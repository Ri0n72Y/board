import { useState, useMemo } from 'react'
import type { AgentDraftDetail, AgentDraftStatus, AgentDraftSummary } from '@labour-board/shared'
import {
  ArrowDownTrayIcon,
  ArrowPathIcon,
  ClipboardDocumentIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
} from '@heroicons/react/20/solid'
import { Button } from './ui/Button'
import { Badge } from './ui/Badge'
import { downloadTextFile } from '../utils/download'

interface AgentDraftsDrawerProps {
  open: boolean
  drafts: AgentDraftSummary[]
  selectedDraft: AgentDraftDetail | null
  isListLoading: boolean
  isDetailLoading: boolean
  isCreating: boolean
  listError: string | null
  detailError: string | null
  createError: string | null
  isReviewing?: boolean
  reviewError?: string | null
  onSelectDraft: (draftId: string) => void
  onRefreshList: () => void
  onClose: () => void
  onUpdateReview?: (draftId: string, status: AgentDraftStatus, reviewNote?: string) => void
}

type StatusFilter = 'all' | AgentDraftStatus

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'reviewed', label: 'Reviewed' },
  { value: 'discarded', label: 'Discarded' },
]

export function AgentDraftsDrawer({
  open,
  drafts,
  selectedDraft,
  isListLoading,
  isDetailLoading,
  isCreating,
  listError,
  detailError,
  createError,
  isReviewing = false,
  reviewError = null,
  onSelectDraft,
  onRefreshList,
  onClose,
  onUpdateReview,
}: AgentDraftsDrawerProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const filteredDrafts = useMemo(
    () =>
      statusFilter === 'all'
        ? drafts
        : drafts.filter((d) => d.status === statusFilter),
    [drafts, statusFilter],
  )

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
        aria-labelledby="agent-drafts-title"
        aria-modal="true"
        className="ml-auto grid h-full w-full max-w-5xl grid-rows-[auto_1fr] overflow-hidden border-l border-slate-200 bg-stone-50 text-slate-950 shadow-xl"
        role="dialog"
      >
        <header className="flex min-w-0 items-start justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4">
          <div className="min-w-0">
            <p className="mb-1 text-xs font-bold uppercase text-slate-500">Agent</p>
            <h2 className="text-xl font-semibold leading-tight" id="agent-drafts-title">
              Agent Drafts / Review Queue
            </h2>
          </div>
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            title="Close agent drafts"
            icon={<XMarkIcon className="h-4 w-4" />}
          >
            Close
          </Button>
        </header>

        <div className="grid min-h-0 gap-4 overflow-y-auto px-5 py-4 lg:grid-cols-[20rem_1fr]">
          <section className="grid content-start gap-4">
            <div className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold uppercase text-slate-500">Draft Queue</h3>
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

              <div className="flex flex-wrap gap-1.5">
                {STATUS_FILTERS.map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    className={
                      statusFilter === f.value
                        ? 'rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white'
                        : 'rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200'
                    }
                    onClick={() => setStatusFilter(f.value)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {createError && <ErrorBlock title="Create failed" message={createError} />}
              {listError && <ErrorBlock title="List failed" message={listError} />}

              {isCreating && (
                <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                  Creating draft...
                </p>
              )}
              {isListLoading && (
                <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                  Loading drafts...
                </p>
              )}

              {!isListLoading && filteredDrafts.length === 0 && (
                <div className="grid gap-2 rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-sm text-slate-500">
                  <p>{statusFilter === 'all' ? 'No agent drafts yet.' : `No ${statusFilter} drafts.`}</p>
                  <p className="text-xs">Save a Context Pack from the Export drawer as an Agent Draft to review here.</p>
                </div>
              )}

              {filteredDrafts.length > 0 && (
                <ol className="grid gap-2">
                  {filteredDrafts.map((draft) => (
                    <li key={draft.id}>
                      <button
                        type="button"
                        className={
                          selectedDraft?.id === draft.id
                            ? 'grid w-full gap-1.5 rounded-md border border-emerald-500 bg-emerald-50 px-3 py-2 text-left'
                            : 'grid w-full gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-left hover:border-emerald-500'
                        }
                        onClick={() => onSelectDraft(draft.id)}
                      >
                        <span className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-950">{draft.title}</span>
                          <StatusBadge status={draft.status} />
                        </span>
                        {draft.contextGoal && (
                          <span className="wrap-break-word text-xs text-slate-600">{draft.contextGoal}</span>
                        )}
                        <span className="flex flex-wrap items-center gap-1.5">
                          <Badge>{draft.profile}</Badge>
                          <Badge>{draft.source}</Badge>
                          <Badge>{draft.recordCount.toString()} records</Badge>
                        </span>
                        <span className="text-xs text-slate-400">{formatDate(draft.createdAt)}</span>
                      </button>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </section>

          <section className="min-w-0">
            {isDetailLoading && (
              <div className="rounded-lg border border-slate-200 bg-white p-5 text-slate-500">Loading draft detail...</div>
            )}
            {detailError && <ErrorBlock title="Detail failed" message={detailError} />}
            {!isDetailLoading && !detailError && selectedDraft && (
              <DraftDetailView
                draft={selectedDraft}
                isReviewing={isReviewing}
                reviewError={reviewError}
                onUpdateReview={onUpdateReview}
              />
            )}
            {!isDetailLoading && !detailError && !selectedDraft && (
              <div className="rounded-lg border border-slate-200 bg-white p-5 text-slate-500">Select a draft to view its context.</div>
            )}
          </section>
        </div>
      </aside>
    </div>
  )
}

function StatusBadge({ status }: { status: AgentDraftStatus }) {
  const colors: Record<AgentDraftStatus, string> = {
    draft: 'bg-slate-200 text-slate-700',
    reviewed: 'bg-emerald-200 text-emerald-800',
    discarded: 'bg-red-200 text-red-800',
  }
  return <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-semibold uppercase ${colors[status]}`}>{status}</span>
}

function DraftDetailView({
  draft,
  isReviewing,
  reviewError,
  onUpdateReview,
}: {
  draft: AgentDraftDetail
  isReviewing: boolean
  reviewError: string | null
  onUpdateReview?: (draftId: string, status: AgentDraftStatus, reviewNote?: string) => void
}) {
  const [reviewNote, setReviewNote] = useState(draft.reviewNote ?? '')
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null)

  const copyMarkdown = () => {
    navigator.clipboard.writeText(draft.contextMarkdown).then(
      () => { setCopyFeedback('Copied!'); setTimeout(() => setCopyFeedback(null), 2000) },
      () => setCopyFeedback('Copy failed'),
    )
  }

  const downloadMarkdown = () => {
    downloadTextFile(`agent-draft-${draft.id.slice(0, 8)}-${draft.status}.md`, draft.contextMarkdown)
  }

  const preview =
    draft.contextMarkdown.length > 2000
      ? draft.contextMarkdown.slice(0, 2000) + '\n\n... (truncated)'
      : draft.contextMarkdown

  return (
    <div className="grid gap-4">
      <section className="grid gap-2 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950">
        <div className="flex items-center gap-2">
          <ExclamationTriangleIcon className="h-5 w-5 shrink-0" />
          <strong className="text-sm font-semibold uppercase">Draft Only - Not Executed</strong>
        </div>
        <p className="text-sm">This is a static context pack saved for review. No AI call has been made. No agent execution, patch, or board mutation has been performed.</p>
        <p className="text-xs text-amber-800">Drafts are reviewed by humans before being handed to an Agent.</p>
      </section>

      <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-2">
              <h3 className="text-lg font-semibold text-slate-950">{draft.title}</h3>
              <StatusBadge status={draft.status} />
            </div>
            <p className="break-all font-mono text-xs text-slate-500">{draft.id}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" onClick={copyMarkdown} icon={<ClipboardDocumentIcon className="h-4 w-4" />}>
              {copyFeedback ?? 'Copy Markdown'}
            </Button>
            <Button type="button" onClick={downloadMarkdown} icon={<ArrowDownTrayIcon className="h-4 w-4" />}>
              Download
            </Button>
          </div>
        </div>
        <dl className="grid gap-2 sm:grid-cols-2">
          <MetaItem label="Profile" value={draft.profile} />
          <MetaItem label="Source" value={draft.source} />
          <MetaItem label="Created" value={formatDate(draft.createdAt)} />
          <MetaItem label="Created by" value={draft.createdBy} mono />
          <MetaItem label="Status" value={draft.status} />
          <MetaItem label="Records" value={draft.recordCount.toString()} />
          <MetaItem label="Context goal" value={draft.contextGoal ?? 'None'} />
          {draft.snapshotId && <MetaItem label="Snapshot" value={draft.snapshotId} mono />}
        </dl>
      </section>

      {draft.reviewedAt ? (
        <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold uppercase text-slate-500">Review Info</h3>
          <dl className="grid gap-2 sm:grid-cols-2">
            <MetaItem label="Reviewed at" value={formatDate(draft.reviewedAt)} />
            <MetaItem label="Reviewed by" value={draft.reviewedBy ?? 'unknown'} mono />
            <MetaItem label="Review note" value={draft.reviewNote || 'None'} />
          </dl>
        </section>
      ) : (
        <section className="grid gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
          <p>Not reviewed yet</p>
        </section>
      )}

      {onUpdateReview && (
        <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold uppercase text-slate-500">Review Actions</h3>
          <label className="grid gap-1.5 text-xs font-bold text-slate-500">
            Review note
            <textarea
              className="min-h-20 resize-y rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
              value={reviewNote}
              onChange={(event) => setReviewNote(event.target.value)}
              placeholder="Optional review note"
            />
          </label>
          {reviewError && <ErrorBlock title="Review update failed" message={reviewError} />}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              disabled={isReviewing}
              onClick={() => onUpdateReview(draft.id, 'reviewed', reviewNote.trim() || undefined)}
              icon={isReviewing ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : undefined}
            >
              {isReviewing ? 'Saving...' : 'Mark Reviewed'}
            </Button>
            <Button type="button" disabled={isReviewing} onClick={() => onUpdateReview(draft.id, 'discarded', reviewNote.trim() || undefined)}>
              Mark Discarded
            </Button>
            {draft.status !== 'draft' && (
              <Button type="button" disabled={isReviewing} onClick={() => onUpdateReview(draft.id, 'draft')}>
                Reset to Draft
              </Button>
            )}
          </div>
        </section>
      )}

      <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-5">
        <h3 className="text-sm font-semibold uppercase text-slate-500">Context Markdown Preview</h3>
        <pre className="max-h-96 overflow-y-auto whitespace-pre-wrap break-words rounded-md border border-slate-200 bg-slate-50 p-4 font-mono text-xs leading-relaxed text-slate-800">
          {preview}
        </pre>
      </section>
    </div>
  )
}

function ErrorBlock({ title, message }: { title: string; message: string }) {
  return (
    <section className="grid gap-1 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
      <strong>{title}</strong>
      <span>{message}</span>
    </section>
  )
}

function MetaItem({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="grid min-w-0 gap-0.5 rounded-md bg-slate-100 p-2.5">
      <dt className="text-xs font-bold uppercase text-slate-500">{label}</dt>
      <dd className={mono ? 'm-0 break-all font-mono text-xs text-slate-950' : 'm-0 wrap-break-word text-slate-950'}>{value}</dd>
    </div>
  )
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}
