import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import type {
  Profile,
  RecordBody,
  RecordItem,
  RecordResponse,
  Tag,
} from '@labour-board/shared'
import {
  ExclamationTriangleIcon,
  PencilSquareIcon,
} from '@heroicons/react/20/solid'
import { useTranslation } from 'react-i18next'
import axios from 'axios'
import { submitRecordPatch, RecordPatchConflictError } from '../api/patches'
import type { SubmitRecordPatchPayload } from '../api/patches'
import { fetchRecordHead } from '../api/recordHead'
import { getProfileOptions } from '../utils/board'
import {
  ensureReferenceOptions,
  type RecordReferenceOption,
} from '../utils/recordReferenceOptions'
import type { RelationConstraintOption } from '../utils/relationDisplay'
import {
  asEditableBody,
  buildPatchDraft,
  hasEditHeadChanged,
  type EditPatchFormState,
} from '../utils/editPatchDraft'
import { formatTagLabel } from '../utils/tagDisplay'
import { RelationEditor } from './RelationEditor'
import { AnimatedDrawer } from './ui/AnimatedDrawer'
import { Button } from './ui/Button'
import { SearchSelect } from './ui/SearchSelect'
import { TextInput } from './ui/TextInput'
import { cn } from '../lib/cn'

interface EditRecordDrawerProps {
  open: boolean
  record: RecordResponse<RecordItem<RecordBody>>
  profiles: Profile[] | null
  knownTags: Tag[]
  configOtherTags?: Tag[]
  statusTags: Tag[]
  priorityTags: Tag[]
  assetOptions: RecordReferenceOption[]
  relationTargetOptions: RecordReferenceOption[]
  relationConstraintOptions: RelationConstraintOption[]
  initialPatchDescription?: string
  onClose: () => void
  onPatched: (recordId: string) => Promise<void> | void
}

interface BaseHead {
  recordId: string
  lastPatchId: string | null
  currentVersion: number
}

type EditableFieldId =
  | 'title'
  | 'summary'
  | 'details'
  | 'assignee'
  | 'statusTag'
  | 'priorityTag'
  | 'otherTags'
  | 'assets'
  | 'relations'

type FieldDirtyState = Record<EditableFieldId, boolean>

