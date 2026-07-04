import type { AgentSuggestionDetail } from '@labour-board/shared'

interface AgentSuggestionMetaBarProps {
  suggestion: AgentSuggestionDetail
}

export function AgentSuggestionMetaBar({
  suggestion,
}: AgentSuggestionMetaBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600">
      <span className="font-semibold text-slate-900">{suggestion.title}</span>
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
  )
}
