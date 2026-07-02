import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from 'react'
import type {
  Profile,
  RecordBody,
  RecordHistoryResponse,
  RecordItem,
  RecordResponse,
  Tag,
} from '@labour-board/shared'
import {
  ArrowLeftIcon,
  ClockIcon,
  PencilSquareIcon,
} from '@heroicons/react/20/solid'
import axios from 'axios'
import { useTranslation } from 'react-i18next'
import { fetchRecordHead } from '../api/recordHead'
import { RecordPatchConflictError, submitRecordPatch } from '../api/patches'
import type { SubmitRecordPatchPayload } from '../api/patches'
import { useBoardCurrentStore } from '../stores/boardCurrentStore'
import { useBoardMetadataStore } from '../stores/boardMetadataStore'
import {
  getConfigOtherTags,
  getConfigPriorityTags,
  getConfigStatusTags,
  getProfileOptions,
  lookupProfile,
} from '../utils/board'
import {
  asEditableBody,
  buildPatchDraft,
  hasEditHeadChanged,
  type EditPatchFormState,
} from '../utils/editPatchDraft'
import { formatProfileCompact } from '../utils/profileDisplay'
import { formatTagLabel } from '../utils/tagDisplay'
import { toastError, toastSuccess, toastWarning } from '../utils/toasts'
import { AnimatedDrawer } from './ui/AnimatedDrawer'
import { Button } from './ui/Button'
import { ProfileAvatar } from './ProfileAvatar'
import { TagChipRow } from './BoardFilters'
import { SearchSelect } from './ui/SearchSelect'
import { EditableSection } from './recordDetailEdit/EditableSection'
import { UnsavedChangesDialog } from './recordDetailEdit/UnsavedChangesDialog'
import { useSectionEditState } from './recordDetailEdit/useSectionEditState'
import { RecordHistoryContent } from './RecordHistoryDrawer'
import type { RecordReferenceOption } from '../utils/recordReferenceOptions'

type DetailEditSection = 'title' | 'summary' | 'details' | 'assignee' | 'tags'

type PendingAction = { type: 'close' } | { type: 'history' }

interface DisplayRecordState {
  recordId: string
  body: {
    title: string
    description: string
    content: string
  }
  assignee: string
  tags: Tag[]
}

