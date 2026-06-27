import type { AgentDraftDetail, AgentResponseSummary } from '@labour-board/shared'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
  const cls = TONE_CLASS[tone]

  return (
    <div className="grid grid-cols-[16px_1fr] gap-x-3 gap-y-1">
      <div className="flex justify-center pt-1">
        <span className={`inline-block h-3 w-3 rounded-full ring-2 ${cls.dot}`} />
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded px-1.5 py-0.5 text-xs font-bold uppercase ${cls.badge}`}>
            {t(`agent.timeline.tone.${tone}`)}
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
  const { t } = useTranslation()
  const responseCount = responses.length
  const recentResponses = responses.slice(0, 3)

  return (
    <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-5">
      <h3 className="text-sm font-semibold uppercase text-slate-500">
        {t('agent.timeline.title')}
      </h3>

      {/* ── Derived readonly disclaimer ── */}
      <div className="grid gap-1 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
        <p>{t('agent.timeline.disclaimer1')}</p>
        <p>{t('agent.timeline.disclaimer2')}</p>
        <p>{t('agent.timeline.disclaimer3')}</p>
      </div>

      {/* ── 1. Draft Created ── */}
      <TimelineItem
        tone="complete"
        title={t('agent.timeline.draftCreated')}
        meta={`${formatDate(draft.createdAt)} ${t('agent.timeline.tone.by', { name: draft.createdBy })}`}
      >
        <p>{t('agent.timeline.draftCreatedDesc')}</p>
        <p>
          {draft.source} · {draft.profile} · {draft.recordCount} {t('agent.queue.records')}
          {draft.snapshotId ? ` · ${t('agent.meta.snapshot').toLowerCase()} ${draft.snapshotId.slice(0, 8)}` : ''}
        </p>
      </TimelineItem>

      <TimelineConnector />

      {/* ── 2. Human Review ── */}
      {draft.status === 'draft' ? (
        <TimelineItem tone="pending" title={t('agent.timeline.reviewPending')}>
          <p>{t('agent.timeline.reviewPendingDesc')}</p>
          <p>{t('agent.timeline.reviewPendingHint')}</p>
        </TimelineItem>
      ) : draft.status === 'reviewed' ? (
        <TimelineItem
          tone="complete"
          title={t('agent.timeline.reviewed')}
          meta={draft.reviewedAt ? `${formatDate(draft.reviewedAt)} ${t('agent.timeline.tone.by', { name: draft.reviewedBy ?? t('agent.reviewInfo.unknown') })}` : undefined}
        >
          <p>{t('agent.timeline.reviewedDesc')}</p>
          {draft.reviewNote && <p className="italic">{t('agent.timeline.reviewedNote', { note: draft.reviewNote })}</p>}
        </TimelineItem>
      ) : (
        <TimelineItem
          tone="blocked"
          title={t('agent.timeline.discarded')}
          meta={draft.reviewedAt ? `${formatDate(draft.reviewedAt)} ${t('agent.timeline.tone.by', { name: draft.reviewedBy })}` : undefined}
        >
          <p>{t('agent.timeline.discardedDesc')}</p>
          {draft.reviewNote && <p className="italic">{t('agent.timeline.reviewedNote', { note: draft.reviewNote })}</p>}
        </TimelineItem>
      )}

      <TimelineConnector />

      {/* ── 3. Formal Handoff Readiness ── */}
      {draft.status === 'reviewed' ? (
        <TimelineItem tone="complete" title={t('agent.timeline.handoffReady')}>
          <p>{t('agent.timeline.handoffReadyDesc')}</p>
          <p>{t('agent.timeline.handoffManual')}</p>
          <p>{t('agent.timeline.handoffNoMutation')}</p>
        </TimelineItem>
      ) : draft.status === 'draft' ? (
        <TimelineItem tone="pending" title={t('agent.timeline.handoffLocked')}>
          <p>{t('agent.timeline.handoffLockedDesc')}</p>
        </TimelineItem>
      ) : (
        <TimelineItem tone="blocked" title={t('agent.timeline.handoffDisabled')}>
          <p>{t('agent.timeline.handoffDisabledDesc')}</p>
        </TimelineItem>
      )}

      <TimelineConnector />

      {/* ── 4. Manual Responses ── */}
      {responseCount > 0 ? (
        <TimelineItem
          tone="complete"
          title={t('agent.timeline.responses', { count: responseCount })}
        >
          <p>{t('agent.timeline.responsesDesc')}</p>
          <ol className="grid gap-1.5 mt-1">
            {recentResponses.map((r) => (
              <li key={r.id} className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-[11px]">
                <span className="text-slate-400">{formatDate(r.pastedAt)}</span>
                <span>
                  <span className="font-medium text-slate-700">{r.externalAgentName ?? t('agent.response.manualPaste')}</span>
                  <span className="text-slate-400"> · {r.responseLength.toLocaleString()} {t('agent.response.chars')}{` · `}{r.pastedBy}</span>
                </span>
                {r.responseNote && (
                  <span className="col-start-2 text-slate-500">«{r.responseNote}»</span>
                )}
              </li>
            ))}
          </ol>
          {responseCount > 3 && (
            <p className="mt-1 text-xs text-slate-500">{t('agent.timeline.responsesMore', { count: responseCount - 3 })}</p>
          )}
        </TimelineItem>
      ) : draft.status === 'reviewed' ? (
        <TimelineItem tone="pending" title={t('agent.timeline.noResponses')}>
          <p>{t('agent.timeline.noResponsesDesc')}</p>
        </TimelineItem>
      ) : draft.status === 'draft' ? (
        <TimelineItem tone="pending" title={t('agent.timeline.noResponsesLocked')}>
          <p>{t('agent.timeline.noResponsesLockedDesc')}</p>
        </TimelineItem>
      ) : (
        <TimelineItem tone="blocked" title={t('agent.timeline.noResponsesBlocked')}>
          <p>{t('agent.timeline.noResponsesBlockedDesc')}</p>
        </TimelineItem>
      )}
    </section>
  )
}
