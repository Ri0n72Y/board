import { useState } from 'react'
import type { AgentSuggestionDetail } from '@labour-board/shared'
import { Button } from '../ui/Button'
import { MarkdownPreview } from '../ui/MarkdownPreview'
import { downloadTextFile } from '../../utils/download'

interface AgentSuggestionDetailPanelProps {
  suggestion: AgentSuggestionDetail | null
}

export function AgentSuggestionDetailPanel({
  suggestion,
}: AgentSuggestionDetailPanelProps) {
  const [showSkills, setShowSkills] = useState(false)
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null)

  if (!suggestion) return null

  const handleCopyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(suggestion.markdown)
      setCopyFeedback('Copied!')
      setTimeout(() => setCopyFeedback(null), 2000)
    } catch {
      setCopyFeedback('Copy failed')
      setTimeout(() => setCopyFeedback(null), 3000)
    }
  }

  const handleDownloadMarkdown = () => {
    const filename = `suggestion-${suggestion.id.slice(0, 8)}-${Date.now()}.md`
    downloadTextFile(filename, suggestion.markdown)
  }

  return (
    <div className="grid gap-4">
      {/* Meta bar */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600">
        <span className="font-semibold text-slate-900">
          {suggestion.title}
        </span>
        <span className="text-slate-400">|</span>
        <span>
          {suggestion.provider}/{suggestion.model}
        </span>
        <span className="text-slate-400">|</span>
        <span>{new Date(suggestion.createdAt).toLocaleString()}</span>
        <span className="text-slate-400">|</span>
        <span className="font-mono text-[10px] text-slate-400">
          ctx:{suggestion.contextHash.slice(0, 8)}
        </span>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="default"
          onClick={handleCopyMarkdown}
        >
          {copyFeedback ?? 'Copy Full Markdown'}
        </Button>
        <Button
          type="button"
          variant="default"
          onClick={handleDownloadMarkdown}
        >
          Download Markdown
        </Button>
      </div>

      {/* Full markdown preview */}
      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-2 text-xs font-semibold uppercase text-slate-500">
          Full Suggestion
        </div>
        <div className="p-4">
          <MarkdownPreview
            content={suggestion.markdown}
            maxHeight="max-h-[60vh]"
            emptyMessage="No markdown content."
          />
        </div>
      </div>

      {/* Skill snapshots - collapsed by default */}
      {suggestion.skillSnapshots.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white">
          <button
            type="button"
            className="flex w-full items-center justify-between px-4 py-2 text-xs font-semibold uppercase text-slate-500 hover:bg-slate-50"
            onClick={() => setShowSkills((v) => !v)}
          >
            <span>
              Used Skills ({suggestion.skillSnapshots.length})
            </span>
            <span className="text-slate-400">
              {showSkills ? 'Collapse' : 'Expand'}
            </span>
          </button>
          {showSkills && (
            <div className="divide-y divide-slate-100 border-t border-slate-100 px-4 py-3">
              {suggestion.skillSnapshots.map((snap) => (
                <div key={snap.id} className="py-2 first:pt-0 last:pb-0">
                  <div className="mb-1 flex items-center gap-2 text-xs">
                    <span className="font-semibold text-slate-700">
                      {snap.name}
                    </span>
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
                      {snap.source}
                    </span>
                    <span className="font-mono text-[10px] text-slate-400">
                      hash:{snap.contentHash.slice(0, 8)}
                    </span>
                  </div>
                  <pre className="max-h-32 overflow-auto rounded bg-slate-50 p-2 font-mono text-[11px] leading-relaxed text-slate-600">
                    {snap.markdown.slice(0, 500)}
                    {snap.markdown.length > 500 ? '\n…' : ''}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Diagnostics */}
      {suggestion.diagnostics && suggestion.diagnostics.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          <strong>Diagnostics:</strong>
          <ul className="mt-1 list-inside list-disc space-y-0.5">
            {suggestion.diagnostics.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
