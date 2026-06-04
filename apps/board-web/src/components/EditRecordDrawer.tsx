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
} from '@labour-board/shared'
import {
  ExclamationTriangleIcon,
  PencilSquareIcon,
  XMarkIcon,
} from '@heroicons/react/20/solid'
import axios from 'axios'
import { submitRecordPatch, RecordPatchConflictError } from '../api/patches'
import type { SubmitRecordPatchPayload } from '../api/patches'
import { fetchSnapshotHead } from '../api/snapshotHead'
import { cn } from '../lib/cn'
import { getProfileOptions } from '../utils/board'
import { TagChipRow } from './BoardFilters'
import { Button } from './ui/Button'
import { TextInput } from './ui/TextInput'

interface EditRecordDrawerProps {
  open: boolean
  record: RecordResponse<RecordItem<RecordBody>>
  profiles: Profile[] | null
  knownTags: Tag[]
  statusTags: Tag[]
  priorityTags: Tag[]
  onClose: () => void
  onPatched: (recordId: string) => Promise<void> | void
}

interface FormState {
  title: string
  description: string
  content: string
  statusTag: string
  priorityTag: string
  otherTagsText: string
  assignee: string
  assetsText: string
}

interface PatchDraft {
  tags: Tag[]
  assignee: PublicKey | null
  assets: AssetRef[]
  body: {
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
  statusTags,
  priorityTags,
  onClose,
  onPatched,
}: EditRecordDrawerProps) {
  const assigneeListId = useId()
  const current = record.body
  const [form, setForm] = useState<FormState>(() =>
    initialFormState(current, knownTags, statusTags),
  )
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const requestIdRef = useRef(0)
  const abortRef = useRef<AbortController | null>(null)

  const profileOptions = useMemo(() => getProfileOptions(profiles), [profiles])

  useEffect(() => {
    return () => abortEdit(requestIdRef, abortRef)
  }, [])

  const close = useCallback(() => {
    abortEdit(requestIdRef, abortRef, setIsSaving)
    onClose()
  }, [onClose])

  async function submit() {
    const validation = buildPatchDraft(form)
    if (!validation.ok) {
      setError(validation.error)
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
      const head = await fetchSnapshotHead(controller.signal)
      if (requestIdRef.current !== requestId || controller.signal.aborted) return

      const parentId = head.records[current.id]?.lastPatchId ?? null
      const payload: SubmitRecordPatchPayload = {
        parentId,
        snapshotVersion: head.version,
        tags: validation.patch.tags,
        assignee: validation.patch.assignee,
        assets: validation.patch.assets,
        body: validation.patch.body,
      }

      await submitRecordPatch(current.id, payload, controller.signal)
      if (requestIdRef.current !== requestId || controller.signal.aborted) return

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
        setError(
          `Record changed on the server. Refresh and try again. ${caught.message}`,
        )
      } else {
        setError(caught instanceof Error ? caught.message : 'Save patch failed')
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
      className="fixed inset-0 z-[60] bg-slate-950/30"
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
              {current.pid} / {current.id}
            </p>
            <h2 className="text-xl font-semibold leading-tight" id="edit-record-title">
              Edit Record
            </h2>
          </div>
          <Button
            type="button"
            variant="ghost"
            onClick={close}
            title="Close edit record"
            icon={<XMarkIcon className="h-4 w-4" />}
          >
            Close
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
              <ReadOnlyMeta label="Schema" value={current.schema} />
              <TextInput
                label="Title"
                value={form.title}
                onChange={(event) =>
                  setForm((state) => ({ ...state, title: event.target.value }))
                }
                placeholder="Record title"
                disabled={isSaving}
                required
              />
            </div>

            <TextAreaField
              label="Description"
              value={form.description}
              onChange={(value) =>
                setForm((state) => ({ ...state, description: value }))
              }
              placeholder="Short description"
              disabled={isSaving}
              rows={3}
            />

            <TextAreaField
              label="Content"
              value={form.content}
              onChange={(value) =>
                setForm((state) => ({ ...state, content: value }))
              }
              placeholder="Record content"
              disabled={isSaving}
              rows={5}
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <TagInput
                label="Status tag"
                value={form.statusTag}
                tags={statusTags}
                fallbackTags={knownTags.filter((tag) => tag.startsWith('status:'))}
                onChange={(value) =>
                  setForm((state) => ({ ...state, statusTag: value }))
                }
                disabled={isSaving}
                placeholder="status:todo"
              />
              <TagInput
                label="Priority tag"
                value={form.priorityTag}
                tags={priorityTags}
                fallbackTags={knownTags.filter((tag) => tag.startsWith('priority:'))}
                onChange={(value) =>
                  setForm((state) => ({ ...state, priorityTag: value }))
                }
                disabled={isSaving}
                placeholder="priority:medium"
                optional
              />
            </div>

            <TextAreaField
              label="Other tags"
              value={form.otherTagsText}
              onChange={(value) =>
                setForm((state) => ({ ...state, otherTagsText: value }))
              }
              placeholder={'custom:tag\narea:ui'}
              disabled={isSaving}
              rows={4}
              hint="One tag per line. Status and priority tags are managed above."
            />

            <div className="grid gap-1.5">
              <label className="text-xs font-bold text-slate-500" htmlFor={assigneeListId}>
                Assignee
              </label>
              <input
                id={assigneeListId}
                className={cn(
                  'min-h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-normal text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100',
                )}
                value={form.assignee}
                onChange={(event) =>
                  setForm((state) => ({ ...state, assignee: event.target.value }))
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
              label="Assets"
              value={form.assetsText}
              onChange={(value) =>
                setForm((state) => ({ ...state, assetsText: value }))
              }
              placeholder={'asset-record-id-1\nasset-record-id-2'}
              disabled={isSaving}
              rows={4}
              hint="One asset id per line. Saving replaces the record assets list."
            />

            <ReadOnlyRelations relations={current.relations ?? []} />
          </form>
        </div>

        <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 bg-white px-5 py-4">
          <Button type="button" variant="ghost" onClick={close} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void submit()}
            disabled={isSaving}
            icon={<PencilSquareIcon className="h-4 w-4" />}
          >
            {isSaving ? 'Saving...' : 'Save patch'}
          </Button>
        </footer>
      </aside>
    </div>
  )
}

function initialFormState(
  record: RecordItem<RecordBody>,
  knownTags: Tag[],
  statusTags: Tag[],
): FormState {
  const body = asEditableBody(record.body)
  const statusTag =
    record.tags.find((tag) => tag.startsWith('status:')) ??
    getDefaultStatusTag(statusTags, knownTags)
  const priorityTag =
    record.tags.find((tag) => tag.startsWith('priority:')) ?? ''
  const otherTags = record.tags.filter(
    (tag) => !tag.startsWith('status:') && !tag.startsWith('priority:'),
  )

  return {
    title: body.title,
    description: body.description,
    content: body.content,
    statusTag,
    priorityTag,
    otherTagsText: otherTags.join('\n'),
    assignee: record.assignee ?? '',
    assetsText: (record.assets ?? []).join('\n'),
  }
}

function buildPatchDraft(
  form: FormState,
): { ok: true; patch: PatchDraft } | { ok: false; error: string } {
  const title = form.title.trim()
  const statusTag = form.statusTag.trim() as Tag
  const priorityTag = form.priorityTag.trim() as Tag
  const otherTags = lines(form.otherTagsText).filter(
    (tag) => !tag.startsWith('status:') && !tag.startsWith('priority:'),
  ) as Tag[]
  const tags = uniqueValues(
    [statusTag, priorityTag, ...otherTags].filter(Boolean) as Tag[],
  )
  const assets = uniqueValues(lines(form.assetsText)) as AssetRef[]
  const assignee = form.assignee.trim()

  if (!title) return { ok: false, error: 'Title is required.' }
  if (!statusTag) return { ok: false, error: 'Status tag is required.' }

  return {
    ok: true,
    patch: {
      tags,
      assignee: assignee ? (assignee as PublicKey) : null,
      assets,
      body: {
        title,
        description: nullableTrimmed(form.description),
        content: nullableTrimmed(form.content),
      },
    },
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

function getDefaultStatusTag(statusTags: Tag[], knownTags: Tag[]): string {
  if (statusTags.includes('status:todo' as Tag) || knownTags.includes('status:todo' as Tag)) {
    return 'status:todo'
  }
  return ''
}

function abortEdit(
  requestIdRef: MutableRefObject<number>,
  abortRef: MutableRefObject<AbortController | null>,
  setIsSaving?: (value: boolean) => void,
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

function TagInput({
  label,
  value,
  tags,
  fallbackTags,
  onChange,
  disabled,
  placeholder,
  optional = false,
}: {
  label: string
  value: string
  tags: Tag[]
  fallbackTags: Tag[]
  onChange: (value: string) => void
  disabled?: boolean
  placeholder: string
  optional?: boolean
}) {
  const listId = useId()
  const options = tags.length > 0 ? tags : fallbackTags

  return (
    <div className="grid gap-2">
      <TextInput
        label={optional ? `${label} (optional)` : label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        list={`${listId}-list`}
        disabled={disabled}
      />
      {options.length > 0 && (
        <>
          <datalist id={`${listId}-list`}>
            {options.map((tag) => (
              <option key={tag} value={tag} />
            ))}
          </datalist>
          <TagChipRow tags={options} onTagClick={onChange} />
        </>
      )}
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
  return (
    <section className="grid gap-2 rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-500">Relations</h3>
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
        <p className="text-slate-500">None</p>
      )}
    </section>
  )
}
