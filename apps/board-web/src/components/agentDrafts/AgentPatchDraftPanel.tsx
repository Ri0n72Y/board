import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useTranslation } from 'react-i18next'
import axios from 'axios'
import type {
  RecordBody,
  RecordItem,
  RecordResponse,
} from '@labour-board/shared'
import {
  ExclamationTriangleIcon,
  PencilSquareIcon,
  XMarkIcon,
} from '@heroicons/react/20/solid'
import { submitRecordPatch, RecordPatchConflictError } from '../../api/patches'
import { fetchRecordHead } from '../../api/recordHead'
import type { RecordCurrentHeadResponse } from '@labour-board/shared'
import { Button } from '../ui/Button'
import { SearchSelect } from '../ui/SearchSelect'
import { buildPatchDraftDescription, extractPidCandidates } from '../../utils/agentPatchDraft'
import { formatTagLabel } from '../../utils/tagDisplay'

interface AgentPatchDraftPanelProps {
  suggestionId: string
  suggestionTitle: string
  suggestionMarkdown?: string
  records: RecordResponse<RecordItem<RecordBody>>[]
  onPatched: (recordId: string) => void
  onClose?: () => void
}

interface RecordOption {
  value: string
  label: string
  meta: string
}

interface RecordHeadData {
  recordId: string
  lastPatchId: string | null
  currentVersion: number
}

