import { useState, useEffect } from 'react'
import type { AgentDraftDetail, AgentResponseDetail, AgentResponseSummary } from '@labour-board/shared'
import { ArrowDownTrayIcon, ArrowPathIcon, ClipboardDocumentIcon } from '@heroicons/react/20/solid'
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
  // Form state
  const [responseAgentName, setResponseAgentName] = useState('')
  const [responseNote, setResponseNote] = useState('')
  const [responseMarkdown, setResponseMarkdown] = useState('')
  const [responseFormError, setResponseFormError] = useState<string | null>(null)
  const [responseCopyFeedback, setResponseCopyFeedback] = useState<string | null>(null)

  // Clear form when draft changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional reset on key change, parent uses key={draft.id}
    setResponseAgentName('')
    setResponseNote('')
    setResponseMarkdown('')
    setResponseFormError(null)
  }, [draft.id])

  // Clear copy feedback when selected response changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional reset on selection change
    setResponseCopyFeedback(null)
  }, [selectedResponse?.id])

  const handleSaveResponse = () => {
    const trimmed = responseMarkdown.trim()
    if (!trimmed) {
      setResponseFormError('Response Markdown is required.')
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
      () => { setResponseCopyFeedback('Copied!'); setTimeout(() => setResponseCopyFeedback(null), 2000) },
      () => setResponseCopyFeedback('Copy failed'),
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
      <h3 className="text-sm font-semibold uppercase text-slate-500">Manual Agent Response</h3>

      {/* Status-based form */}
      {draft.status === 'reviewed' ? (
        <div className="grid gap-3">
          <div className="grid gap-1 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
            <p>Paste the external Agent's response below.</p>
            <p className="text-xs text-blue-700">
              This response was pasted manually. No AI call was made by LabourBoard. No patch or board mutation has been performed.
            </p>
          </div>

          <label className="grid gap-1.5 text-xs font-bold text-slate-500">
            External agent name (optional)
            <input
              type="text"
              className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
              value={responseAgentName}
              onChange={(e) => setResponseAgentName(e.target.value)}
              placeholder="e.g. Codex, ChatGPT"
              maxLength={100}
            />
          </label>

          <label className="grid gap-1.5 text-xs font-bold text-slate-500">
            Response note (optional)
            <input
              type="text"
              className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
              value={responseNote}
              onChange={(e) => setResponseNote(e.target.value)}
              placeholder="e.g. First manual response"
              maxLength={2000}
            />
          </label>

          <label className="grid gap-1.5 text-xs font-bold text-slate-500">
            Response Markdown *
            <textarea
              className="min-h-40 resize-y rounded-md border border-slate-200 bg-white px-3 py-2 font-mono text-sm font-normal text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
              value={responseMarkdown}
              onChange={(e) => setResponseMarkdown(e.target.value)}
              placeholder="Paste the Agent's markdown response here..."
            />
          </label>

          {responseFormError && !responseCreateError && (
            <ErrorBlock title="Validation Error" message={responseFormError} />
          )}
          {responseCreateError && (
            <ErrorBlock title="Save failed" message={responseCreateError} />
          )}

          <div className="flex items-center gap-2">
            <Button
              type="button"
              disabled={isResponseCreating}
              onClick={handleSaveResponse}
              icon={isResponseCreating ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : undefined}
            >
              {isResponseCreating ? 'Saving...' : 'Save Agent Response'}
            </Button>
          </div>
        </div>
      ) : draft.status === 'draft' ? (
        <div className="grid gap-1 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-semibold">Response paste not available</p>
          <p className="text-xs">Mark this draft as reviewed before pasting an external Agent response.</p>
        </div>
      ) : draft.status === 'discarded' ? (
        <div className="grid gap-1 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          <p className="font-semibold">Response paste not available</p>
          <p className="text-xs">Discarded drafts cannot receive Agent responses. Reset to Draft and review again if needed.</p>
        </div>
      ) : null}

      {/* Response list */}
      {responses.length > 0 && (
        <div className="grid gap-2">
          <h4 className="text-xs font-bold uppercase text-slate-400">
            Pasted Responses ({responses.length})
          </h4>
          {isResponseListLoading && (
            <p className="text-xs text-slate-500">Loading responses...</p>
          )}
          {responseListError && (
            <ErrorBlock title="Response list failed" message={responseListError} />
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
                      {r.externalAgentName ?? 'Manual Paste'}
                    </span>
                    <Badge>{r.responseLength.toLocaleString()} chars</Badge>
                  </span>
                  <span className="text-xs text-slate-400">
                    {formatDate(r.pastedAt)} by {r.pastedBy}
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
        <p className="text-xs text-slate-500">Loading response detail...</p>
      )}
      {responseDetailError && (
        <ErrorBlock title="Response detail failed" message={responseDetailError} />
      )}
      {selectedResponse && !isResponseDetailLoading && (
        <div className="grid gap-3 rounded-md border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-center gap-2">
            <span className="rounded bg-blue-200 px-1.5 py-0.5 text-xs font-bold uppercase text-blue-800">
              Manual Paste
            </span>
            <span className="rounded bg-amber-200 px-1.5 py-0.5 text-xs font-bold uppercase text-amber-800">
              Not Applied
            </span>
            <span className="rounded bg-slate-200 px-1.5 py-0.5 text-xs font-bold uppercase text-slate-700">
              No board mutation
            </span>
          </div>

          <div className="grid gap-1 rounded-md bg-white p-3 text-xs text-slate-600">
            <p>
              This response was pasted manually.
              No AI call was made by LabourBoard.
              No patch or board mutation has been performed.
            </p>
          </div>

          <dl className="grid gap-2 sm:grid-cols-2">
            <MetaItem label="Agent" value={selectedResponse.externalAgentName ?? 'Manual Paste'} />
            <MetaItem label="Pasted at" value={formatDate(selectedResponse.pastedAt)} />
            <MetaItem label="Pasted by" value={selectedResponse.pastedBy} mono />
            <MetaItem label="Length" value={`${selectedResponse.responseLength.toLocaleString()} chars`} />
            {selectedResponse.responseNote && (
              <MetaItem label="Note" value={selectedResponse.responseNote} />
            )}
          </dl>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              onClick={() => copyResponseMarkdown(selectedResponse.responseMarkdown)}
              icon={<ClipboardDocumentIcon className="h-4 w-4" />}
            >
              {responseCopyFeedback ?? 'Copy Response Markdown'}
            </Button>
            <Button
              type="button"
              onClick={() => downloadResponseMarkdown(selectedResponse)}
              icon={<ArrowDownTrayIcon className="h-4 w-4" />}
            >
              Download Response
            </Button>
          </div>

          <div className="rounded-md border border-slate-200 bg-white p-3">
            <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-slate-800">
              {selectedResponse.responseMarkdown}
            </pre>
          </div>
        </div>
      )}
    </section>
  )
}
