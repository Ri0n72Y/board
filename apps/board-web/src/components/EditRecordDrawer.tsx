import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from 'react'
import type {
  AssetRef,
  Profile,
  PublicKey,
  RecordBody,
  RecordItem,
  RecordResponse,
  Tag,
  TagChanges,
} from '@labour-board/shared'
import {
  ExclamationTriangleIcon,
  PencilSquareIcon,
  XMarkIcon,
} from '@heroicons/react/20/solid'
import { useTranslation } from 'react-i18next'
import axios from 'axios'
import { submitRecordPatch, RecordPatchConflictError } from '../api/patches'
import type { SubmitRecordPatchPayload } from '../api/patches'
import { fetchRecordHead } from '../api/recordHead'
import { cn } from '../lib/cn'
import { getProfileOptions } from '../utils/board'
import { buildTagChanges } from '../utils/tagChanges'
import { formatTagLabel } from '../utils/tagDisplay'
import { Button } from './ui/Button'
import { TextInput } from './ui/TextInput'

interface EditRecordDrawerProps {
  open: boolean
  record: RecordResponse<RecordItem<RecordBody>>
  profiles: Profile[] | null
  knownTags: Tag[]
  configOtherTags?: Tag[]
  statusTags: Tag[]
  priorityTags: Tag[]
  onClose: () => void
  onPatched: (recordId: string) => Promise<void> | void
}

interface FormState {
  title: string
  summary: string
  details: string
  statusTag: string
  priorityTag: string
  otherTags: Tag[]
  unsupportedTags: Tag[]
  assignee: string
  assetsText: string
}

interface PatchDraft {
  tagChanges?: TagChanges
  assignee?: PublicKey | null
  assets?: AssetRef[]
  body?: {
    title: string
    description: string | null
    content: string | null
  }
}