export function EditRecordDrawer({
  open,
  record,
  profiles,
  knownTags,
  configOtherTags,
  statusTags,
  priorityTags,
  assetOptions,
  relationTargetOptions,
  relationConstraintOptions,
  initialPatchDescription,
  onClose,
  onPatched,
}: EditRecordDrawerProps) {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage
  const current = record.body
  const baseForm = useMemo(
    () => initialFormState(current, configOtherTags ?? knownTags, statusTags),
    [configOtherTags, current, knownTags, statusTags]
  )
  const [form, setForm] = useState<EditPatchFormState>(() =>
    initialFormState(current, configOtherTags ?? knownTags, statusTags)
  )
  const [activeField, setActiveField] = useState<EditableFieldId | null>(null)
  const fieldDirty = useMemo(
    () => buildFieldDirtyState(form, baseForm),
    [baseForm, form]
  )
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [baseHead, setBaseHead] = useState<BaseHead | null>(null)
  const requestIdRef = useRef(0)
  const abortRef = useRef<AbortController | null>(null)

  const profileOptions = useMemo(() => getProfileOptions(profiles), [profiles])
  const otherTagOptions = useMemo(
    () =>
      (configOtherTags ?? knownTags).filter(
        (tag) => !tag.startsWith('status:') && !tag.startsWith('priority:')
      ),
    [configOtherTags, knownTags]
  )
  const otherTagSelectOptions = useMemo(
    () =>
      otherTagOptions.map((tag) => ({
        value: tag,
        label: formatTagLabel(tag, lang),
        meta: tag,
      })),
    [otherTagOptions, lang]
  )
  const recordReferenceCopy = useMemo(
    () => ({
      unknownAsset: t('recordReference.unknownAsset'),
      unknownRecord: t('recordReference.unknownRecord'),
      rawId: t('recordReference.rawId'),
    }),
    [t]
  )
  const selectableAssetOptions = useMemo(
    () =>
      ensureReferenceOptions(
        assetOptions,
        form.assets,
        'asset',
        recordReferenceCopy
      ),
    [assetOptions, form.assets, recordReferenceCopy]
  )
  const selectableRelationTargetOptions = useMemo(
    () =>
      ensureReferenceOptions(
        relationTargetOptions,
        form.relations.map((relation) => relation.target),
        'record',
        recordReferenceCopy
      ),
    [form.relations, recordReferenceCopy, relationTargetOptions]
  )

  useEffect(() => {
    return () => abortEdit(requestIdRef, abortRef)
  }, [])

  useEffect(() => {
    if (!open) return

    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    void fetchRecordHead(current.id, controller.signal)
      .then((head) => {
        if (requestIdRef.current !== requestId || controller.signal.aborted) {
          return
        }
        if (!head.exists) {
          setError(t('edit.headMissing'))
          return
        }
        setBaseHead({
          recordId: current.id,
          lastPatchId: head.lastPatchId,
          currentVersion: head.currentVersion,
        })
      })
      .catch((caught) => {
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
        if (requestIdRef.current === requestId) {
          abortRef.current = null
        }
      })

    return () => abortEdit(requestIdRef, abortRef)
  }, [current.id, open, t])

  const close = useCallback(() => {
    abortEdit(requestIdRef, abortRef, setIsSaving)
    onClose()
  }, [onClose])

  const handleFormPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLFormElement>) => {
      if (!(event.target instanceof Element)) {
        setActiveField(null)
        return
      }
      const field = event.target
        .closest<HTMLElement>('[data-edit-field]')
        ?.dataset.editField
      setActiveField(isEditableFieldId(field) ? field : null)
    },
    []
  )

  async function submit() {
    const validation = buildPatchDraft(form, current)
    if (!validation.ok) {
      setError(t(validation.error))
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
      if (requestIdRef.current !== requestId || controller.signal.aborted)
        return

      if (!head.exists) {
        setError(t('edit.headMissing'))
        setIsSaving(false)
        return
      }

      if (hasEditHeadChanged(baseHead, head)) {
        setError(t('edit.staleHead'))
        setIsSaving(false)
        return
      }

      const parentId = baseHead.lastPatchId
      const payload: SubmitRecordPatchPayload = {
        parentId,
        currentVersion: baseHead.currentVersion,
        ...validation.patch,
      }

      if (initialPatchDescription) {
        payload.description = initialPatchDescription
      }

      await submitRecordPatch(current.id, payload, controller.signal)
      if (requestIdRef.current !== requestId || controller.signal.aborted)
        return

      setIsSaving(false)
      abortRef.current = null
      onClose()
      await onPatched(current.id)
    } catch (caught) {
      if (
        requestIdRef.current !== requestId ||
        controller.signal.aborted ||
        axios.isCancel(caught)
      ) {
        return
      }

      if (caught instanceof RecordPatchConflictError) {
        setError(`${t('edit.conflictError')} ${caught.message}`)
      } else {
        setError(
          caught instanceof Error ? caught.message : t('edit.errorGeneral')
        )
      }
      setIsSaving(false)
    } finally {
      if (requestIdRef.current === requestId) {
        abortRef.current = null
      }
    }
  }

  if (!open) return null

  const footer = (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Button type="button" variant="ghost" onClick={close} disabled={isSaving}>
        {t('edit.cancel')}
      </Button>
      <Button
        type="button"
        onClick={() => void submit()}
        disabled={isSaving}
        icon={<PencilSquareIcon className="h-4 w-4" />}
      >
        {isSaving ? t('edit.saving') : t('edit.saveButton')}
      </Button>
    </div>
  )

  return (
    <AnimatedDrawer
      open={open}
      onClose={close}
      title={t('edit.title')}
      subtitle={`${current.pid} / ${current.id}`}
      closeLabel={t('edit.close')}
      size="md"
      footer={footer}
    >
      <form
        className="grid gap-4"
        onPointerDown={handleFormPointerDown}
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        {error && (
          <section
            className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800"
            role="alert"
          >
            <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </section>
        )}

        <InitialPatchDescriptionNotice
          description={initialPatchDescription}
          label={t('edit.initialPatchDescriptionNotice')}
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <ReadOnlyMeta
            label={t('record.schema')}
            value={schemaLabel(current.schema, t)}
          />
          <EditableFieldFrame
            field="title"
            activeField={activeField}
            dirty={fieldDirty.title}
          >
            <TextInput
              label={t('edit.titleField')}
              value={form.title}
              onChange={(event) =>
                setForm((state) => ({ ...state, title: event.target.value }))
              }
              onFocus={() => setActiveField('title')}
              placeholder={t('edit.titlePlaceholder')}
              disabled={isSaving}
              required
            />
          </EditableFieldFrame>
        </div>

        <EditableFieldFrame
          field="summary"
          activeField={activeField}
          dirty={fieldDirty.summary}
        >
          <TextAreaField
            label={t('edit.summary')}
            value={form.summary}
            onChange={(value) =>
              setForm((state) => ({ ...state, summary: value }))
            }
            onFocus={() => setActiveField('summary')}
            placeholder={t('edit.summaryPlaceholder')}
            disabled={isSaving}
            rows={3}
          />
        </EditableFieldFrame>

        <EditableFieldFrame
          field="details"
          activeField={activeField}
          dirty={fieldDirty.details}
        >
          <TextAreaField
            label={t('edit.details')}
            value={form.details}
            onChange={(value) =>
              setForm((state) => ({ ...state, details: value }))
            }
            onFocus={() => setActiveField('details')}
            placeholder={t('edit.detailsPlaceholder')}
            disabled={isSaving}
            rows={5}
          />
        </EditableFieldFrame>

        <EditableFieldFrame
          field="assignee"
          activeField={activeField}
          dirty={fieldDirty.assignee}
        >
          <SearchSelect
            mode="option"
            label={t('edit.assignee')}
            value={form.assignee || null}
            onChange={(next) =>
              setForm((state) => ({ ...state, assignee: next ?? '' }))
            }
            options={profileOptions}
            placeholder={t('edit.assigneePlaceholder')}
            disabled={isSaving}
          />
        </EditableFieldFrame>

        <EditableFieldFrame
          field="statusTag"
          activeField={activeField}
          dirty={fieldDirty.statusTag}
        >
          <div className="grid gap-2">
            <label className="text-xs font-bold text-slate-500">
              {t('edit.statusTag')}
            </label>
            <div className="flex flex-wrap gap-1.5">
              {statusTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className={
                    form.statusTag === tag
                      ? 'inline-flex min-h-7 max-w-full items-center rounded-full border border-emerald-700 bg-emerald-100 px-2.5 text-xs font-medium text-emerald-800'
                      : 'inline-flex min-h-7 max-w-full items-center rounded-full bg-slate-100 px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-200'
                  }
                  onClick={() => setForm((c) => ({ ...c, statusTag: tag }))}
                  disabled={isSaving}
                >
                  {formatTagLabel(tag, lang)}
                </button>
              ))}
            </div>
          </div>
        </EditableFieldFrame>

        <EditableFieldFrame
          field="priorityTag"
          activeField={activeField}
          dirty={fieldDirty.priorityTag}
        >
          <div className="grid gap-2">
            <label className="text-xs font-bold text-slate-500">
              {t('edit.priorityTag')}
            </label>
            <div className="flex flex-wrap gap-1.5">
              {priorityTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className={
                    form.priorityTag === tag
                      ? 'inline-flex min-h-7 max-w-full items-center rounded-full border border-emerald-700 bg-emerald-100 px-2.5 text-xs font-medium text-emerald-800'
                      : 'inline-flex min-h-7 max-w-full items-center rounded-full bg-slate-100 px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-200'
                  }
                  onClick={() =>
                    setForm((c) => ({
                      ...c,
                      priorityTag: c.priorityTag === tag ? '' : tag,
                    }))
                  }
                  disabled={isSaving}
                >
                  {formatTagLabel(tag, lang)}
                </button>
              ))}
            </div>
          </div>
        </EditableFieldFrame>

        {otherTagOptions.length > 0 && (
          <EditableFieldFrame
            field="otherTags"
            activeField={activeField}
            dirty={fieldDirty.otherTags}
          >
            <SearchSelect
              mode="tag"
              label={t('edit.otherTags')}
              options={otherTagSelectOptions}
              values={form.otherTags}
              multiple
              onChangeMany={(nextTags) =>
                setForm((current) => ({
                  ...current,
                  otherTags: nextTags.filter((tag) =>
                    otherTagOptions.includes(tag as Tag)
                  ) as Tag[],
                }))
              }
              placeholder={t('searchSelect.searchPlaceholder')}
              selectedLabel={t('edit.otherTags')}
              disabled={isSaving}
            />
          </EditableFieldFrame>
        )}

        {form.unsupportedTags.length > 0 && (
          <div className="grid gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <label className="text-xs font-bold text-amber-800">
              {t('edit.unsupportedTags')}
            </label>
            <div className="flex flex-wrap gap-1.5">
              {form.unsupportedTags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex min-h-7 max-w-full items-center rounded-full border border-amber-300 bg-amber-100 px-2.5 font-mono text-xs text-amber-800"
                >
                  {tag}
                </span>
              ))}
            </div>
            <p className="text-xs text-amber-700">
              {t('edit.unsupportedHint')}
            </p>
          </div>
        )}

        <EditableFieldFrame
          field="assets"
          activeField={activeField}
          dirty={fieldDirty.assets}
        >
          <SearchSelect
            mode="option"
            label={t('edit.assetSelector')}
            options={selectableAssetOptions}
            values={form.assets}
            multiple
            onChangeMany={(assets) => setForm((state) => ({ ...state, assets }))}
            placeholder={t('searchSelect.searchPlaceholder')}
            selectedLabel={t('edit.assets')}
            emptyText={t('filters.noAssetOptions')}
            allowCustomValue={false}
            disabled={isSaving}
          />
        </EditableFieldFrame>

        <EditableFieldFrame
          field="relations"
          activeField={activeField}
          dirty={fieldDirty.relations}
        >
          <RelationEditor
            label={t('relations.title')}
            value={form.relations}
            targetOptions={selectableRelationTargetOptions}
            constraintOptions={relationConstraintOptions}
            currentRecordId={current.id}
            onChange={(relations) =>
              setForm((state) => ({ ...state, relations }))
            }
            disabled={isSaving}
          />
        </EditableFieldFrame>
      </form>
    </AnimatedDrawer>
  )
}

