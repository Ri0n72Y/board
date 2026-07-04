import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../ui/Button'
import { downloadTextFile } from '../../utils/download'

interface AgentSuggestionActionsProps {
  suggestionId: string
  markdown: string
}

export function AgentSuggestionActions({
  suggestionId,
  markdown,
}: AgentSuggestionActionsProps) {
  const { t } = useTranslation()
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null)

  const handleCopyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(markdown)
      setCopyFeedback(t('agent.suggestions.copied'))
      setTimeout(() => setCopyFeedback(null), 2000)
    } catch {
      setCopyFeedback(t('agent.suggestions.copyFailed'))
      setTimeout(() => setCopyFeedback(null), 3000)
    }
  }

  const handleDownloadMarkdown = () => {
    const filename = `suggestion-${suggestionId.slice(0, 8)}-${Date.now()}.md`
    downloadTextFile(filename, markdown)
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="default" onClick={handleCopyMarkdown}>
        {copyFeedback ?? t('agent.suggestions.copyFullMarkdown')}
      </Button>
      <Button type="button" variant="default" onClick={handleDownloadMarkdown}>
        {t('agent.suggestions.downloadMarkdown')}
      </Button>
    </div>
  )
}
