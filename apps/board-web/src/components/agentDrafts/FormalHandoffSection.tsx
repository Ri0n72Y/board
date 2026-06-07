import type { AgentDraftDetail } from '@labour-board/shared'
import { ArrowDownTrayIcon, ArrowPathIcon, ClipboardDocumentIcon } from '@heroicons/react/20/solid'
import { useTranslation } from 'react-i18next'
import { Button } from '../ui/Button'
import { ErrorBlock } from './ErrorBlock'

interface FormalHandoffSectionProps {
  draft: AgentDraftDetail
  isHandoffLoading: boolean
  handoffError: string | null
  handoffFeedback: string | null
  onCopyHandoff: (draftId: string) => void
  onDownloadHandoff: (draftId: string) => void
}

export function FormalHandoffSection({
  draft,
  isHandoffLoading,
  handoffError,
  handoffFeedback,
  onCopyHandoff,
  onDownloadHandoff,
}: FormalHandoffSectionProps) {
  const { t } = useTranslation()

  return (
    <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-5">
      <h3 className="text-sm font-semibold uppercase text-slate-500">{t('agent.handoff.sectionTitle')}</h3>

      {draft.status === 'reviewed' ? (
        <div className="grid gap-3">
          <div className="grid gap-1 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
            <p>{t('agent.handoff.readyInfo')}</p>
            <p className="text-xs text-emerald-700">{t('agent.handoff.readySafety')}</p>
          </div>
          {handoffError && <ErrorBlock title={t('agent.handoff.failed')} message={handoffError} />}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              disabled={isHandoffLoading}
              onClick={() => onCopyHandoff(draft.id)}
              icon={isHandoffLoading ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : <ClipboardDocumentIcon className="h-4 w-4" />}
            >
              {handoffFeedback ?? t('agent.handoff.copyButton')}
            </Button>
            <Button
              type="button"
              disabled={isHandoffLoading}
              onClick={() => onDownloadHandoff(draft.id)}
              icon={isHandoffLoading ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : <ArrowDownTrayIcon className="h-4 w-4" />}
            >
              {t('agent.handoff.downloadButton')}
            </Button>
          </div>
        </div>
      ) : draft.status === 'draft' ? (
        <div className="grid gap-1 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-semibold">{t('agent.handoff.unavailable')}</p>
          <p className="text-xs">{t('agent.handoff.unavailableDesc')}</p>
        </div>
      ) : draft.status === 'discarded' ? (
        <div className="grid gap-1 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          <p className="font-semibold">{t('agent.handoff.discarded')}</p>
          <p className="text-xs">{t('agent.handoff.discardedDesc')}</p>
        </div>
      ) : null}
    </section>
  )
}
