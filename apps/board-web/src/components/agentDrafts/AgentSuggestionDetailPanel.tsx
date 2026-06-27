import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type {
  AgentSuggestionDetail,
  RecordBody,
  RecordItem,
  RecordResponse,
} from '@labour-board/shared'
import { Button } from '../ui/Button'
import { MarkdownPreview } from '../ui/MarkdownPreview'
import { AgentPatchDraftPanel } from './AgentPatchDraftPanel'
import { downloadTextFile } from '../../utils/download'
import { canCreatePatchDraft } from '../../utils/agentPatchDraft'
import { keyStableTextItems } from '../../utils/stableTextKeys'

interface AgentSuggestionDetailPanelProps {
  suggestion: AgentSuggestionDetail | null
  records?: RecordResponse<RecordItem<RecordBody>>[]
  onOpenEditor?: (recordId: string, patchDescription: string) => void
}

export function AgentSuggestionDetailPanel({
  suggestion,
  records,
  onOpenEditor,
}: AgentSuggestionDetailPanelProps) {
  const { t } = useTranslation()
  const [showSkills, setShowSkills] = useState(false)
  const [showAudit, setShowAudit] = useState(false)
  const [showPatchDraft, setShowPatchDraft] = useState(false)
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null)

  if (!suggestion) return null
  const diagnostics = suggestion.diagnostics
    ? keyStableTextItems(
        suggestion.diagnostics,
        `suggestion:${suggestion.id}:diagnostic`,
      )
    : []

  const handleCopyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(suggestion.markdown)
      setCopyFeedback(t('agent.suggestions.copied'))
      setTimeout(() => setCopyFeedback(null), 2000)
    } catch {
      setCopyFeedback(t('agent.suggestions.copyFailed'))
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
          {copyFeedback ?? t('agent.suggestions.copyFullMarkdown')}
        </Button>
        <Button
          type="button"
          variant="default"
          onClick={handleDownloadMarkdown}
        >
          {t('agent.suggestions.downloadMarkdown')}
        </Button>
      </div>

      {/* Patch Draft section */}
      {records && onOpenEditor && canCreatePatchDraft(suggestion) && (
        <div className="rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-4 py-2 text-xs font-semibold uppercase text-slate-500">
            {t('agent.patchDraft.title')}
          </div>
          <div className="px-4 py-3">
            {!showPatchDraft ? (
              <div className="grid gap-2">
                <p className="text-xs text-slate-600">
                  {t('agent.patchDraft.safetyNotice')}
                </p>
                <div>
                  <Button
                    type="button"
                    variant="default"
                    onClick={() => setShowPatchDraft(true)}
                  >
                    {t('agent.patchDraft.createButton')}
                  </Button>
                </div>
              </div>
            ) : (
              <AgentPatchDraftPanel
                key={suggestion.id}
                suggestionId={suggestion.id}
                suggestionTitle={suggestion.title}
                suggestionMarkdown={suggestion.markdown}
                records={records}
                onOpenEditor={onOpenEditor}
                onClose={() => setShowPatchDraft(false)}
              />
            )}
          </div>
        </div>
      )}

      {/* Full markdown preview */}
      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-2 text-xs font-semibold uppercase text-slate-500">
          {t('agent.suggestions.fullSuggestion')}
        </div>
        <div className="p-4">
          <MarkdownPreview
            content={suggestion.markdown}
            maxHeight="max-h-[60vh]"
            emptyMessage={t('agent.suggestions.emptyMarkdown')}
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
              {t('agent.suggestions.usedSkills', {
                count: suggestion.skillSnapshots.length,
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

      {/* Audit metadata - collapsed by default */}
      {suggestion.audit && (
        <div className="rounded-lg border border-slate-200 bg-white">
          <button
            type="button"
            className="flex w-full items-center justify-between px-4 py-2 text-xs font-semibold uppercase text-slate-500 hover:bg-slate-50"
            onClick={() => setShowAudit((v) => !v)}
          >
            <span>{t('agent.suggestions.audit')}</span>
            <span className="text-slate-400">
              {showAudit
                ? t('agent.suggestions.collapse')
                : t('agent.suggestions.expand')}
            </span>
          </button>
          {showAudit && (
            <dl className="grid gap-2 border-t border-slate-100 px-4 py-3 text-xs text-slate-600 sm:grid-cols-2">
              <AuditItem
                label={t('agent.suggestions.auditProvider')}
                value={`${suggestion.audit.providerKind}/${suggestion.audit.providerModel}`}
              />
              <AuditItem
                label={t('agent.suggestions.auditGeneratedAt')}
                value={new Date(suggestion.audit.generatedAt).toLocaleString()}
              />
              <AuditItem
                label={t('agent.suggestions.auditContextChars')}
                value={suggestion.audit.contextCharCount.toLocaleString()}
              />
              <AuditItem
                label={t('agent.suggestions.auditSkillChars')}
                value={suggestion.audit.skillCharCount.toLocaleString()}
              />
              <AuditItem
                label={t('agent.suggestions.auditInstructionChars')}
                value={suggestion.audit.instructionCharCount.toLocaleString()}
              />
              <AuditItem
                label={t('agent.suggestions.auditEstimatedInputTokens')}
                value={suggestion.audit.estimatedInputTokens.toLocaleString()}
              />
              <AuditItem
                label={t('agent.suggestions.auditEstimatedOutputTokens')}
                value={
                  suggestion.audit.estimatedOutputTokens?.toLocaleString() ??
                  t('agent.suggestions.auditUnknown')
                }
              />
              <AuditItem
                label={t('agent.suggestions.auditLimits')}
                value={`${suggestion.audit.maxInputChars.toLocaleString()} in chars / ${suggestion.audit.maxOutputChars.toLocaleString()} out chars`}
              />
              <AuditItem
                label={t('agent.suggestions.auditTokenLimits')}
                value={`${suggestion.audit.maxEstimatedInputTokens.toLocaleString()} in / ${suggestion.audit.maxEstimatedOutputTokens.toLocaleString()} out`}
              />
              <AuditItem
                label={t('agent.suggestions.auditBudget')}
                value={suggestion.audit.budgetCheckStatus}
              />
              <AuditItem
                label={t('agent.suggestions.auditValidation')}
                value={suggestion.audit.outputValidationStatus}
              />
              <AuditItem
                label={t('agent.suggestions.auditRealProvider')}
                value={
                  suggestion.audit.realProvider
                    ? t('agent.suggestions.yes')
                    : t('agent.suggestions.no')
                }
              />
              <AuditItem
                label={t('agent.suggestions.auditContextHash')}
                value={suggestion.audit.contextHash.slice(0, 12)}
                mono
              />
            </dl>
          )}
        </div>
      )}

      {/* Diagnostics */}
      {suggestion.diagnostics && suggestion.diagnostics.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          <strong>{t('agent.suggestions.diagnostics')}:</strong>
          <ul className="mt-1 list-inside list-disc space-y-0.5">
            {diagnostics.map(({ key, text }) => (
              <li key={key}>{text}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function AuditItem({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-semibold uppercase text-slate-400">
        {label}
      </dt>
      <dd
        className={
          mono
            ? 'truncate font-mono text-[11px] text-slate-700'
            : 'truncate text-slate-700'
        }
      >
        {value}
      </dd>
    </div>
  )
}
