import { useState, useEffect } from 'react'
import type { AgentDraftDetail, AgentResponseDetail, AgentResponseSummary } from '@labour-board/shared'
import { ArrowDownTrayIcon, ArrowPathIcon, ClipboardDocumentIcon } from '@heroicons/react/20/solid'
import { useTranslation } from 'react-i18next'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { ErrorBlock } from './ErrorBlock'
import { MetaItem } from './MetaItem'
import { formatDate } from './format'
import { downloadTextFile } from '../../utils/download'

interface ManualAgentResponseSectionProps {
  draft: AgentDraftDetail
  responses: AgentResponseSummary[]
  selectedResponse: AgentResponseDetail | null
  isResponseListLoading: boolean
  isResponseDetailLoading: boolean
  isResponseCreating: boolean
  responseListError: string | null
  responseDetailError: string | null
  responseCreateError: string | null
  onLoadResponseDetail: (responseId: string) => void
  onSaveResponse: (draftId: string, responseMarkdown: string, externalAgentName?: string, responseNote?: string) => Promise<AgentResponseDetail>
}

export function ManualAgentResponseSection({
  draft,
  responses,
  selectedResponse,
  isResponseListLoading,
  isResponseDetailLoading,
  isResponseCreating,
  responseListError,
  responseDetailError,
  responseCreateError,
  onLoadResponseDetail,
  onSaveResponse,
}: ManualAgentResponseSectionProps) {
  const { t } = useTranslation()
  const [responseAgentName, setResponseAgentName] = useState('')
  const [responseNote, setResponseNote] = useState('')
  const [responseMarkdown, setResponseMarkdown] = useState('')
  const [responseFormError, setResponseFormError] = useState<string | null>(null)
  const [responseCopyFeedback, setResponseCopyFeedback] = useState<string | null>(null)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional reset on namespaced parent key change
    setResponseAgentName('')
    setResponseNote('')
    setResponseMarkdown('')
    setResponseFormError(null)
  }, [draft.id])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional reset on selection change
    setResponseCopyFeedback(null)
  }, [selectedResponse?.id])

  const handleSaveResponse = () => {
    const trimmed = responseMarkdown.trim()
    if (!trimmed) {
      setResponseFormError(t('agent.response.markdownRequired'))
      return
    }
    setResponseFormError(null)
    onSaveResponse(draft.id, trimmed, responseAgentName.trim() || undefined, responseNote.trim() || undefined)
      .then(() => {
        setResponseMarkdown('')
        setResponseAgentName('')
        setResponseNote('')
        setResponseFormError(null)
      })
      .catch(() => {
        // Error stays visible via responseCreateError
      })
  }

  const copyResponseMarkdown = (markdown: string) => {
    navigator.clipboard.writeText(markdown).then(
      () => { setResponseCopyFeedback(t('agent.response.copied')); setTimeout(() => setResponseCopyFeedback(null), 2000) },
      () => setResponseCopyFeedback(t('agent.response.copyFailed')),
    )
  }

  const downloadResponseMarkdown = (response: AgentResponseDetail) => {
    downloadTextFile(
      `agent-response-${response.id.slice(0, 8)}.md`,
      response.responseMarkdown,
    )
  }

  return (
    <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-5">
      <h3 className="text-sm font-semibold uppercase text-slate-500">{t('agent.response.sectionTitle')}</h3>

      {/* Status-based form */}
      {draft.status === 'reviewed' ? (
        <div className="grid gap-3">
          <div className="grid gap-1 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
            <p>{t('agent.response.pasteInfo')}</p>
            <p className="text-xs text-blue-700">
              {t('agent.response.pasteSafety')}
            </p>
          </div>

          <label className="grid gap-1.5 text-xs font-bold text-slate-500">
            {t('agent.response.agentName')}
            <input
              type="text"
              className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
              value={responseAgentName}
              onChange={(e) => setResponseAgentName(e.target.value)}
              placeholder={t('agent.response.agentNamePlaceholder')}
              maxLength={100}
            />
          </label>

          <label className="grid gap-1.5 text-xs font-bold text-slate-500">
            {t('agent.response.note')}
            <input
              type="text"
              className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
              value={responseNote}
              onChange={(e) => setResponseNote(e.target.value)}
              placeholder={t('agent.response.notePlaceholder')}
              maxLength={2000}
            />
          </label>

          <label className="grid gap-1.5 text-xs font-bold text-slate-500">
            {t('agent.response.markdownLabel')}
            <textarea
              className="min-h-40 resize-y rounded-md border border-slate-200 bg-white px-3 py-2 font-mono text-sm font-normal text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
              value={responseMarkdown}
              onChange={(e) => setResponseMarkdown(e.target.value)}
              placeholder={t('agent.response.markdownPlaceholder')}
            />
          </label>

          {responseFormError && !responseCreateError && (
            <ErrorBlock title={t('agent.response.validationError')} message={responseFormError} />
          )}
          {responseCreateError && (
            <ErrorBlock title={t('agent.response.saveFailed')} message={responseCreateError} />
          )}

          <div className="flex items-center gap-2">
            <Button
              type="button"
              disabled={isResponseCreating}
              onClick={handleSaveResponse}
              icon={isResponseCreating ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : undefined}
            >
              {isResponseCreating ? t('agent.response.saving') : t('agent.response.saveButton')}
            </Button>
          </div>
        </div>
      ) : draft.status === 'draft' ? (
        <div className="grid gap-1 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-semibold">{t('agent.response.pasteUnavailable')}</p>
          <p className="text-xs">{t('agent.response.pasteUnavailableDesc')}</p>
        </div>
      ) : draft.status === 'discarded' ? (
        <div className="grid gap-1 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          <p className="font-semibold">{t('agent.response.pasteDiscarded')}</p>
          <p className="text-xs">{t('agent.response.pasteDiscardedDesc')}</p>
        </div>
      ) : null}

      {/* Response list */}
      {responses.length > 0 && (
        <div className="grid gap-2">
          <h4 className="text-xs font-bold uppercase text-slate-400">
            {t('agent.response.listTitle', { count: responses.length })}
          </h4>
          {isResponseListLoading && (
            <p className="text-xs text-slate-500">{t('agent.response.loadingResponses')}</p>
          )}
          {responseListError && (
            <ErrorBlock title={t('agent.response.listFailed')} message={responseListError} />
          )}
          <ol className="grid gap-1.5">
            {responses.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  className={
                    selectedResponse?.id === r.id
                      ? 'grid w-full gap-0.5 rounded-md border border-emerald-500 bg-emerald-50 px-3 py-2 text-left'
                      : 'grid w-full gap-0.5 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-left hover:border-emerald-500'
                  }
                  onClick={() => onLoadResponseDetail(r.id)}
                >
                  <span className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-950">
                      {r.externalAgentName ?? t('agent.response.manualPaste')}
                    </span>
                    <Badge>{r.responseLength.toLocaleString()} {t('agent.response.chars')}</Badge>
                  </span>
                  <span className="text-xs text-slate-400">
                    {formatDate(r.pastedAt)} {t('agent.timeline.tone.by', { name: r.pastedBy })}
                  </span>
                  {r.responseNote && (
                    <span className="wrap-break-word text-xs text-slate-600">{r.responseNote}</span>
                  )}
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Response detail */}
      {isResponseDetailLoading && (
        <p className="text-xs text-slate-500">{t('agent.response.loadingDetail')}</p>
      )}
      {responseDetailError && (
        <ErrorBlock title={t('agent.response.detailFailed')} message={responseDetailError} />
      )}
      {selectedResponse && !isResponseDetailLoading && (
        <div className="grid gap-3 rounded-md border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-center gap-2">
            <span className="rounded bg-blue-200 px-1.5 py-0.5 text-xs font-bold uppercase text-blue-800">
              {t('agent.response.manualPaste')}
            </span>
            <span className="rounded bg-amber-200 px-1.5 py-0.5 text-xs font-bold uppercase text-amber-800">
              {t('agent.response.notApplied')}
            </span>
            <span className="rounded bg-slate-200 px-1.5 py-0.5 text-xs font-bold uppercase text-slate-700">
              {t('agent.response.noBoardMutation')}
            </span>
          </div>

          <div className="grid gap-1 rounded-md bg-white p-3 text-xs text-slate-600">
            <p>{t('agent.response.notAppliedDesc')}</p>
          </div>

          <dl className="grid gap-2 sm:grid-cols-2">
            <MetaItem label={t('agent.response.meta.agent')} value={selectedResponse.externalAgentName ?? t('agent.response.manualPaste')} />
            <MetaItem label={t('agent.response.meta.pastedAt')} value={formatDate(selectedResponse.pastedAt)} />
            <MetaItem label={t('agent.response.meta.pastedBy')} value={selectedResponse.pastedBy} mono />
            <MetaItem label={t('agent.response.meta.length')} value={`${selectedResponse.responseLength.toLocaleString()} ${t('agent.response.chars')}`} />
            {selectedResponse.responseNote && (
              <MetaItem label={t('agent.response.meta.note')} value={selectedResponse.responseNote} />
            )}
          </dl>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              onClick={() => copyResponseMarkdown(selectedResponse.responseMarkdown)}
              icon={<ClipboardDocumentIcon className="h-4 w-4" />}
            >
              {responseCopyFeedback ?? t('agent.response.copyButton')}
            </Button>
            <Button
              type="button"
              onClick={() => downloadResponseMarkdown(selectedResponse)}
              icon={<ArrowDownTrayIcon className="h-4 w-4" />}
            >
              {t('agent.response.downloadButton')}
            </Button>
          </div>

          <div className="rounded-md border border-slate-200 bg-white p-3">
            <pre className="min-w-0 max-h-64 overflow-y-auto whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-slate-800">
              {selectedResponse.responseMarkdown}
            </pre>
          </div>
        </div>
      )}
    </section>
  )
}