function initialFormState(
  record: RecordItem<RecordBody>,
  knownTags: Tag[],
  statusTags: Tag[]
): EditPatchFormState {
  const body = asEditableBody(record.body)
  const statusTag =
    record.tags.find((tag) => tag.startsWith('status:')) ?? statusTags[0] ?? ''
  const priorityTag =
    record.tags.find((tag) => tag.startsWith('priority:')) ?? ''
  const otherTags = record.tags.filter(
    (tag) => !tag.startsWith('status:') && !tag.startsWith('priority:')
  )
  const unsupportedTags = otherTags.filter((t) => !knownTags.includes(t))
  const supportedOtherTags = otherTags.filter(
    (t) => !unsupportedTags.includes(t)
  )

  return {
    title: body.title,
    summary: body.description,
    details: body.content,
    statusTag,
    priorityTag,
    otherTags: supportedOtherTags,
    unsupportedTags,
    assignee: record.assignee ?? '',
    assets: [...(record.assets ?? [])],
    relations: (record.relations ?? []).map((relation) => ({ ...relation })),
  }
}

function buildFieldDirtyState(
  form: EditPatchFormState,
  base: EditPatchFormState
): FieldDirtyState {
  return {
    title: form.title !== base.title,
    summary: form.summary !== base.summary,
    details: form.details !== base.details,
    assignee: form.assignee !== base.assignee,
    statusTag: form.statusTag !== base.statusTag,
    priorityTag: form.priorityTag !== base.priorityTag,
    otherTags: !sameStringList(form.otherTags, base.otherTags),
    assets: !sameStringList(form.assets, base.assets),
    relations: JSON.stringify(form.relations) !== JSON.stringify(base.relations),
  }
}

