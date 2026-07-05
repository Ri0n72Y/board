import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { AgentSuggestionDetail } from '@labour-board/shared'

interface AgentSuggestionSkillsPanelProps {
  skillSnapshots: AgentSuggestionDetail['skillSnapshots']
}

export function AgentSuggestionSkillsPanel({
  skillSnapshots,
}: AgentSuggestionSkillsPanelProps) {
  const { t } = useTranslation()
  const [showSkills, setShowSkills] = useState(false)

  if (skillSnapshots.length === 0) return null

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <button
        type="button"
        className="flex w-full items-center justify-between px-4 py-2 text-xs font-semibold uppercase text-slate-500 hover:bg-slate-50"
        onClick={() => setShowSkills((v) => !v)}
      >
        <span>
          {t('agent.suggestions.usedSkills', {
            count: skillSnapshots.length,
          })}
        </span>
        <span className="text-slate-400">
          {showSkills
            ? t('agent.suggestions.collapse')
            : t('agent.suggestions.expand')}
        </span>
      </button>
      {showSkills && (
        <div className="divide-y divide-slate-100 border-t border-slate-100 px-4 py-3">
          {skillSnapshots.map((snap) => (
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
  )
}