interface RecordDetailDrawerProps {
  open: boolean
  record: RecordResponse<RecordItem<RecordBody>> | null
  profiles?: Profile[] | null
  history: RecordHistoryResponse | null
  isHistoryLoading: boolean
  historyError: string | null
  assetOptions: RecordReferenceOption[]
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
  history,
  isHistoryLoading,
  historyError,
  assetOptions,
  onClose,
  onHistoryClick,
}: RecordDetailDrawerProps) {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage ?? i18n.language ?? 'en'
  const isZh = lang.startsWith('zh')
  const effectiveFilters = useBoardCurrentStore(
    (state) => state.effectiveFilters
  )
  const loadCurrentBoard = useBoardCurrentStore(
    (state) => state.loadCurrentBoard
  )
  const config = useBoardMetadataStore((state) => state.config)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [baseHead, setBaseHead] = useState<BaseHead | null>(null)
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const [activePanel, setActivePanel] = useState<'detail' | 'history'>('detail')
  const [savedDisplayRecord, setSavedDisplayRecord] =
    useState<DisplayRecordState | null>(null)
  const requestIdRef = useRef(0)
  const abortRef = useRef<AbortController | null>(null)
  const stateKeyRef = useRef<string | null>(null)

  const current = record?.body ?? null
  const displayRecord = useMemo(() => {
    if (!current) return emptyDisplayRecord()
    if (savedDisplayRecord?.recordId === current.id) return savedDisplayRecord
    return {
      recordId: current.id,
      body: asEditableBody(current.body),
      assignee: current.assignee ?? '',
      tags: [...current.tags],
    }
  }, [current, savedDisplayRecord])
  const baselineRecord = useMemo(
    () => (current ? buildBaselineRecord(current, displayRecord) : null),
    [current, displayRecord]
  )
  const initialDraft = useCallback(
    () =>
      baselineRecord
        ? initialFormState(baselineRecord, displayRecord.body)
        : emptyFormState(),
    [baselineRecord, displayRecord.body]
  )
  const isDraftDirty = useCallback(
    (draft: EditPatchFormState) =>
      Boolean(baselineRecord && buildPatchDraft(draft, baselineRecord).ok),
    [baselineRecord]
  )
  const editState = useSectionEditState<DetailEditSection, EditPatchFormState>({
    initialDraft,
    isDirty: isDraftDirty,
  })
  const clearEditState = editState.clearEditState

  useEffect(() => {
    return () => abortRequest(requestIdRef, abortRef)
  }, [])

  useEffect(() => {
    const nextKey = open && current ? current.id : null
    if (stateKeyRef.current === nextKey) return
    stateKeyRef.current = nextKey
    abortRequest(requestIdRef, abortRef, setIsSaving)
    setError(null)
    setBaseHead(null)
    setPendingAction(null)
    setSavedDisplayRecord(null)
    setActivePanel('detail')
    clearEditState()
  }, [clearEditState, current, open])

  useEffect(() => {
    if (!open || !current) return

    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    void fetchRecordHead(current.id, controller.signal)
      .then((head) => {
        if (requestIdRef.current !== requestId || controller.signal.aborted)
          return
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
        setError(
          caught instanceof Error ? caught.message : t('edit.errorGeneral')
        )
      })
      .finally(() => {
        if (requestIdRef.current === requestId) abortRef.current = null
      })

    return () => abortRequest(requestIdRef, abortRef)
  }, [current, open, t])

  if (!open || !record || !current || !baselineRecord) return null

  const activeRecord = record
  const activeCurrent = current
  const activeBaseline = baselineRecord
  const displayBody = displayRecord.body
  const displayAssignee = displayRecord.assignee
  const displayTags = displayRecord.tags
  const profile = lookupProfile(profiles ?? null, displayAssignee)
  const assigneeDisplay = formatProfileCompact(
    displayAssignee,
    profile,
    t('record.unassigned'),
    t('record.unknownMember')
  )
  const profileOptions = getProfileOptions(profiles ?? null)
  const configuredStatusTags = getConfigStatusTags(config)
  const configuredPriorityTags = getConfigPriorityTags(config)
  const configuredOtherTags = getConfigOtherTags(config)
  const statusOptions = uniqueTags([
    ...configuredStatusTags,
    ...displayTags.filter((tag) => tag.startsWith('status:')),
  ])
  const priorityOptions = uniqueTags([
    ...configuredPriorityTags,
    ...displayTags.filter((tag) => tag.startsWith('priority:')),
  ])
  const otherTagOptions = uniqueTags([
    ...configuredOtherTags,
    ...displayTags.filter(
      (tag) => !tag.startsWith('status:') && !tag.startsWith('priority:')
    ),
  ])
  const otherTagSelectOptions = otherTagOptions.map((tag) => ({
    value: tag,
    label: formatTagLabel(tag, lang),
    meta: tag,
  }))
  const sectionDirty = {
    title: editState.draft.title.trim() !== displayBody.title,
    summary:
      normalizeNullable(editState.draft.summary) !==
      normalizeNullable(displayBody.description),
    details:
      normalizeNullable(editState.draft.details) !==
      normalizeNullable(displayBody.content),
    assignee: editState.draft.assignee.trim() !== displayAssignee,
    tags: !sameStringList(buildDraftTags(editState.draft), displayTags),
  }

  function beginEdit(section: DetailEditSection) {
    editState.beginEdit(section)
  }

  function clearCleanEditState() {
    if (editState.editingSections.length === 0 || editState.dirty) return
    editState.setDraft(initialDraft())
    editState.setEditingSections([])
  }

  function requestClose() {
    if (!editState.requestClose()) {
      setPendingAction({ type: 'close' })
      return
    }
    abortRequest(requestIdRef, abortRef, setIsSaving)
    setActivePanel('detail')
    onClose()
  }

  function requestHistory() {
    if (!editState.requestClose()) {
      setPendingAction({ type: 'history' })
      return
    }
    editState.setDraft(initialDraft())
    editState.setEditingSections([])
    onHistoryClick(activeRecord)
    setActivePanel('history')
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
      setActivePanel('detail')
      onClose()
      return
    }
    onHistoryClick(activeRecord)
    setActivePanel('history')
  }

  async function save() {
    const validation = buildPatchDraft(editState.draft, activeBaseline)
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
      if (!baseHead || baseHead.recordId !== activeCurrent.id) {
        setError(t('edit.headMissing'))
        setIsSaving(false)
        return
      }

      const head = await fetchRecordHead(activeCurrent.id, controller.signal)
      if (requestIdRef.current !== requestId || controller.signal.aborted)
        return
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
      await submitRecordPatch(activeCurrent.id, payload, controller.signal)
      if (requestIdRef.current !== requestId || controller.signal.aborted)
        return

      const updatedHead = await fetchRecordHead(
        activeCurrent.id,
        controller.signal
      )
      if (requestIdRef.current !== requestId || controller.signal.aborted)
        return
      if (updatedHead.exists) {
        setBaseHead({
          recordId: activeCurrent.id,
          lastPatchId: updatedHead.lastPatchId,
          currentVersion: updatedHead.currentVersion,
        })
      }

      setSavedDisplayRecord({
        recordId: activeCurrent.id,
        body: {
          title: editState.draft.title.trim(),
          description: editState.draft.summary.trim(),
          content: editState.draft.details.trim(),
        },
        assignee: editState.draft.assignee.trim(),
        tags: buildDraftTags(editState.draft),
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
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {activePanel === 'detail' ? (
          <Button
            type="button"
            variant="ghost"
            onClick={requestHistory}
            icon={<ClockIcon className="h-4 w-4" />}
          >
            {t('record.history')}
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            onClick={() => setActivePanel('detail')}
            icon={<ArrowLeftIcon className="h-4 w-4" />}
          >
            {isZh ? '详情' : 'Details'}
          </Button>
        )}
        {activePanel === 'detail' && editState.editingSections.length > 0 && (
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
      <p className="text-xs text-slate-500">
        {t('record.created')}: {formatDate(activeRecord.createdAt)} ·{' '}
        {isZh ? '最近版本' : 'Updated'}: v{baseHead?.currentVersion ?? '—'}
      </p>
    </div>
  )

  return (
    <>
      <AnimatedDrawer
        open={open}
        onClose={requestClose}
        title={displayBody.title || activeCurrent.pid}
        subtitle={
          activePanel === 'history'
            ? `${activeCurrent.pid} · ${t('history.subtitle')}`
            : activeCurrent.pid
        }
        size="md"
        closeLabel={t('record.close')}
        footer={footer}
      >
        <div className="grid min-h-full content-start gap-4">
          {error && (
            <section
              className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800"
              role="alert"
            >
              {error}
            </section>
          )}

          {activePanel === 'history' ? (
            <RecordHistoryContent
              history={history}
              isLoading={isHistoryLoading}
              error={historyError}
              language={lang}
              assetOptions={assetOptions}
              profiles={profiles ?? null}
            />
          ) : (
            <div
              className="grid min-h-full content-start gap-4"
              onClick={clearCleanEditState}
            >
          <EditableSection
            title={t('record.assignee')}
            inline
            editing={editState.isEditing('assignee')}
            dirty={editState.isEditing('assignee') && sectionDirty.assignee}
            disabled={isSaving}
            onEdit={() => beginEdit('assignee')}
            editor={
              <SearchSelect
                mode="option"
                value={editState.draft.assignee || null}
                onChange={(next) =>
                  editState.setDraft((draft) => ({
                    ...draft,
                    assignee: next ?? '',
                  }))
                }
                options={profileOptions}
                placeholder={t('edit.assigneePlaceholder')}
                disabled={isSaving}
              />
            }
          >
            <div className="flex min-w-0 items-center justify-end gap-3">
              {displayAssignee && (
                <ProfileAvatar
                  name={profile?.name ?? displayAssignee}
                  pk={displayAssignee}
                  avatarUrl={profile?.avatarUrl ?? null}
                  size={32}
                />
              )}
              <p className="truncate text-sm font-semibold text-slate-900">
                {assigneeDisplay}
              </p>
            </div>
          </EditableSection>

          <EditableSection
            title={t('edit.titleField')}
            inline
            editing={editState.isEditing('title')}
            dirty={editState.isEditing('title') && sectionDirty.title}
            disabled={isSaving}
            onEdit={() => beginEdit('title')}
            editor={
              <input
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
                value={editState.draft.title}
                onChange={(event) =>
                  editState.setDraft((draft) => ({
                    ...draft,
                    title: event.target.value,
                  }))
                }
                disabled={isSaving}
              />
            }
          >
            <p className="truncate text-sm leading-relaxed text-slate-800">
              {displayBody.title || activeCurrent.pid}
            </p>
          </EditableSection>

          <EditableSection
            title={t('edit.summary')}
            editing={editState.isEditing('summary')}
            dirty={editState.isEditing('summary') && sectionDirty.summary}
            disabled={isSaving}
            onEdit={() => beginEdit('summary')}
            editor={
              <textarea
                className="w-full resize-y rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
                rows={3}
                value={editState.draft.summary}
                onChange={(event) =>
                  editState.setDraft((draft) => ({
                    ...draft,
                    summary: event.target.value,
                  }))
                }
                disabled={isSaving}
              />
            }
          >
            <p className="text-sm leading-relaxed text-slate-800">
              {displayBody.description || '—'}
            </p>
          </EditableSection>

          <EditableSection
            title={t('edit.details')}
            editing={editState.isEditing('details')}
            dirty={editState.isEditing('details') && sectionDirty.details}
            disabled={isSaving}
            onEdit={() => beginEdit('details')}
            editor={
              <textarea
                className="w-full resize-y rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
                rows={7}
                value={editState.draft.details}
                onChange={(event) =>
                  editState.setDraft((draft) => ({
                    ...draft,
                    details: event.target.value,
                  }))
                }
                disabled={isSaving}
              />
            }
          >
            <pre className="max-h-60 overflow-y-auto whitespace-pre-wrap wrap-break-word rounded bg-slate-50 p-3 text-sm leading-relaxed text-slate-800">
              {displayBody.content || '—'}
            </pre>
          </EditableSection>

          <EditableSection
            title={t('filters.tag')}
            inline={!editState.isEditing('tags')}
            editing={editState.isEditing('tags')}
            dirty={editState.isEditing('tags') && sectionDirty.tags}
            disabled={isSaving}
            onEdit={() => beginEdit('tags')}
            editor={
              <div className="grid gap-4">
                <TagOptionGrid
                  label={t('edit.statusTag')}
                  tags={statusOptions}
                  selected={editState.draft.statusTag}
                  lang={lang}
                  required
                  disabled={isSaving}
                  onSelect={(tag) =>
                    editState.setDraft((draft) => ({
                      ...draft,
                      statusTag: tag,
                    }))
                  }
                />
                <TagOptionGrid
                  label={t('edit.priorityTag')}
                  tags={priorityOptions}
                  selected={editState.draft.priorityTag}
                  lang={lang}
                  disabled={isSaving}
                  onSelect={(tag) =>
                    editState.setDraft((draft) => ({
                      ...draft,
                      priorityTag: draft.priorityTag === tag ? '' : tag,
                    }))
                  }
                />
                <SearchSelect
                  mode="tag"
                  label={t('edit.otherTags')}
                  options={otherTagSelectOptions}
                  values={editState.draft.otherTags}
                  multiple
                  onChangeMany={(nextTags) =>
                    editState.setDraft((draft) => ({
                      ...draft,
                      otherTags: nextTags.filter((tag) =>
                        otherTagOptions.includes(tag as Tag)
                      ) as Tag[],
                    }))
                  }
                  placeholder={t('searchSelect.searchPlaceholder')}
                  selectedLabel={t('edit.otherTags')}
                  emptyText={t('create.noConfigTags')}
                  disabled={isSaving}
                />
              </div>
            }
          >
            {displayTags.length > 0 ? (
              <TagChipRow tags={displayTags} readonly />
            ) : (
              <p className="text-sm text-slate-500">—</p>
            )}
          </EditableSection>

          {(activeCurrent.assets?.length ?? 0) > 0 && (
            <ReadOnlyInfoSection title={t('record.assets')}>
              <ul className="grid gap-1">
                {activeCurrent.assets?.map((asset) => (
                  <li
                    key={asset}
                    className="truncate font-mono text-xs text-slate-700"
                    title={asset}
                  >
                    {asset}
                  </li>
                ))}
              </ul>
            </ReadOnlyInfoSection>
          )}

          {(activeCurrent.relations?.length ?? 0) > 0 && (
            <ReadOnlyInfoSection title={t('record.relations')}>
              <ul className="grid gap-1">
                {activeCurrent.relations?.map((rel, index) => (
                  <li
                    key={`${rel.constraint}:${rel.target}:${index}`}
                    className="truncate text-xs text-slate-700"
                    title={rel.target}
                  >
                    {rel.constraint}: {rel.target}
                  </li>
                ))}
              </ul>
              </ReadOnlyInfoSection>
            )}
            </div>
          )}
        </div>
      </AnimatedDrawer>

      <UnsavedChangesDialog
        open={editState.pendingExit}
        title={isZh ? '放弃未保存的修改？' : 'Discard unsaved changes?'}
        message={
          isZh
            ? '当前详情中有未保存的修改。要放弃这些修改并继续吗？'
            : 'This detail drawer has unsaved changes. Discard them and continue?'
        }
        confirmLabel={isZh ? '放弃修改' : 'Discard changes'}
        cancelLabel={isZh ? '继续编辑' : 'Keep editing'}
        onCancel={cancelDiscard}
        onConfirm={confirmDiscard}
      />
    </>
  )
}

function TagOptionGrid({
  label,
  tags,
  selected,
  lang,
  required = false,
  disabled = false,
  onSelect,
}: {
  label: string
  tags: Tag[]
  selected: string
  lang: string
  required?: boolean
  disabled?: boolean
  onSelect: (tag: Tag) => void
}) {
  return (
    <div className="grid gap-2">
      <label className="text-xs font-bold text-slate-500">{label}</label>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => {
          const isSelected = selected === tag
          return (
            <button
              key={tag}
              type="button"
              className={
                isSelected
                  ? 'inline-flex min-h-7 max-w-full items-center rounded-full border border-emerald-700 bg-emerald-100 px-2.5 text-xs font-medium text-emerald-800'
                  : 'inline-flex min-h-7 max-w-full items-center rounded-full bg-slate-100 px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-200'
              }
              disabled={disabled || (required && isSelected)}
              onClick={() => onSelect(tag)}
            >
              {formatTagLabel(tag, lang)}
            </button>
          )
        })}
        {tags.length === 0 && <p className="text-sm text-slate-500">—</p>}
      </div>
    </div>
  )
}

function ReadOnlyInfoSection({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <h3 className="mb-2 text-xs font-bold uppercase text-slate-500">
        {title}
      </h3>
      {children}
    </section>
  )
}

function initialFormState(
  record: RecordItem<RecordBody>,
  body: { title: string; description: string; content: string }
): EditPatchFormState {
  const statusTag = record.tags.find((tag) => tag.startsWith('status:')) ?? ''
  const priorityTag =
    record.tags.find((tag) => tag.startsWith('priority:')) ?? ''
  const otherTags = record.tags.filter(
    (tag) => !tag.startsWith('status:') && !tag.startsWith('priority:')
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

function emptyDisplayRecord(): DisplayRecordState {
  return {
    recordId: '',
    body: emptyBody(),
    assignee: '',
    tags: [],
  }
}

function buildBaselineRecord(
  record: RecordItem<RecordBody>,
  displayRecord: DisplayRecordState
): RecordItem<RecordBody> {
  const sourceBody =
    record.body &&
    typeof record.body === 'object' &&
    !Array.isArray(record.body)
      ? (record.body as Record<string, unknown>)
      : {}
  return {
    ...record,
    assignee: displayRecord.assignee || undefined,
    tags: [...displayRecord.tags],
    body: {
      ...sourceBody,
      title: displayRecord.body.title,
      description: displayRecord.body.description,
      content: displayRecord.body.content,
    } as RecordBody,
  } as RecordItem<RecordBody>
}

function buildDraftTags(form: EditPatchFormState): Tag[] {
  return uniqueTags(
    [
      form.statusTag.trim() as Tag,
      form.priorityTag.trim() as Tag,
      ...form.otherTags,
      ...form.unsupportedTags,
    ].filter(Boolean) as Tag[]
  )
}

function uniqueTags(tags: Tag[]): Tag[] {
  return [...new Set(tags)]
}

function sameStringList(left: readonly string[], right: readonly string[]) {
  if (left.length !== right.length) return false
  return left.every((value, index) => value === right[index])
}

function normalizeNullable(value: string): string | null {
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

function abortRequest(
  requestIdRef: MutableRefObject<number>,
  abortRef: MutableRefObject<AbortController | null>,
  setIsSaving?: (value: boolean) => void
) {
  requestIdRef.current += 1
  abortRef.current?.abort()
  abortRef.current = null
  setIsSaving?.(false)
}
