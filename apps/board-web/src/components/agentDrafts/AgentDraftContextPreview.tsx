import { useMemo } from 'react'
import type { AgentDraftDetail } from '@labour-board/shared'

interface AgentDraftContextPreviewProps {
  draft: AgentDraftDetail
}

export function AgentDraftContextPreview({ draft }: AgentDraftContextPreviewProps) {
  const preview = useMemo(
    () =>
      draft.contextMarkdown.length > 2000
        ? draft.contextMarkdown.slice(0, 2000) + '\n\n... (truncated)'
        : draft.contextMarkdown,
    [draft.contextMarkdown],
  )

  return (
    <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-5">
      <h3 className="text-sm font-semibold uppercase text-slate-500">Context Markdown Preview</h3>
      <pre className="max-h-96 overflow-y-auto whitespace-pre-wrap break-words rounded-md border border-slate-200 bg-slate-50 p-4 font-mono text-xs leading-relaxed text-slate-800">
        {preview}
      </pre>
    </section>
  )
}
