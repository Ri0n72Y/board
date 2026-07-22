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
  RecordHistoryResponse,
  RecordItem,
  RecordResponse,
  RelationRef,
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
  buildEditFieldDirtyState,
  buildPatchDraft,
  hasEditFieldChanges,
  hasEditHeadChanged,
  type EditPatchDraft,
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
import { RecordHistoryContent } from './RecordHistoryContent'
import {
  ensureReferenceOptions,
  type RecordReferenceOption,
} from '../utils/recordReferenceOptions'
import type { RelationConstraintOption } from '../utils/relationDisplay'
import { RelationEditor } from './RelationEditor'

type DetailEditSection =
  | 'title'
  | 'summary'
  | 'details'
  | 'assignee'
  | 'tags'
  | 'assets'
  | 'relations'

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
  assets: string[]
  relations: RelationRef[]
}

interface RecordDetailDrawerProps {
  open: boolean
  record: RecordResponse<RecordItem<RecordBody>> | null
  profiles?: Profile[] | null
  history: RecordHistoryResponse | null
  isHistoryLoading: boolean
  historyError: string | null
  assetOptions: RecordReferenceOption[]
  relationTargetOptions: RecordReferenceOption[]
  relationConstraintOptions: RelationConstraintOption[]
  initialPatchDescription?: string
  onInitialPatchDescriptionConsumed?: () => void
  onClose: () => void
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
  relationTargetOptions,
  relationConstraintOptions,
  initialPatchDescription,
  onInitialPatchDescriptionConsumed,
  onClose,
  onHistoryClick,
}: RecordDetailDrawerProps) {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage ?? i18n.language ?? 'en'
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
  const savingRef = useRef(false)

  const current = record?.body ?? null
  const displayRecord = useMemo(() => {
    if (!current) return emptyDisplayRecord()
    if (savedDisplayRecord?.recordId === current.id) return savedDisplayRecord
    return {
      recordId: current.id,
      body: asEditableBody(current.body),
      assignee: current.assignee ?? '',
      tags: [...current.tags],
      assets: [...(current.assets ?? [])],
      relations: (current.relations ?? []).map((relation) => ({ ...relation })),
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
      Boolean(
        baselineRecord &&
          hasEditFieldChanges(buildEditFieldDirtyState(draft, baselineRecord))
      ),
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
    savingRef.current = false
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
  const displayAssets = displayRecord.assets
  const displayRelations = displayRecord.relations
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
  const draftTags = buildDraftTags(editState.draft)
  const draftAssignee = editState.draft.assignee.trim()
  const draftAssigneeProfile = lookupProfile(profiles ?? null, draftAssignee)
  const draftAssigneeDisplay = formatProfileCompact(
    draftAssignee,
    draftAssigneeProfile,
    t('record.unassigned'),
    t('record.unknownMember')
  )
  const recordReferenceCopy = {
    unknownAsset: t('recordReference.unknownAsset'),
    unknownRecord: t('recordReference.unknownRecord'),
    rawId: t('recordReference.rawId'),
  }
  const selectableAssetOptions = ensureReferenceOptions(
    assetOptions,
    editState.draft.assets,
    'asset',
    recordReferenceCopy
  )
  const selectableRelationTargetOptions = ensureReferenceOptions(
    relationTargetOptions,
    editState.draft.relations.map((relation) => relation.target),
    'record',
    recordReferenceCopy
  )
  const fieldDirty = buildEditFieldDirtyState(editState.draft, activeBaseline)
  const sectionDirty = {
    title: fieldDirty.title,
    summary: fieldDirty.summary,
    details: fieldDirty.details,
    assignee: fieldDirty.assignee,
    tags:
      fieldDirty.statusTag ||
      fieldDirty.priorityTag ||
      fieldDirty.otherTags,
    assets: fieldDirty.assets,
    relations: fieldDirty.relations,
  }
  const visibleAssets = sectionDirty.assets
    ? editState.draft.assets
    : displayAssets
  const visibleRelations = sectionDirty.relations
    ? editState.draft.relations
    : displayRelations

  function beginEdit(section: DetailEditSection) {
    if (isSaving) return
    editState.beginEdit(section)
  }

  function deactivateActiveEditSection() {
    if (isSaving) return
    editState.deactivateEditingSection()
  }

  function requestClose() {
    if (isSaving) return
    if (!editState.requestClose()) {
      setPendingAction({ type: 'close' })
      return
    }
    abortRequest(requestIdRef, abortRef, setIsSaving)
    setActivePanel('detail')
    onClose()
  }

  function requestHistory() {
    if (isSaving) return
    if (!editState.requestClose()) {
      setPendingAction({ type: 'history' })
      return
    }
    onHistoryClick(activeRecord)
    setActivePanel('history')
  }

  function cancelDiscard() {
    if (isSaving) return
    setPendingAction(null)
    editState.cancelPendingExit()
  }

  function confirmDiscard() {
    if (isSaving) return
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
    if (savingRef.current) return

    const savedDraft = editState.draft
    const validation = buildPatchDraft(savedDraft, activeBaseline)
    if (!validation.ok) {
      const message = t(validation.error)
      setError(message)
      toastWarning(message)
      return
    }

    savingRef.current = true
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
        return
      }

      const head = await fetchRecordHead(activeCurrent.id, controller.signal)
      if (requestIdRef.current !== requestId || controller.signal.aborted)
        return
      if (!head.exists) {
        setError(t('edit.headMissing'))
        return
      }
      if (hasEditHeadChanged(baseHead, head)) {
        const message = t('edit.staleHead')
        setError(message)
        toastError(message)
        return
      }

      const payload: SubmitRecordPatchPayload = {
        parentId: baseHead.lastPatchId,
        currentVersion: baseHead.currentVersion,
        ...validation.patch,
      }
      if (initialPatchDescription) {
        payload.description = initialPatchDescription
      }
      const result = await submitRecordPatch(
        activeCurrent.id,
        payload,
        controller.signal
      )
      if (requestIdRef.current !== requestId || controller.signal.aborted)
        return

      const committedDisplayRecord = buildCommittedDisplayRecord(
        activeBaseline,
        validation.patch,
        buildDraftTags(savedDraft),
        savedDraft.assignee.trim()
      )
      const committedDraft = initialFormState(
        buildBaselineRecord(activeCurrent, committedDisplayRecord),
        committedDisplayRecord.body
      )
      const nextDraft: EditPatchFormState = {
        ...committedDraft,
        relations: savedDraft.relations.map((relation) => ({ ...relation })),
      }

      setBaseHead({
        recordId: activeCurrent.id,
        lastPatchId: result.patch.body.id,
        currentVersion: result.newCurrentVersion,
      })
      setSavedDisplayRecord(committedDisplayRecord)
      toastSuccess(t('edit.saveSuccess'))
      editState.finishSave(nextDraft)
      if (initialPatchDescription) {
        onInitialPatchDescriptionConsumed?.()
      }
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
    } finally {
      if (requestIdRef.current === requestId) abortRef.current = null
      savingRef.current = false
      setIsSaving(false)
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
            disabled={isSaving}
            icon={<ClockIcon className="h-4 w-4" />}
          >
            {t('record.history')}
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            onClick={() => setActivePanel('detail')}
            disabled={isSaving}
            icon={<ArrowLeftIcon className="h-4 w-4" />}
          >
            {t('record.details')}
          </Button>
        )}
        {activePanel === 'detail' && editState.dirty && (
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
        {t('record.updated')}: v{baseHead?.currentVersion ?? '—'}
      </p>
    </div>
  )

  return (
    <>
      <AnimatedDrawer
        open={open}
        onClose={requestClose}
        title={
          sectionDirty.title
            ? editState.draft.title.trim() || activeCurrent.pid
            : displayBody.title || activeCurrent.pid
        }
        subtitle={
          activePanel === 'history'
            ? `${activeCurrent.pid} · ${t('history.subtitle')}`
            : activeCurrent.pid
        }
        size="md"
        closeLabel={t('record.close')}
        closeDisabled={isSaving}
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

          {activePanel === 'detail' && initialPatchDescription && (
            <section className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
              <p className="text-xs font-semibold uppercase text-indigo-700">
                {t('edit.initialPatchDescriptionNotice')}
              </p>
              <p className="mt-1 whitespace-pre-wrap">
                {initialPatchDescription}
              </p>
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
              onClick={deactivateActiveEditSection}
            >
              <EditableSection
                title={t('record.assignee')}
                inline
                editing={editState.isEditing('assignee')}
                dirty={sectionDirty.assignee}
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
                  {(sectionDirty.assignee ? draftAssignee : displayAssignee) && (
                    <ProfileAvatar
                      name={
                        (sectionDirty.assignee
                          ? draftAssigneeProfile
                          : profile
                        )?.name ??
                        (sectionDirty.assignee
                          ? draftAssignee
                          : displayAssignee)
                      }
                      pk={
                        sectionDirty.assignee
                          ? draftAssignee
                          : displayAssignee
                      }
                      avatarUrl={
                        (sectionDirty.assignee
                          ? draftAssigneeProfile
                          : profile
                        )?.avatarUrl ?? null
                      }
                      size={32}
                    />
                  )}
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {sectionDirty.assignee
                      ? draftAssigneeDisplay
                      : assigneeDisplay}
                  </p>
                </div>
              </EditableSection>

              <EditableSection
                title={t('edit.titleField')}
                inline
                editing={editState.isEditing('title')}
                dirty={sectionDirty.title}
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
                  {sectionDirty.title
                    ? editState.draft.title.trim() || activeCurrent.pid
                    : displayBody.title || activeCurrent.pid}
                </p>
              </EditableSection>

              <EditableSection
                title={t('edit.summary')}
                editing={editState.isEditing('summary')}
                dirty={sectionDirty.summary}
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
                  {sectionDirty.summary
                    ? editState.draft.summary || '—'
                    : displayBody.description || '—'}
                </p>
              </EditableSection>

              <EditableSection
                title={t('edit.details')}
                editing={editState.isEditing('details')}
                dirty={sectionDirty.details}
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
                  {sectionDirty.details
                    ? editState.draft.details || '—'
                    : displayBody.content || '—'}
                </pre>
              </EditableSection>

              <EditableSection
                title={t('filters.tag')}
                inline={!editState.isEditing('tags')}
                editing={editState.isEditing('tags')}
                dirty={sectionDirty.tags}
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
                {(sectionDirty.tags ? draftTags : displayTags).length > 0 ? (
                  <TagChipRow
                    tags={sectionDirty.tags ? draftTags : displayTags}
                    readonly
                  />
                ) : (
                  <p className="text-sm text-slate-500">—</p>
                )}
              </EditableSection>

              <EditableSection
                title={t('record.assets')}
                editing={editState.isEditing('assets')}
                dirty={sectionDirty.assets}
                disabled={isSaving}
                onEdit={() => beginEdit('assets')}
                editor={
                  <SearchSelect
                    mode="option"
                    label={t('edit.assetSelector')}
                    options={selectableAssetOptions}
                    values={editState.draft.assets}
                    multiple
                    onChangeMany={(assets) =>
                      editState.setDraft((draft) => ({ ...draft, assets }))
                    }
                    placeholder={t('searchSelect.searchPlaceholder')}
                    selectedLabel={t('edit.assets')}
                    emptyText={t('filters.noAssetOptions')}
                    allowCustomValue={false}
                    disabled={isSaving}
                  />
                }
              >
                {visibleAssets.length > 0 ? (
                  <ul className="grid gap-1">
                    {visibleAssets.map((asset) => (
                      <li
                        key={asset}
                        className="truncate font-mono text-xs text-slate-700"
                        title={asset}
                      >
                        {asset}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-500">—</p>
                )}
              </EditableSection>

              <EditableSection
                title={t('record.relations')}
                editing={editState.isEditing('relations')}
                dirty={sectionDirty.relations}
                disabled={isSaving}
                onEdit={() => beginEdit('relations')}
                editor={
                  <RelationEditor
                    label={t('relations.title')}
                    value={editState.draft.relations}
                    targetOptions={selectableRelationTargetOptions}
                    constraintOptions={relationConstraintOptions}
                    currentRecordId={activeCurrent.id}
                    onChange={(relations) =>
                      editState.setDraft((draft) => ({ ...draft, relations }))
                    }
                    disabled={isSaving}
                  />
                }
              >
                {visibleRelations.length > 0 ? (
                  <ul className="grid gap-1">
                    {visibleRelations.map((relation, index) => (
                      <li
                        key={`${relation.constraint}:${relation.target}:${index}`}
                        className="truncate text-xs text-slate-700"
                        title={relation.target}
                      >
                        {relation.constraint}: {relation.target}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-500">—</p>
                )}
              </EditableSection>
            </div>
          )}
        </div>
      </AnimatedDrawer>

      <UnsavedChangesDialog
        open={editState.pendingExit}
        title={t('edit.unsavedDiscardTitle')}
        message={t('edit.unsavedDiscardMessage')}
        confirmLabel={t('edit.unsavedDiscardConfirm')}
        cancelLabel={t('edit.unsavedDiscardCancel')}
        onCancel={cancelDiscard}
        onConfirm={confirmDiscard}
        disabled={isSaving}
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
    assets: [],
    relations: [],
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
    assets: [...displayRecord.assets],
    relations: displayRecord.relations.map((relation) => ({ ...relation })),
    body: {
      ...sourceBody,
      title: displayRecord.body.title,
      description: displayRecord.body.description,
      content: displayRecord.body.content,
    } as RecordBody,
  } as RecordItem<RecordBody>
}

function buildCommittedDisplayRecord(
  current: RecordItem<RecordBody>,
  patch: EditPatchDraft,
  nextTags: Tag[],
  nextAssignee: string
): DisplayRecordState {
  const currentBody = asEditableBody(current.body)
  const bodyPatch = patch.body
  return {
    recordId: current.id,
    body: {
      title: bodyPatch?.title ?? currentBody.title,
      description:
        bodyPatch && 'description' in bodyPatch
          ? (bodyPatch.description ?? '')
          : currentBody.description,
      content:
        bodyPatch && 'content' in bodyPatch
          ? (bodyPatch.content ?? '')
          : currentBody.content,
    },
    assignee: 'assignee' in patch ? nextAssignee : (current.assignee ?? ''),
    tags: patch.tagChanges ? [...nextTags] : [...current.tags],
    assets: [...(patch.assets ?? current.assets ?? [])],
    relations: (patch.relations ?? current.relations ?? []).map((relation) => ({
      ...relation,
    })),
  }
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
