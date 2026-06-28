import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from 'react'
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
import { useBoardCurrentStore } from '../stores/boardCurrentStore'
import { lookupProfile } from '../utils/board'
import {
  asEditableBody,
  buildPatchDraft,
  hasEditHeadChanged,
  type EditPatchFormState,
} from '../utils/editPatchDraft'
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

type PendingAction =
  | { type: 'close' }
  | { type: 'history' }
  | { type: 'edit'; section: DetailEditSection }

interface SavedDisplayBody {
  recordId: string
  body: {
    title: string
    description: string
    content: string
  }
}

interface RecordDetailDrawerProps {
  open: boolean
  record: RecordResponse<RecordItem<RecordBody>> | null
  profiles?: Profile[] | null
  onClose: () => void
  onEditClick: (record: RecordResponse<RecordItem<RecordBody>>) => void
  onHistoryClick: (record: RecordResponse<RecordItem<RecordBody>>) => void
}

interface BaseHead {
  recordId: string
  lastPatchId: string | null
  currentVersion: number
}

export function RecordDetailDrawer({
  open,
  record,
  profiles,
  onClose,
  onHistoryClick,
}: RecordDetailDrawerProps) {
  const { t } = useTranslation()
  const effectiveFilters = useBoardCurrentStore((state) => state.effectiveFilters)
  const loadCurrentBoard = useBoardCurrentStore((state) => state.loadCurrentBoard)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [baseHead, setBaseHead] = useState<BaseHead | null>(null)
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const [savedDisplayBody, setSavedDisplayBody] = useState<SavedDisplayBody | null>(null)
  const requestIdRef = useRef(0)
  const abortRef = useRef<AbortController | null>(null)

  const current = record?.body ?? null
  const body = useMemo(() => {
    if (!current) return emptyBody()
    if (savedDisplayBody?.recordId === current.id) return savedDisplayBody.body
    return asEditableBody(current.body)
  }, [current, savedDisplayBody])
  const initialDraft = useCallback(
    () => (current ? initialFormState(current, body) : emptyFormState()),
    [body, current],
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
        if (
          requestIdRef.current !== requestId ||
          controller.signal.aborted ||
          axios.isCancel(caught)
        ) {
          return
        }
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

  function beginEdit(section: DetailEditSection) {
    if (
      editState.editingSection &&
      editState.editingSection !== section &&
      editState.dirty
    ) {
      setPendingAction({ type: 'edit', section })
      editState.requestSection(section)
      return
    }
    editState.beginEdit(section)
  }

  function requestClose() {
    if (!editState.requestClose()) {
      setPendingAction({ type: 'close' })
      return
    }
    abortRequest(requestIdRef, abortRef, setIsSaving)
    onClose()
  }

  function requestHistory() {
    if (!editState.requestClose()) {
      setPendingAction({ type: 'history' })
      return
    }
    onHistoryClick(record)
  }

  function cancelDiscard() {
    setPendingAction(null)
    editState.cancelPendingExit()
  }

  function confirmDiscard() {
    const action = pendingAction
    setPendingAction(null)
    editState.discardPendingExit()
    if (!action || action.type === 'close') {
      onClose()
      return
    }
    if (action.type === 'history') {
      onHistoryClick(record)
      return
    }
    editState.beginEdit(action.section)
  }

  async function save() {
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

      setSavedDisplayBody({
        recordId: current.id,
        body: {
          title: editState.draft.title.trim(),
          description: editState.draft.summary.trim(),
          content: editState.draft.details.trim(),
        },
      })
      setIsSaving(false)
      abortRef.current = null
      toastSuccess('Record saved')
      editState.finishSave(editState.editingSection)
      await loadCurrentBoard(effectiveFilters)
    } catch (caught: unknown) {
      if (
        requestIdRef.current !== requestId ||
        controller.signal.aborted ||
        axios.isCancel(caught)
      ) {
        return
      }
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
      {editState.editingSection && (
        <Button
          type="button"
          onClick={() => void save()}
          disabled={isSaving}
          icon={<PencilSquareIcon className="h-4 w-4" />}
        >
          {isSaving ? t('edit.saving') : t('edit.saveButton')}
        </Button>
      )}
    </div>
  )

  return (
    <>
      <AnimatedDrawer
        open={open}
        onClose={requestClose}
        title={body.title || current.pid}
        subtitle={current.pid}
        size="md"
        closeLabel={t('record.close')}
        footer={footer}
      >
        <div className="grid content-start gap-4">
          {error && (
            <section
              className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800"
              role="alert"
            >
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
                <p className="text-sm font-semibold text-slate-900">
                  {assigneeDisplay}
                </p>
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
            editLabel={t('record.edit')}
            editing={editState.editingSection === 'title'}
            dirty={editState.editingSection === 'title' && editState.dirty}
            disabled={isSaving}
            onEdit={() => beginEdit('title')}
            editor={
              <input
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
                value={editState.draft.title}
                onChange={(event) =>
                  editState.setDraft((draft) => ({ ...draft, title: event.target.value }))
                }
                disabled={isSaving}
              />
            }
          >
            <p className="text-sm leading-relaxed text-slate-800">
              {body.title || current.pid}
            </p>
          </EditableSection>

          <EditableSection
            title={t('edit.summary')}
            editLabel={t('record.edit')}
            editing={editState.editingSection === 'summary'}
            dirty={editState.editingSection === 'summary' && editState.dirty}
            disabled={isSaving}
            onEdit={() => beginEdit('summary')}
            editor={
              <textarea
                className="w-full resize-y rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
                rows={3}
                value={editState.draft.summary}
                onChange={(event) =>
                  editState.setDraft((draft) => ({ ...draft, summary: event.target.value }))
                }
                disabled={isSaving}
              />
            }
          >
            <p className="text-sm leading-relaxed text-slate-800">
              {body.description || '—'}
            </p>
          </EditableSection>

          <EditableSection
            title={t('edit.details')}
            editLabel={t('record.edit')}
            editing={editState.editingSection === 'details'}
            dirty={editState.editingSection === 'details' && editState.dirty}
            disabled={isSaving}
            onEdit={() => beginEdit('details')}
            editor={
              <textarea
                className="w-full resize-y rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
                rows={7}
                value={editState.draft.details}
                onChange={(event) =>
                  editState.setDraft((draft) => ({ ...draft, details: event.target.value }))
                }
                disabled={isSaving}
              />
            }
          >
            <pre className="max-h-60 overflow-y-auto whitespace-pre-wrap break-words rounded bg-slate-50 p-3 text-sm leading-relaxed text-slate-800">
              {body.content || '—'}
            </pre>
          </EditableSection>

          {current.tags.length > 0 && (
            <section className="rounded-lg border border-slate-200 bg-white p-4">
              <h3 className="mb-2 text-xs font-bold uppercase text-slate-500">
                {t('filters.tag')}
              </h3>
              <TagChipRow tags={current.tags} readonly />
            </section>
          )}

          {(current.assets?.length ?? 0) > 0 && (
            <section className="rounded-lg border border-slate-200 bg-white p-4">
              <h3 className="mb-2 text-xs font-bold uppercase text-slate-500">
                {t('record.assets')}
              </h3>
              <ul className="grid gap-1">
                {current.assets?.map((asset) => (
                  <li
                    key={asset}
                    className="truncate font-mono text-xs text-slate-700"
                    title={asset}
                  >
                    {asset}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {(current.relations?.length ?? 0) > 0 && (
            <section className="rounded-lg border border-slate-200 bg-white p-4">
              <h3 className="mb-2 text-xs font-bold uppercase text-slate-500">
                {t('record.relations')}
              </h3>
              <ul className="grid gap-1">
                {current.relations?.map((rel, index) => (
                  <li
                    key={`${rel.constraint}:${rel.target}:${index}`}
                    className="truncate text-xs text-slate-700"
                    title={rel.target}
                  >
                    {rel.constraint}: {rel.target}
                  </li>
                ))}
              </ul>
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
        onCancel={cancelDiscard}
        onConfirm={confirmDiscard}
      />
    </>
  )
}

function initialFormState(
  record: RecordItem<RecordBody>,
  body: { title: string; description: string; content: string },
): EditPatchFormState {
  const statusTag = record.tags.find((tag) => tag.startsWith('status:')) ?? ''
  const priorityTag = record.tags.find((tag) => tag.startsWith('priority:')) ?? ''
  const otherTags = record.tags.filter(
    (tag) => !tag.startsWith('status:') && !tag.startsWith('priority:'),
  ) as Tag[]

  return {
    title: body.title,
    summary: body.description,
    details: body.content,
    statusTag,
    priorityTag,
    otherTags,
    unsupportedTags: [],
    assignee: record.assignee ?? '',
    assets: [...(record.assets ?? [])],
    relations: (record.relations ?? []).map((relation) => ({ ...relation })),
  }
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

function emptyBody() {
  return { title: '', description: '', content: '' }
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid min-w-0 gap-0.5 rounded-md bg-slate-100 p-2.5">
      <dt className="text-xs font-bold uppercase text-slate-500">{label}</dt>
      <dd className="m-0 wrap-break-word text-slate-950">{value}</dd>
    </div>
  )
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

function abortRequest(
  requestIdRef: MutableRefObject<number>,
  abortRef: MutableRefObject<AbortController | null>,
  setIsSaving?: (value: boolean) => void,
) {
  requestIdRef.current += 1
  abortRef.current?.abort()
  abortRef.current = null
  setIsSaving?.(false)
}
