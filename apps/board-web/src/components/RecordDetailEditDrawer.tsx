import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  Profile,
  RecordBody,
  RecordItem,
  RecordResponse,
  Tag,
} from '@labour-board/shared'
import { ClockIcon, PencilSquareIcon } from '@heroicons/react/20/solid'
import axios from 'axios'
import { useTranslation } from 'react-i18next'
import { fetchRecordHead } from '../api/recordHead'
import { RecordPatchConflictError, submitRecordPatch } from '../api/patches'
import type { SubmitRecordPatchPayload } from '../api/patches'
import { lookupProfile } from '../utils/board'
import { buildPatchDraft, hasEditHeadChanged } from '../utils/editPatchDraft'
import type { EditPatchFormState } from '../utils/editPatchDraft'
import { formatProfileCompact } from '../utils/profileDisplay'
import { toastError, toastSuccess, toastWarning } from '../utils/toasts'
import { AnimatedDrawer } from './ui/AnimatedDrawer'
import { Button } from './ui/Button'
import { ProfileAvatar } from './ProfileAvatar'
import { TagChipRow } from './BoardFilters'
import { EditableSection } from './recordDetailEdit/EditableSection'
import { UnsavedChangesDialog } from './recordDetailEdit/UnsavedChangesDialog'
import { useSectionEditState } from './recordDetailEdit/useSectionEditState'

type DetailEditSection = 'title' | 'summary' | 'details'

interface RecordDetailEditDrawerProps {
  open: boolean
  record: RecordResponse<RecordItem<RecordBody>> | null
  profiles?: Profile[] | null
  knownTags: Tag[]
  statusTags: Tag[]
  onClose: () => void
  onPatched: (recordId: string) => Promise<void> | void
  onHistoryClick: (record: RecordResponse<RecordItem<RecordBody>>) => void
}

interface BaseHead {
  recordId: string
  lastPatchId: string | null
  currentVersion: number
}

