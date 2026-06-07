import type { AgentDraftDetail, AgentResponseSummary } from '@labour-board/shared'
import { formatDate } from './format'

interface AgentManualWorkflowTimelineProps {
  draft: AgentDraftDetail
  responses: AgentResponseSummary[]
}

type TimelineTone = 'complete' | 'pending' | 'blocked' | 'info'

const TONE_CLASS: Record<TimelineTone, { dot: string; badge: string; text: string }> = {
  complete: {
    dot: 'bg-emerald-500 ring-emerald-200',
    badge: 'bg-emerald-100 text-emerald-800',
    text: 'text-emerald-900',
  },
  pending: {
    dot: 'bg-amber-400 ring-amber-200',
    badge: 'bg-amber-100 text-amber-800',
    text: 'text-amber-900',
  },
  blocked: {
    dot: 'bg-red-400 ring-red-200',
    badge: 'bg-red-100 text-red-800',
    text: 'text-red-900',
  },
  info: {
    dot: 'bg-slate-400 ring-slate-200',
    badge: 'bg-slate-100 text-slate-700',
    text: 'text-slate-700',
  },
}

function TimelineItem({
  tone,
  title,
  meta,
  children,
}: {
  tone: TimelineTone
  title: string
  meta?: string
  children?: React.ReactNode
}) {
  const cls = TONE_CLASS[tone]

  return (
    <div className="grid grid-cols-[16px_1fr] gap-x-3 gap-y-1">
      <div className="flex justify-center pt-1">
        <span className={`inline-block h-3 w-3 rounded-full ring-2 ${cls.dot}`} />
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded px-1.5 py-0.5 text-xs font-bold uppercase ${cls.badge}`}>
            {tone}
          </span>
          <strong className="text-sm font-semibold text-slate-950">{title}</strong>
        </div>
        {meta && <p className="mt-0.5 text-xs text-slate-500">{meta}</p>}
        {children && <div className={`mt-1.5 grid gap-1 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs ${cls.text}`}>{children}</div>}
      </div>
    </div>
  )
}

function TimelineConnector() {
  return (
    <div className="flex justify-center py-0.5">
      <span className="inline-block h-6 w-px bg-slate-300" />
    </div>
  )
}

export function AgentManualWorkflowTimeline({
  draft,
  responses,
}: AgentManualWorkflowTimelineProps) {
  const responseCount = responses.length
  const recentResponses = responses.slice(0, 3)

  return (
    <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-5">
      <h3 className="text-sm font-semibold uppercase text-slate-500">
        Manual Workflow Overview
      </h3>

      {/* ── Derived readonly disclaimer ── */}
      <div className="grid gap-1 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
        <p>
          This timeline is derived from the current draft, review metadata, handoff readiness, and pasted responses.
        </p>
        <p>It is not a persistent audit log.</p>
        <p>No AI call, patch, or board mutation is performed by this timeline.</p>
      </div>

      {/* ── 1. Draft Created ── */}
      <TimelineItem
        tone="complete"
        title="Draft Created"
        meta={`${formatDate(draft.createdAt)} by ${draft.createdBy}`}
      >
        <p>A static Agent context draft was created from the selected source.</p>
        <p>
          {draft.source} · {draft.profile} · {draft.recordCount} records
          {draft.snapshotId ? ` · snapshot ${draft.snapshotId.slice(0, 8)}` : ''}
        </p>
      </TimelineItem>

      <TimelineConnector />

      {/* ── 2. Human Review ── */}
      {draft.status === 'draft' ? (
        <TimelineItem tone="pending" title="Human Review Pending">
          <p>Not reviewed yet.</p>
          <p>Mark Reviewed is required before formal handoff or response intake.</p>
        </TimelineItem>
      ) : draft.status === 'reviewed' ? (
        <TimelineItem
          tone="complete"
          title="Human Reviewed"
          meta={draft.reviewedAt ? `${formatDate(draft.reviewedAt)} by ${draft.reviewedBy ?? 'unknown'}` : undefined}
        >
          <p>This draft is eligible for formal handoff and manual response intake.</p>
          {draft.reviewNote && <p className="italic">Note: {draft.reviewNote}</p>}
        </TimelineItem>
      ) : (
        <TimelineItem
          tone="blocked"
          title="Discarded"
          meta={draft.reviewedAt ? `${formatDate(draft.reviewedAt)} by ${draft.reviewedBy}` : undefined}
        >
          <p>This draft is not eligible for formal handoff or manual response intake.</p>
          {draft.reviewNote && <p className="italic">Note: {draft.reviewNote}</p>}
        </TimelineItem>
      )}

      <TimelineConnector />

      {/* ── 3. Formal Handoff Readiness ── */}
      {draft.status === 'reviewed' ? (
        <TimelineItem tone="complete" title="Formal Handoff Ready">
          <p>Reviewed drafts can generate a formal handoff markdown.</p>
          <p>Handoff is manual only.</p>
          <p>It does not execute the Agent. It does not mutate LabourBoard.</p>
        </TimelineItem>
      ) : draft.status === 'draft' ? (
        <TimelineItem tone="pending" title="Formal Handoff Locked">
          <p>Review this draft before generating formal handoff.</p>
        </TimelineItem>
      ) : (
        <TimelineItem tone="blocked" title="Formal Handoff Disabled">
          <p>Discarded drafts cannot generate formal handoff.</p>
        </TimelineItem>
      )}

      <TimelineConnector />

      {/* ── 4. Manual Responses ── */}
      {responseCount > 0 ? (
        <TimelineItem
          tone="complete"
          title={`Manual Responses Pasted (${responseCount})`}
        >
          <p>
            Responses are manually pasted records. They are not applied patches and do not mutate the board.
          </p>
          <ol className="grid gap-1.5 mt-1">
            {recentResponses.map((r) => (
              <li key={r.id} className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-[11px]">
                <span className="text-slate-400">{formatDate(r.pastedAt)}</span>
                <span>
                  <span className="font-medium text-slate-700">{r.externalAgentName ?? 'Manual Paste'}</span>
                  <span className="text-slate-400"> · {r.responseLength.toLocaleString()} chars{` · `}{r.pastedBy}</span>
                </span>
                {r.responseNote && (
                  <span className="col-start-2 text-slate-500">«{r.responseNote}»</span>
                )}
              </li>
            ))}
          </ol>
          {responseCount > 3 && (
            <p className="mt-1 text-xs text-slate-500">+{responseCount - 3} more responses</p>
          )}
        </TimelineItem>
      ) : draft.status === 'reviewed' ? (
        <TimelineItem tone="pending" title="No Manual Responses Yet">
          <p>Paste an external Agent response manually after using the handoff.</p>
        </TimelineItem>
      ) : draft.status === 'draft' ? (
        <TimelineItem tone="pending" title="No Manual Responses">
          <p>Review this draft before pasting an external Agent response.</p>
        </TimelineItem>
      ) : (
        <TimelineItem tone="blocked" title="No Manual Responses">
          <p>Discarded drafts cannot receive Agent responses.</p>
        </TimelineItem>
      )}
    </section>
  )
}
