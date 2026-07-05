import { useTranslation } from 'react-i18next'
import { keyStableTextItems } from '../../utils/stableTextKeys'

interface AgentSuggestionDiagnosticsPanelProps {
  suggestionId: string
  diagnostics?: string[]
}

export function AgentSuggestionDiagnosticsPanel({
  suggestionId,
  diagnostics,
}: AgentSuggestionDiagnosticsPanelProps) {
  const { t } = useTranslation()
  const items = diagnostics
    ? keyStableTextItems(diagnostics, `suggestion:${suggestionId}:diagnostic`)
    : []

  if (items.length === 0) return null

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
      <strong>{t('agent.suggestions.diagnostics')}:</strong>
      <ul className="mt-1 list-inside list-disc space-y-0.5">
        {items.map(({ key, text }) => (
          <li key={key}>{text}</li>
        ))}
      </ul>
    </div>
  )
}