export function RecordDetailEditDrawer({
  open,
  record,
  profiles,
  knownTags,
  statusTags,
  onClose,
  onPatched,
  onHistoryClick,
}: RecordDetailEditDrawerProps) {
  const { t } = useTranslation()
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [baseHead, setBaseHead] = useState<BaseHead | null>(null)
  const requestIdRef = useRef(0)
  const abortRef = useRef<AbortController | null>(null)

  const current = record?.body ?? null
  const displayBody = useMemo(
    () => (current ? asDisplayBody(current.body) : { title: '', summary: '', details: '' }),
    [current],
  )

  const initialDraft = useCallback(
    () => (current ? initialFormState(current, knownTags, statusTags) : emptyFormState()),
    [current, knownTags, statusTags],
  )
  const isDraftDirty = useCallback(
    (draft: EditPatchFormState) => Boolean(current && buildPatchDraft(draft, current).ok),
    [current],
  )

  const editState = useSectionEditState<DetailEditSection, EditPatchFormState>({
    initialDraft,
    isDirty: isDraftDirty,
  })

  useEffect(() => {
    return () => abortRequest(requestIdRef, abortRef)
  }, [])

  useEffect(() => {
    if (!open || !current) return

    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    void fetchRecordHead(current.id, controller.signal)
      .then((head) => {
        if (requestIdRef.current !== requestId || controller.signal.aborted) return
        if (!head.exists) {
          setError(t('edit.headMissing'))
          return
        }
        setError(null)
        setBaseHead({
          recordId: current.id,
          lastPatchId: head.lastPatchId,
          currentVersion: head.currentVersion,
        })
      })
      .catch((caught: unknown) => {
        if (requestIdRef.current !== requestId || controller.signal.aborted || axios.isCancel(caught)) return
        setError(caught instanceof Error ? caught.message : t('edit.errorGeneral'))
      })
      .finally(() => {
        if (requestIdRef.current === requestId) abortRef.current = null
      })

    return () => abortRequest(requestIdRef, abortRef)
  }, [current, open, t])

  if (!open || !record || !current) return null

  const profile = lookupProfile(profiles ?? null, current.assignee ?? '')
  const assigneeDisplay = formatProfileCompact(
    current.assignee,
    profile,
    t('record.unassigned'),
    t('record.unknownMember'),
  )

  function requestClose() {
    if (!editState.requestClose()) return
    abortRequest(requestIdRef, abortRef, setIsSaving)
    onClose()
  }

  function requestHistory() {
    if (!editState.requestClose()) return
    onHistoryClick(record!)
  }

  async function save() {
    if (!current) return
    const validation = buildPatchDraft(editState.draft, current)
    if (!validation.ok) {
      const message = t(validation.error)
      setError(message)
      toastWarning(message)
      return
    }

    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setIsSaving(true)
    setError(null)

    try {
      if (!baseHead || baseHead.recordId !== current.id) {
        setError(t('edit.headMissing'))
        setIsSaving(false)
        return
      }
      const head = await fetchRecordHead(current.id, controller.signal)
      if (requestIdRef.current !== requestId || controller.signal.aborted) return
      if (!head.exists) {
        setError(t('edit.headMissing'))
        setIsSaving(false)
        return
      }
      if (hasEditHeadChanged(baseHead, head)) {
        const message = t('edit.staleHead')
        setError(message)
        toastError(message)
        setIsSaving(false)
        return
      }

      const payload: SubmitRecordPatchPayload = {
        parentId: baseHead.lastPatchId,
        currentVersion: baseHead.currentVersion,
        ...validation.patch,
      }
      await submitRecordPatch(current.id, payload, controller.signal)
      if (requestIdRef.current !== requestId || controller.signal.aborted) return
      setIsSaving(false)
      abortRef.current = null
      toastSuccess('Record saved')
      editState.finishSave(editState.editingSection)
      await onPatched(current.id)
    } catch (caught: unknown) {
      if (requestIdRef.current !== requestId || controller.signal.aborted || axios.isCancel(caught)) return
      const message =
        caught instanceof RecordPatchConflictError
          ? `${t('edit.conflictError')} ${caught.message}`
          : caught instanceof Error
            ? caught.message
            : t('edit.errorGeneral')
      setError(message)
      toastError(message)
      setIsSaving(false)
    } finally {
      if (requestIdRef.current === requestId) abortRef.current = null
    }
  }

  const footer = (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <Button
        type="button"
        variant="ghost"
        onClick={requestHistory}
        icon={<ClockIcon className="h-4 w-4" />}
      >
        {t('record.history')}
      </Button>
      <div className="flex flex-wrap justify-end gap-2">
        {editState.editingSection && (
          <Button type="button" onClick={() => void save()} disabled={isSaving} icon={<PencilSquareIcon className="h-4 w-4" />}>
            {isSaving ? t('edit.saving') : t('edit.saveButton')}
          </Button>
        )}
      </div>
    </div>
  )

  return (
    <>
      <AnimatedDrawer
        open={open}
        onClose={requestClose}
        title={displayBody.title || current.pid}
        subtitle={current.pid}
        size="md"
        closeLabel={t('record.close')}
        footer={footer}
      >
        <div className="grid content-start gap-4">
          {error && (
            <section className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
              {error}
            </section>
          )}

          {current.assignee && (
            <section className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-4">
              <ProfileAvatar
                name={profile?.name ?? current.assignee}
                pk={current.assignee}
                avatarUrl={profile?.avatarUrl ?? null}
                size={32}
              />
              <div>
                <p className="text-sm font-semibold text-slate-900">{assigneeDisplay}</p>
                <p className="text-xs text-slate-500">{t('record.assignee')}</p>
              </div>
            </section>
          )}

          <dl className="grid gap-2 sm:grid-cols-2">
            <MetaItem label={t('record.schema')} value={current.schema} />
            <MetaItem label={t('record.created')} value={formatDate(record.createdAt)} />
          </dl>

          <EditableSection
            title={t('edit.titleField')}
            editing={editState.editingSection === 'title'}
            dirty={editState.editingSection === 'title' && editState.dirty}
            disabled={isSaving}
            onEdit={() => editState.beginEdit('title')}
            editor={
              <input
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
                value={editState.draft.title}
                onChange={(event) => editState.setDraft((draft) => ({ ...draft, title: event.target.value }))}
                disabled={isSaving}
              />
            }
          >
            <p className="text-sm text-slate-800">{displayBody.title || current.pid}</p>
          </EditableSection>

          <EditableSection
            title={t('edit.summary')}
            editing={editState.editingSection === 'summary'}
            dirty={editState.editingSection === 'summary' && editState.dirty}
            disabled={isSaving}
            onEdit={() => editState.beginEdit('summary')}
            editor={
              <textarea
                className="w-full resize-y rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
                rows={4}
                value={editState.draft.summary}
                onChange={(event) => editState.setDraft((draft) => ({ ...draft, summary: event.target.value }))}
                disabled={isSaving}
              />
            }
          >
            <p className="text-sm leading-relaxed text-slate-800">{displayBody.summary || '—'}</p>
          </EditableSection>

          <EditableSection
            title={t('edit.details')}
            editing={editState.editingSection === 'details'}
            dirty={editState.editingSection === 'details' && editState.dirty}
            disabled={isSaving}
            onEdit={() => editState.beginEdit('details')}
            editor={
              <textarea
                className="w-full resize-y rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
                rows={8}
                value={editState.draft.details}
                onChange={(event) => editState.setDraft((draft) => ({ ...draft, details: event.target.value }))}
                disabled={isSaving}
              />
            }
          >
            <pre className="max-h-60 overflow-y-auto whitespace-pre-wrap break-words rounded bg-slate-50 p-3 text-sm leading-relaxed text-slate-800">
              {displayBody.details || '—'}
            </pre>
          </EditableSection>

          {current.tags.length > 0 && (
            <section className="rounded-lg border border-slate-200 bg-white p-4">
              <h3 className="mb-2 text-xs font-bold uppercase text-slate-500">{t('filters.tag')}</h3>
              <TagChipRow tags={current.tags} readonly />
            </section>
          )}
        </div>
      </AnimatedDrawer>

      <UnsavedChangesDialog
        open={editState.pendingExit !== null}
        title="Discard unsaved changes?"
        message="This section has unsaved changes. Discard them and continue?"
        confirmLabel="Discard changes"
        cancelLabel="Keep editing"
        onCancel={editState.cancelPendingExit}
        onConfirm={() => {
          const nextSection = editState.discardPendingExit()
          if (nextSection === null) onClose()
        }}
      />
    </>
  )
}