function EditableFieldFrame({
  field,
  activeField,
  dirty,
  children,
}: {
  field: EditableFieldId
  activeField: EditableFieldId | null
  dirty: boolean
  children: ReactNode
}) {
  const isActive = activeField === field
  return (
    <div
      data-edit-field={field}
      className={cn(
        'rounded-lg border p-2 transition',
        isActive
          ? 'border-emerald-600 bg-emerald-50/30 ring-2 ring-emerald-100'
          : dirty
            ? 'border-amber-400 bg-amber-50/30'
            : 'border-transparent bg-transparent'
      )}
    >
      {children}
    </div>
  )
}

function isEditableFieldId(value: string | undefined): value is EditableFieldId {
  return (
    value === 'title' ||
    value === 'summary' ||
    value === 'details' ||
    value === 'assignee' ||
    value === 'statusTag' ||
    value === 'priorityTag' ||
    value === 'otherTags' ||
    value === 'assets' ||
    value === 'relations'
  )
}

function sameStringList(left: readonly string[], right: readonly string[]) {
  if (left.length !== right.length) return false
  return left.every((value, index) => value === right[index])
}

function abortEdit(
  requestIdRef: MutableRefObject<number>,
  abortRef: MutableRefObject<AbortController | null>,
  setIsSaving?: (value: boolean) => void
) {
  requestIdRef.current += 1
  abortRef.current?.abort()
  abortRef.current = null
  setIsSaving?.(false)
}

function ReadOnlyMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid min-w-0 gap-0.5 rounded-md bg-slate-100 p-2.5">
      <dt className="text-xs font-bold uppercase text-slate-500">{label}</dt>
      <dd className="m-0 wrap-break-word text-slate-950">{value}</dd>
    </div>
  )
}

function InitialPatchDescriptionNotice({
  description,
  label,
}: {
  description?: string
  label: string
}) {
  if (!description) return null

  return (
    <section className="grid gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <p className="font-semibold">{label}</p>
      <p className="break-words font-mono text-xs leading-relaxed">
        {description}
      </p>
    </section>
  )
}

function TextAreaField({
  label,
  value,
  onChange,
  onFocus,
  placeholder,
  disabled,
  rows,
  hint,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  onFocus?: () => void
  placeholder?: string
  disabled?: boolean
  rows: number
  hint?: string
}) {
  const id = useId()

  return (
    <div className="grid gap-1.5">
      <label className="text-xs font-bold text-slate-500" htmlFor={id}>
        {label}
      </label>
      <textarea
        id={id}
        className="w-full resize-y rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={onFocus}
        placeholder={placeholder}
        disabled={disabled}
        rows={rows}
      />
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  )
}

function schemaLabel(schema: string, t: (key: string) => string): string {
  const map: Record<string, string> = {
    CardBody: 'create.schemaCard',
    AssetBody: 'create.schemaAsset',
    TransactionBody: 'create.schemaTransaction',
  }
  const key = map[schema]
  return key ? t(key) : schema
}
