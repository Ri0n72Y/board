import type { AgentSuggestionSummary } from '@labour-board/shared'
import { useTranslation } from 'react-i18next'
import { cn } from '../../lib/cn'

interface AgentSuggestionCardProps {
  suggestion: AgentSuggestionSummary
  isSelected: boolean
  onSelect: (id: string) => void
}

const STATUS_CLASSES: Record<string, string> = {
  generated: 'bg-blue-50 text-blue-700 border-blue-200',
  reviewed: 'bg-green-50 text-green-700 border-green-200',
  discarded: 'bg-slate-50 text-slate-500 border-slate-200',
} as const

export function AgentSuggestionCard({
  suggestion,
  isSelected,
  onSelect,
}: AgentSuggestionCardProps) {
  const { t } = useTranslation()
  const visibleHighlights = keyTextItems(
    suggestion.highlights.slice(0, 3),
    `suggestion:${suggestion.id}:highlight`,
  )

  const statusClass =
    STATUS_CLASSES[suggestion.status] ?? STATUS_CLASSES.generated
  const statusLabel = t(
    `agent.suggestions.status.${suggestion.status}`,
    suggestion.status,
  )

  return (
    <button
      type="button"
      className={cn(
        'w-full rounded-lg border p-3 text-left transition-colors',
        isSelected
          ? 'border-indigo-300 bg-indigo-50'
          : 'border-slate-200 bg-white hover:border-slate-300',
      )}
      onClick={() => onSelect(suggestion.id)}
    >
      <div className="mb-1 flex items-start justify-between gap-2">
        <h4 className="truncate text-sm font-semibold text-slate-900">
          {suggestion.title}
        </h4>
        <span
          className={cn(
            'inline-flex shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase leading-tight',
            statusClass,
          )}
        >
          {statusLabel}
        </span>
      </div>

      <p className="mb-2 line-clamp-2 text-xs leading-relaxed text-slate-600">
        {suggestion.summary}
      </p>

      {suggestion.highlights.length > 0 && (
        <ul className="mb-2 space-y-0.5">
          {visibleHighlights.map(({ key, text }) => (
            <li
              key={key}
              className="truncate pl-3 text-[11px] leading-snug text-slate-500"
              style={{ listStyleType: "'– '" }}
            >
              {text}
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-3 text-[10px] text-slate-400">
        <span>{new Date(suggestion.createdAt).toLocaleString()}</span>
        <span className="tabular-nums">
          {suggestion.provider}/{suggestion.model}
        </span>
      </div>
    </button>
  )
}

function keyTextItems(items: string[], prefix: string): { key: string; text: string }[] {
  const seen = new Map<string, number>()
  return items.map((text) => {
    const hash = hashText(text)
    const occurrence = seen.get(hash) ?? 0
    seen.set(hash, occurrence + 1)
    return {
      key: `${prefix}:${hash}:${occurrence}`,
      text,
    }
  })
}

function hashText(value: string): string {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0
  }
  return hash.toString(36)
}
