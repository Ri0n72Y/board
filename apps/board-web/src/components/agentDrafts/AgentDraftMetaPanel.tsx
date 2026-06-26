import { useState, useEffect } from 'react'
import type { AgentDraftDetail } from '@labour-board/shared'
import { ArrowDownTrayIcon, ClipboardDocumentIcon } from '@heroicons/react/20/solid'
import { Button } from '../ui/Button'
import { AgentDraftStatusBadge } from './AgentDraftStatusBadge'
import { MetaItem } from './MetaItem'
import { formatDate } from './format'
import { downloadTextFile } from '../../utils/download'

interface AgentDraftMetaPanelProps {
  draft: AgentDraftDetail
}

export function AgentDraftMetaPanel({ draft }: AgentDraftMetaPanelProps) {
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null)

  // Clear copy feedback when draft changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional reset on namespaced parent key change
    setCopyFeedback(null)
  }, [draft.id])

  const copyMarkdown = () => {
    navigator.clipboard.writeText(draft.contextMarkdown).then(
      () => { setCopyFeedback('Copied!'); setTimeout(() => setCopyFeedback(null), 2000) },
      () => setCopyFeedback('Copy failed'),
    )
  }

  const downloadMarkdown = () => {
    downloadTextFile(`agent-draft-${draft.id.slice(0, 8)}-${draft.status}.md`, draft.contextMarkdown)
  }

  return (
    <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2">
            <h3 className="text-lg font-semibold text-slate-950">{draft.title}</h3>
            <AgentDraftStatusBadge status={draft.status} />
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
  )
}
