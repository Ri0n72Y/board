import { useState, useEffect } from 'react'
import type { AgentDraftDetail } from '@labour-board/shared'
import { ArrowDownTrayIcon, ClipboardDocumentIcon } from '@heroicons/react/20/solid'
import { useTranslation } from 'react-i18next'
import { Button } from '../ui/Button'
import { AgentDraftStatusBadge } from './AgentDraftStatusBadge'
import { MetaItem } from './MetaItem'
import { formatDate } from './format'
import { downloadTextFile } from '../../utils/download'

interface AgentDraftMetaPanelProps {
  draft: AgentDraftDetail
}

export function AgentDraftMetaPanel({ draft }: AgentDraftMetaPanelProps) {
  const { t } = useTranslation()
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional reset on namespaced parent key change
    setCopyFeedback(null)
  }, [draft.id])

  const copyMarkdown = () => {
    navigator.clipboard.writeText(draft.contextMarkdown).then(
      () => { setCopyFeedback(t('agent.meta.copied')); setTimeout(() => setCopyFeedback(null), 2000) },
      () => setCopyFeedback(t('agent.meta.copyFailed')),
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
            {copyFeedback ?? t('agent.meta.copyMarkdown')}
          </Button>
          <Button type="button" onClick={downloadMarkdown} icon={<ArrowDownTrayIcon className="h-4 w-4" />}>
            {t('agent.meta.download')}
          </Button>
        </div>
      </div>
      <dl className="grid gap-2 sm:grid-cols-2">
        <MetaItem label={t('agent.meta.profile')} value={draft.profile} />
        <MetaItem label={t('agent.meta.source')} value={draft.source} />
        <MetaItem label={t('agent.meta.created')} value={formatDate(draft.createdAt)} />
        <MetaItem label={t('agent.meta.createdBy')} value={draft.createdBy} mono />
        <MetaItem label={t('agent.meta.status')} value={draft.status} />
        <MetaItem label={t('agent.meta.records')} value={draft.recordCount.toString()} />
        <MetaItem label={t('agent.meta.contextGoal')} value={draft.contextGoal ?? t('agent.meta.none')} />
        {draft.snapshotId && <MetaItem label={t('agent.meta.snapshot')} value={draft.snapshotId} mono />}
      </dl>
    </section>
  )
}
