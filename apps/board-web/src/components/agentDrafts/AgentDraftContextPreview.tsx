import { useState, useEffect } from 'react'
import type { AgentDraftDetail } from '@labour-board/shared'
import { useTranslation } from 'react-i18next'
import { Button } from '../ui/Button'

interface AgentDraftContextPreviewProps {
  draft: AgentDraftDetail
}

const COLLAPSED_LENGTH = 4000

export function AgentDraftContextPreview({ draft }: AgentDraftContextPreviewProps) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)

  // Reset expand state when draft changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setExpanded(false)
  }, [draft.id])

  const fullContent = draft.contextMarkdown
  const isLong = fullContent.length > COLLAPSED_LENGTH
  const displayContent = expanded || !isLong
    ? fullContent
    : fullContent.slice(0, COLLAPSED_LENGTH) + '\n\n...'

  return (
    <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold uppercase text-slate-500">
          Context Markdown Preview
        </h3>
        {isLong && (
          <Button
            type="button"
            variant="ghost"
            className="min-h-8 px-2.5 text-xs"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? t('agent.response.collapse') : t('agent.response.showFull')}
          </Button>
        )}
      </div>
      <pre className="max-h-96 overflow-y-auto whitespace-pre-wrap break-words rounded-md border border-slate-200 bg-slate-50 p-4 font-mono text-xs leading-relaxed text-slate-800">
        {displayContent}
      </pre>
    </section>
  )
}