function emptyFormState(): EditPatchFormState {
  return {
    title: '',
    summary: '',
    details: '',
    statusTag: '',
    priorityTag: '',
    otherTags: [],
    unsupportedTags: [],
    assignee: '',
    assets: [],
    relations: [],
  }
}

function initialFormState(record: RecordItem<RecordBody>, knownTags: Tag[], statusTags: Tag[]): EditPatchFormState {
  const body = asDisplayBody(record.body)
  const statusTag = record.tags.find((tag) => tag.startsWith('status:')) ?? statusTags[0] ?? ''
  const priorityTag = record.tags.find((tag) => tag.startsWith('priority:')) ?? ''
  const otherTags = record.tags.filter((tag) => !tag.startsWith('status:') && !tag.startsWith('priority:'))
  const unsupportedTags = otherTags.filter((tag) => !knownTags.includes(tag))
  const supportedOtherTags = otherTags.filter((tag) => !unsupportedTags.includes(tag))
  return {
    title: body.title,
    summary: body.summary,
    details: body.details,
    statusTag,
    priorityTag,
    otherTags: supportedOtherTags,
    unsupportedTags,
    assignee: record.assignee ?? '',
    assets: [...(record.assets ?? [])],
    relations: (record.relations ?? []).map((relation) => ({ ...relation })),
  }
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid min-w-0 gap-0.5 rounded-md bg-slate-100 p-2.5">
      <dt className="text-xs font-bold uppercase text-slate-500">{label}</dt>
      <dd className="m-0 wrap-break-word text-slate-950">{value}</dd>
    </div>
  )
}

function asDisplayBody(body: RecordBody): { title: string; summary: string; details: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { title: '', summary: '', details: '' }
  }
  return {
    title: stringValue(body, 'title') ?? '',
    summary: stringValue(body, 'description') ?? '',
    details: stringValue(body, 'content') ?? '',
  }
}

function stringValue(source: object, key: string): string | undefined {
  const value = (source as Record<string, unknown>)[key]
  return typeof value === 'string' ? value : undefined
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

function abortRequest(
  requestIdRef: React.MutableRefObject<number>,
  abortRef: React.MutableRefObject<AbortController | null>,
  setIsSaving?: (value: boolean) => void,
) {
  requestIdRef.current += 1
  abortRef.current?.abort()
  abortRef.current = null
  setIsSaving?.(false)
}