export function AgentPatchDraftPanel({
  suggestionId,
  suggestionTitle,
  suggestionMarkdown,
  records,
  onPatched,
  onClose,
}: AgentPatchDraftPanelProps) {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage

  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null)
  const [recordHead, setRecordHead] = useState<RecordHeadData | null>(null)
  const [isLoadingHead, setIsLoadingHead] = useState(false)
  const [headError, setHeadError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState(false)

  const headRequestIdRef = useRef(0)
  const headAbortRef = useRef<AbortController | null>(null)
  const submitRequestIdRef = useRef(0)
  const submitAbortRef = useRef<AbortController | null>(null)

  // Initial description derived from suggestion props.
  // Component is keyed by suggestionId so it re-mounts on change.
  const [patchDescription, setPatchDescription] = useState(() =>
    buildPatchDraftDescription(suggestionId, suggestionTitle),
  )

  // Extract PID candidates from suggestion markdown
  const pidCandidates = useMemo(
    () => extractPidCandidates(suggestionMarkdown ?? ''),
    [suggestionMarkdown],
  )

  // Build record search options from board records
  const recordOptions: RecordOption[] = useMemo(
    () =>
      records.map((r) => {
        const title = getRecordDisplayTitle(r.body.body)
        const tagDisplay = r.body.tags.length > 0
          ? ` [${r.body.tags.map((tag) => formatTagLabel(tag, lang)).join(', ')}]`
          : ''
        return {
          value: r.body.id,
          label: `${r.body.pid} - ${title}${tagDisplay}`,
          meta: r.body.id,
        }
      }),
    [records, lang],
  )

  // Find the selected record
  const selectedRecord = useMemo(
    () => records.find((r) => r.body.id === selectedRecordId) ?? null,
    [records, selectedRecordId],
  )

  // Load record head when a record is selected
  useEffect(() => {
    if (!selectedRecordId) {
      return
    }

    const requestId = headRequestIdRef.current + 1
    headRequestIdRef.current = requestId
    headAbortRef.current?.abort()

    const controller = new AbortController()
    headAbortRef.current = controller

    void Promise.resolve()
      .then(() => {
        setIsLoadingHead(true)
        setHeadError(null)
        setRecordHead(null)
        return fetchRecordHead(selectedRecordId, controller.signal)
      })
      .then((head: RecordCurrentHeadResponse) => {
        if (headRequestIdRef.current !== requestId || controller.signal.aborted)
          return
        if (!head.exists) {
          setHeadError(t('agent.patchDraft.headMissing'))
          return
        }
        setRecordHead({
          recordId: selectedRecordId,
          lastPatchId: head.lastPatchId,
          currentVersion: head.currentVersion,
        })
      })
      .catch((caught: unknown) => {
        if (
          headRequestIdRef.current !== requestId ||
          controller.signal.aborted ||
          axios.isCancel(caught)
        )
          return
        setHeadError(
          caught instanceof Error ? caught.message : t('agent.patchDraft.headLoadFailed'),
        )
      })
      .finally(() => {
        if (headRequestIdRef.current !== requestId) return
        setIsLoadingHead(false)
        headAbortRef.current = null
      })

    return () => {
      headRequestIdRef.current += 1
      headAbortRef.current?.abort()
      headAbortRef.current = null
    }
  }, [selectedRecordId, t])

  const handleSubmit = useCallback(async () => {
    if (!selectedRecord || !recordHead) return

    const desc = patchDescription.trim()
    if (!desc) {
      setSubmitError(t('agent.patchDraft.errorDescriptionRequired'))
      return
    }

    const requestId = submitRequestIdRef.current + 1
    submitRequestIdRef.current = requestId
    submitAbortRef.current?.abort()

    const controller = new AbortController()
    submitAbortRef.current = controller
    setIsSubmitting(true)
    setSubmitError(null)

    try {
      // Refresh head to ensure we have latest version
      const head = await fetchRecordHead(selectedRecord.body.id, controller.signal)
      if (submitRequestIdRef.current !== requestId || controller.signal.aborted)
        return

      if (!head.exists) {
        setSubmitError(t('agent.patchDraft.headMissing'))
        setIsSubmitting(false)
        return
      }

      // Check for stale head
      if (
        head.lastPatchId !== recordHead.lastPatchId ||
        head.currentVersion !== recordHead.currentVersion
      ) {
        setSubmitError(t('agent.patchDraft.staleHead'))
        setIsSubmitting(false)
        // Update to latest head
        setRecordHead({
          recordId: selectedRecord.body.id,
          lastPatchId: head.lastPatchId,
          currentVersion: head.currentVersion,
        })
        return
      }

      await submitRecordPatch(
        selectedRecord.body.id,
        {
          parentId: head.lastPatchId,
          currentVersion: head.currentVersion,
          description: desc,
        },
        controller.signal,
      )

      if (submitRequestIdRef.current !== requestId || controller.signal.aborted)
        return

      setSubmitSuccess(true)
      setIsSubmitting(false)
      submitAbortRef.current = null

      // Callback to refresh board
      await onPatched(selectedRecord.body.id)
    } catch (caught: unknown) {
      if (
        submitRequestIdRef.current !== requestId ||
        controller.signal.aborted ||
        axios.isCancel(caught)
      )
        return

      if (caught instanceof RecordPatchConflictError) {
        setSubmitError(`${t('agent.patchDraft.conflictError')} ${caught.message}`)
      } else {
        setSubmitError(
          caught instanceof Error ? caught.message : t('agent.patchDraft.submitFailed'),
        )
      }
      setIsSubmitting(false)
    } finally {
      if (submitRequestIdRef.current === requestId) {
        submitAbortRef.current = null
      }
    }
  }, [selectedRecord, recordHead, patchDescription, onPatched, t])

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
            disabled={isSubmitting}
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
          disabled={isSubmitting}
        />

        {/* Record head loading */}
        {isLoadingHead && (
          <div className="rounded bg-white/50 px-3 py-2 text-xs text-slate-500">
            {t('agent.patchDraft.loadingHead')}
          </div>
        )}

        {/* Record head error */}
        {headError && (
          <div
            className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800"
            role="alert"
          >
            <ExclamationTriangleIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{headError}</span>
          </div>
        )}

        {/* Record info + patch form (shown when head loaded) */}
        {recordHead && selectedRecord && (
          <div className="grid gap-3 rounded-md bg-white p-3">
            {/* Record info summary */}
            <div className="grid gap-1 text-xs">
              <div className="flex flex-wrap items-center gap-2 text-slate-500">
                <span className="font-semibold text-slate-700">
                  {t('agent.patchDraft.targetRecord')}:
                </span>
                <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px]">
                  {selectedRecord.body.pid}
                </code>
                <span className="text-slate-400">/</span>
                <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px]">
                  {selectedRecord.body.id.slice(0, 8)}
                </code>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-slate-400">
                <span>
                  {t('agent.patchDraft.currentVersion')}: {recordHead.currentVersion}
                </span>
                <span>
                  {t('agent.patchDraft.parentId')}:{' '}
                  <code className="font-mono text-[10px]">
                    {recordHead.lastPatchId?.slice(0, 8) ?? t('agent.patchDraft.none')}
                  </code>
                </span>
              </div>
            </div>

            {/* Patch description */}
            <div className="grid gap-1.5">
              <label className="text-xs font-bold text-slate-500">
                {t('agent.patchDraft.descriptionLabel')}
              </label>
              <textarea
                className="w-full resize-y rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-normal text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                value={patchDescription}
                onChange={(event) => setPatchDescription(event.target.value)}
                placeholder={t('agent.patchDraft.descriptionPlaceholder')}
                disabled={isSubmitting}
                rows={3}
              />
            </div>

            {/* Submit error */}
            {submitError && (
              <div
                className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800"
                role="alert"
              >
                <ExclamationTriangleIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            {/* Success feedback */}
            {submitSuccess && (
              <div className="rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                {t('agent.patchDraft.submitSuccess')}
              </div>
            )}

            {/* Submit button */}
            <div className="flex justify-end">
              <Button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={isSubmitting || submitSuccess}
                icon={<PencilSquareIcon className="h-4 w-4" />}
              >
                {isSubmitting
                  ? t('agent.patchDraft.submitting')
                  : t('agent.patchDraft.submitButton')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function getRecordDisplayTitle(body: RecordBody): string {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return ''
  const value = (body as Record<string, unknown>).title
  return typeof value === 'string' && value.trim() ? value : '(no title)'
}