export function EditRecordDrawer({
  open,
  record,
  profiles,
  knownTags,
  configOtherTags,
  statusTags,
  priorityTags,
  onClose,
  onPatched,
}: EditRecordDrawerProps) {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage
  const assigneeListId = useId()
  const current = record.body
  const [form, setForm] = useState<FormState>(() =>
    initialFormState(current, knownTags, statusTags)
  )
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
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

  function toggleOtherTag(tag: Tag) {
    setForm((current) => {
      const exists = current.otherTags.includes(tag)
      return {
        ...current,
        otherTags: exists
          ? current.otherTags.filter((t) => t !== tag)
          : [...current.otherTags, tag],
      }
    })
  }

  useEffect(() => {
    return () => abortEdit(requestIdRef, abortRef)
  }, [])

  const close = useCallback(() => {
    abortEdit(requestIdRef, abortRef, setIsSaving)
    onClose()
  }, [onClose])

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
      const head = await fetchRecordHead(current.id, controller.signal)
      if (requestIdRef.current !== requestId || controller.signal.aborted)
        return

      if (!head.exists) {
        setError(t('edit.headMissing'))
        setIsSaving(false)
        return
      }

      const parentId = head.lastPatchId
      const payload: SubmitRecordPatchPayload = {
        parentId,
        currentVersion: head.currentVersion,
        ...validation.patch,
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

  return (
    <div
      className="fixed inset-0 z-60 bg-slate-950/30"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close()
      }}
    >
      <aside
        aria-labelledby="edit-record-title"
        aria-modal="true"
        className="ml-auto grid h-full w-full max-w-2xl grid-rows-[auto_1fr_auto] overflow-hidden border-l border-slate-200 bg-stone-50 text-slate-950 shadow-xl"
        role="dialog"
      >
        <header className="flex min-w-0 items-start justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4">
          <div className="min-w-0">
            <p className="mb-1 break-all font-mono text-xs text-slate-500">
              {t('edit.subtitle', { pid: current.pid, id: current.id })}
            </p>
            <h2
              className="text-xl font-semibold leading-tight"
              id="edit-record-title"
            >
              {t('edit.title')}
            </h2>
          </div>
          <Button
            type="button"
            variant="ghost"
            onClick={close}
            title={t('edit.closeTitle')}
            icon={<XMarkIcon className="h-4 w-4" />}
          >
            {t('edit.close')}
          </Button>
        </header>

        <div className="min-h-0 overflow-y-auto px-5 py-4">
          <form
            className="grid gap-4"
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

            <div className="grid gap-3 sm:grid-cols-2">
              <ReadOnlyMeta
                label={t('record.schema')}
                value={schemaLabel(current.schema, t)}
              />
              <TextInput
                label={t('edit.titleField')}
                value={form.title}
                onChange={(event) =>
                  setForm((state) => ({ ...state, title: event.target.value }))
                }
                placeholder={t('edit.titlePlaceholder')}
                disabled={isSaving}
                required
              />
            </div>

            <TextAreaField
              label={t('edit.summary')}
              value={form.summary}
              onChange={(value) =>
                setForm((state) => ({ ...state, summary: value }))
              }
              placeholder={t('edit.summaryPlaceholder')}
              disabled={isSaving}
              rows={3}
            />

            <TextAreaField
              label={t('edit.details')}
              value={form.details}
              onChange={(value) =>
                setForm((state) => ({ ...state, details: value }))
              }
              placeholder={t('edit.detailsPlaceholder')}
              disabled={isSaving}
              rows={5}
            />

            {/* Status select-only chip grid */}
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

            {/* Priority select-only chip grid */}
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

            {/* Other tags */}
            {otherTagOptions.length > 0 && (
              <div className="grid gap-2">
                <label className="text-xs font-bold text-slate-500">
                  {t('edit.otherTags')}
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {otherTagOptions.map((tag) => {
                    const isActive = form.otherTags.includes(tag)
                    return (
                      <button
                        key={tag}
                        type="button"
                        className={
                          isActive
                            ? 'inline-flex min-h-7 max-w-full items-center rounded-full border border-emerald-700 bg-emerald-100 px-2.5 text-xs font-medium text-emerald-800'
                            : 'inline-flex min-h-7 max-w-full items-center rounded-full bg-slate-100 px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-200'
                        }
                        onClick={() => toggleOtherTag(tag)}
                        disabled={isSaving}
                      >
                        {formatTagLabel(tag, lang)}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Unsupported existing tags (read-only) */}
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

            <div className="grid gap-1.5">
              <label
                className="text-xs font-bold text-slate-500"
                htmlFor={assigneeListId}
              >
                {t('edit.assignee')}
              </label>
              <input
                id={assigneeListId}
                className={cn(
                  'min-h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-normal text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100'
                )}
                value={form.assignee}
                onChange={(event) =>
                  setForm((state) => ({
                    ...state,
                    assignee: event.target.value,
                  }))
                }
                placeholder="public key"
                list={`${assigneeListId}-list`}
                disabled={isSaving}
              />
              {profileOptions.length > 0 && (
                <datalist id={`${assigneeListId}-list`}>
                  {profileOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </datalist>
              )}
            </div>

            <TextAreaField
              label={t('edit.assets')}
              value={form.assetsText}
              onChange={(value) =>
                setForm((state) => ({ ...state, assetsText: value }))
              }
              placeholder={t('edit.assetsPlaceholder')}
              disabled={isSaving}
              rows={4}
              hint={t('edit.assetsHint')}
            />

            <ReadOnlyRelations relations={current.relations ?? []} />
          </form>
        </div>

        <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 bg-white px-5 py-4">
          <Button
            type="button"
            variant="ghost"
            onClick={close}
            disabled={isSaving}
          >
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
        </footer>
      </aside>
    </div>
  )
}

function initialFormState(
  record: RecordItem<RecordBody>,
  knownTags: Tag[],
  statusTags: Tag[]
): FormState {
  const body = asEditableBody(record.body)
  const statusTag =
    record.tags.find((tag) => tag.startsWith('status:')) ?? statusTags[0] ?? ''
  const priorityTag =
    record.tags.find((tag) => tag.startsWith('priority:')) ?? ''
  const otherTags = record.tags.filter(
    (tag) => !tag.startsWith('status:') && !tag.startsWith('priority:')
  )
  // Detect unsupported tags: tags in record that are not in knownTags
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
    assetsText: (record.assets ?? []).join('\n'),
  }
}

function buildPatchDraft(
  form: FormState,
  current: RecordItem<RecordBody>
): { ok: true; patch: PatchDraft } | { ok: false; error: string } {
  const title = form.title.trim()
  const statusTag = form.statusTag.trim() as Tag
  const priorityTag = form.priorityTag.trim() as Tag
  const tags = uniqueValues(
    [statusTag, priorityTag, ...form.otherTags, ...form.unsupportedTags].filter(
      Boolean
    ) as Tag[]
  )
  const assets = uniqueValues(lines(form.assetsText)) as AssetRef[]
  const assignee = form.assignee.trim()

  if (!title) return { ok: false, error: 'edit.errorTitleRequired' }
  if (!statusTag) return { ok: false, error: 'edit.errorStatusTagRequired' }

  const patch: PatchDraft = {}
  const tagChanges = buildTagChanges(current.tags, tags)
  if (tagChanges) patch.tagChanges = tagChanges

  const currentAssignee = current.assignee ?? null
  const nextAssignee = assignee ? (assignee as PublicKey) : null
  if (nextAssignee !== currentAssignee) {
    patch.assignee = nextAssignee
  }

  if (!sameStringList(assets, current.assets ?? [])) {
    patch.assets = assets
  }

  const currentBody = asEditableBody(current.body)
  const nextBody = {
    title,
    description: nullableTrimmed(form.summary),
    content: nullableTrimmed(form.details),
  }
  const currentComparableBody = {
    title: currentBody.title,
    description: nullableTrimmed(currentBody.description),
    content: nullableTrimmed(currentBody.content),
  }
  if (!sameRecordBodyPatch(nextBody, currentComparableBody)) {
    patch.body = nextBody
  }

  if (Object.keys(patch).length === 0) {
    return { ok: false, error: 'edit.errorNoChanges' }
  }

  return {
    ok: true,
    patch,
  }
}

function asEditableBody(body: RecordBody): {
  title: string
  description: string
  content: string
} {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { title: '', description: '', content: '' }
  }
  return {
    title: stringValue(body, 'title'),
    description: stringValue(body, 'description'),
    content: stringValue(body, 'content'),
  }
}

function stringValue(source: object, key: string): string {
  const value = (source as Record<string, unknown>)[key]
  return typeof value === 'string' ? value : ''
}

function nullableTrimmed(value: string): string | null {
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function lines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
}

function uniqueValues<T extends string>(values: T[]): T[] {
  return [...new Set(values)]
}

function sameStringList(left: readonly string[], right: readonly string[]) {
  if (left.length !== right.length) return false
  return left.every((value, index) => value === right[index])
}

function sameRecordBodyPatch(
  left: NonNullable<PatchDraft['body']>,
  right: NonNullable<PatchDraft['body']>
) {
  return (
    left.title === right.title &&
    left.description === right.description &&
    left.content === right.content
  )
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

function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
  disabled,
  rows,
  hint,
}: {
  label: string
  value: string
  onChange: (value: string) => void
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
        placeholder={placeholder}
        disabled={disabled}
        rows={rows}
      />
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  )
}

function ReadOnlyRelations({
  relations,
}: {
  relations: RecordItem<RecordBody>['relations']
}) {
  const { t } = useTranslation()

  return (
    <section className="grid gap-2 rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-500">
        {t('record.relations')}
      </h3>
      {relations && relations.length > 0 ? (
        <ul className="grid gap-1.5">
          {relations.map((relation) => (
            <li
              className="flex min-w-0 flex-wrap gap-2 break-all font-mono text-xs"
              key={`${relation.constraint}:${relation.target}`}
            >
              <strong>{relation.constraint}</strong>
              <span>{relation.target}</span>
              {relation.description && (
                <em className="font-sans text-slate-500">
                  {relation.description}
                </em>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-slate-500">{t('record.none')}</p>
      )}
    </section>
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
