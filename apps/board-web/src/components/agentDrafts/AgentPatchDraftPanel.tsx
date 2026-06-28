import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type {
  RecordBody,
  RecordItem,
  RecordResponse,
} from '@labour-board/shared'
import { PencilSquareIcon, XMarkIcon } from '@heroicons/react/20/solid'
import { Button } from '../ui/Button'
import { SearchSelect } from '../ui/SearchSelect'
import {
  buildPatchDraftDescription,
  extractPidCandidates,
} from '../../utils/agentPatchDraft'
import { formatTagLabel } from '../../utils/tagDisplay'

interface AgentPatchDraftPanelProps {
  suggestionId: string
  suggestionTitle: string
  suggestionMarkdown?: string
  records: RecordResponse<RecordItem<RecordBody>>[]
  onOpenEditor: (recordId: string, patchDescription: string) => void
  onClose?: () => void
}

/**
 * AgentPatchDraftPanel handles only:
 *   suggestion → record selection → open EditRecordDrawer.
 *
 * It does NOT submit any patch itself.  The actual edit and submission
 * are delegated to the existing EditRecordDrawer, which enforces
 * the buildPatchDraft no-empty-changes rule.
 */
export function AgentPatchDraftPanel({
  suggestionId,
  suggestionTitle,
  suggestionMarkdown,
  records,
  onOpenEditor,
  onClose,
}: AgentPatchDraftPanelProps) {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage

  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null)

  const patchDescription = useMemo(
    () => buildPatchDraftDescription(suggestionId, suggestionTitle),
    [suggestionId, suggestionTitle]
  )

  const pidCandidates = useMemo(
    () => extractPidCandidates(suggestionMarkdown ?? ''),
    [suggestionMarkdown]
  )

  const recordOptions = useMemo(
    () =>
      records.map((r) => {
        const title = getRecordDisplayTitle(r.body.body)
        const tagDisplay =
          r.body.tags.length > 0
            ? ` [${r.body.tags.map((tag) => formatTagLabel(tag, lang)).join(', ')}]`
            : ''
        return {
          value: r.body.id,
          label: `${r.body.pid} - ${title}${tagDisplay}`,
          meta: r.body.id,
        }
      }),
    [records, lang]
  )

  const selectedRecord = useMemo(
    () => records.find((r) => r.body.id === selectedRecordId) ?? null,
    [records, selectedRecordId]
  )

  const handleOpenEditor = () => {
    if (!selectedRecordId) return
    onOpenEditor(selectedRecordId, patchDescription)
    // Close self after delegating
    onClose?.()
  }

  return (
    <div className="rounded-lg border border-indigo-200 bg-indigo-50/60">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-indigo-200 px-4 py-3">
        <h4 className="text-sm font-semibold text-indigo-900">
          {t('agent.patchDraft.title')}
        </h4>
        {onClose && (
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            icon={<XMarkIcon className="h-4 w-4" />}
            title={t('agent.patchDraft.closeTitle')}
          >
            {t('agent.patchDraft.close')}
          </Button>
        )}
      </div>

      <div className="grid gap-3 px-4 py-3">
        {/* Safety notice */}
        <p className="text-xs text-indigo-700">
          {t('agent.patchDraft.safetyNotice')}
        </p>

        {/* PID candidates hint */}
        {pidCandidates.length > 0 && (
          <div className="rounded-md bg-white/70 px-3 py-2 text-xs text-slate-600">
            <span className="font-semibold">
              {t('agent.patchDraft.pidCandidatesLabel')}
            </span>{' '}
            {pidCandidates.map((pid: string, i: number) => (
              <span key={pid}>
                <code className="rounded bg-indigo-100 px-1 font-mono text-[11px] text-indigo-700">
                  {pid}
                </code>
                {i < pidCandidates.length - 1 ? ', ' : ''}
              </span>
            ))}
          </div>
        )}

        {/* Record selector */}
        <SearchSelect
          mode="option"
          label={t('agent.patchDraft.selectRecord')}
          value={selectedRecordId}
          onChange={(next: string | null) => setSelectedRecordId(next)}
          options={recordOptions}
          placeholder={t('agent.patchDraft.searchPlaceholder')}
        />
        <p className="text-[10px] leading-relaxed text-slate-500">
          {t('agent.patchDraft.visibleRecordsHint')}
        </p>

        {/* Patch description preview */}
        <div className="grid gap-1">
          <label className="text-xs font-bold text-slate-500">
            {t('agent.patchDraft.descriptionLabel')}
          </label>
          <div className="rounded-md bg-white px-3 py-2 text-xs text-slate-700">
            {patchDescription}
          </div>
          <p className="text-[10px] text-slate-400">
            {t('agent.patchDraft.descriptionHint')}
          </p>
        </div>

        {/* Open Editor button */}
        <div className="flex justify-end">
          <Button
            type="button"
            onClick={handleOpenEditor}
            disabled={!selectedRecord}
            icon={<PencilSquareIcon className="h-4 w-4" />}
          >
            {t('agent.patchDraft.openEditorButton')}
          </Button>
        </div>
      </div>
    </div>
  )
}

function getRecordDisplayTitle(body: RecordBody): string {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return ''
  const value = (body as Record<string, unknown>).title
  return typeof value === 'string' && value.trim() ? value : '(no title)'
}
