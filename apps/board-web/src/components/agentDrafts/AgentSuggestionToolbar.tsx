import type { AgentDraftDetail } from '@labour-board/shared'
import { useTranslation } from 'react-i18next'
import { Button } from '../ui/Button'
import { ErrorBlock } from './ErrorBlock'

interface AgentSuggestionToolbarProps {
  draft: AgentDraftDetail
  suggestionCount: number
  isGenerating: boolean
  generateError: string | null
  onGenerate: (draftId: string, instruction?: string) => void | Promise<unknown>
}

export function AgentSuggestionToolbar({
  draft,
  suggestionCount,
  isGenerating,
  generateError,
  onGenerate,
}: AgentSuggestionToolbarProps) {
  const { t, i18n } = useTranslation()
  const isReviewed = draft.status === 'reviewed'

  const handleGenerate = () => {
    // Pass current UI language as instruction so generated content follows UI language.
    const languageInstruction =
      i18n.resolvedLanguage === 'zh-CN'
        ? '请使用中文输出；标签、标题、摘要、建议内容应与当前中文界面一致。'
        : 'Use English for titles, summaries, labels, and generated suggestion content.'
    // Wrap in void to prevent unhandled promise rejection;
    // the hook already handles errors via generateError state.
    void Promise.resolve(onGenerate(draft.id, languageInstruction)).catch(
      () => undefined
    )
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800">
          {t('agent.suggestions.title', { count: suggestionCount })}
        </h3>
        <Button
          type="button"
          variant="default"
          disabled={!isReviewed || isGenerating}
          onClick={handleGenerate}
          title={
            !isReviewed ? t('agent.suggestions.requiresReviewed') : undefined
          }
        >
          {isGenerating
            ? t('agent.suggestions.generating')
            : t('agent.suggestions.generate')}
        </Button>
      </div>

      {!isReviewed && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {t('agent.suggestions.requiresReviewed')}
        </div>
      )}

      {generateError && (
        <ErrorBlock
          title={t('agent.suggestions.generateFailed')}
          message={generateError}
        />
      )}
    </>
  )
}
