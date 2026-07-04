import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { AgentSuggestionDetail } from '@labour-board/shared'

interface AgentSuggestionAuditPanelProps {
  audit: AgentSuggestionDetail['audit']
}

export function AgentSuggestionAuditPanel({
  audit,
}: AgentSuggestionAuditPanelProps) {
  const { t } = useTranslation()
  const [showAudit, setShowAudit] = useState(false)

  if (!audit) return null

  return (
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
            value={`${audit.providerKind}/${audit.providerModel}`}
          />
          <AuditItem
            label={t('agent.suggestions.auditGeneratedAt')}
            value={new Date(audit.generatedAt).toLocaleString()}
          />
          <AuditItem
            label={t('agent.suggestions.auditContextChars')}
            value={audit.contextCharCount.toLocaleString()}
          />
          <AuditItem
            label={t('agent.suggestions.auditSkillChars')}
            value={audit.skillCharCount.toLocaleString()}
          />
          <AuditItem
            label={t('agent.suggestions.auditInstructionChars')}
            value={audit.instructionCharCount.toLocaleString()}
          />
          <AuditItem
            label={t('agent.suggestions.auditEstimatedInputTokens')}
            value={audit.estimatedInputTokens.toLocaleString()}
          />
          <AuditItem
            label={t('agent.suggestions.auditEstimatedOutputTokens')}
            value={
              audit.estimatedOutputTokens?.toLocaleString() ??
              t('agent.suggestions.auditUnknown')
            }
          />
          <AuditItem
            label={t('agent.suggestions.auditLimits')}
            value={`${audit.maxInputChars.toLocaleString()} in chars / ${audit.maxOutputChars.toLocaleString()} out chars`}
          />
          <AuditItem
            label={t('agent.suggestions.auditTokenLimits')}
            value={`${audit.maxEstimatedInputTokens.toLocaleString()} in / ${audit.maxEstimatedOutputTokens.toLocaleString()} out`}
          />
          <AuditItem
            label={t('agent.suggestions.auditBudget')}
            value={audit.budgetCheckStatus}
          />
          <AuditItem
            label={t('agent.suggestions.auditValidation')}
            value={audit.outputValidationStatus}
          />
          <AuditItem
            label={t('agent.suggestions.auditRealProvider')}
            value={
              audit.realProvider
                ? t('agent.suggestions.yes')
                : t('agent.suggestions.no')
            }
          />
          <AuditItem
            label={t('agent.suggestions.auditContextHash')}
            value={audit.contextHash.slice(0, 12)}
            mono
          />
        </dl>
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
