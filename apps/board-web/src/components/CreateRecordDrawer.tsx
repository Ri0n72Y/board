import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { BoardConfig, Profile, SchemaName, Tag } from '@labour-board/shared'
import {
  ExclamationTriangleIcon,
  PlusIcon,
  XMarkIcon,
} from '@heroicons/react/20/solid'
import { useTranslation } from 'react-i18next'
import axios from 'axios'
import { createRecord, type CreateRecordPayload } from '../api/records'
import { cn } from '../lib/cn'
import { getProfileOptions } from '../utils/board'
import { TagChipRow } from './BoardFilters'
import { Button } from './ui/Button'
import { Select } from './ui/Select'
import { TextInput } from './ui/TextInput'

interface CreateRecordDrawerProps {
  open: boolean
  config: BoardConfig | null
  profiles: Profile[] | null
  knownTags: Tag[]
  statusTags: Tag[]
  priorityTags: Tag[]
  onClose: () => void
  onCreated: () => Promise<void> | void
}

interface FormState {
  schema: string
  title: string
  description: string
  content: string
  statusTag: string
  priorityTag: string
  assignee: string
  assetsText: string
}

const CARD_SCHEMA = 'CardBody'

export function CreateRecordDrawer({
  open,
  config,
  profiles,
  knownTags,
  statusTags,
  priorityTags,
  onClose,
  onCreated,
}: CreateRecordDrawerProps) {
  const { t } = useTranslation()
  const assigneeListId = useId()
  const [form, setForm] = useState<FormState>(() =>
    initialFormState(config, knownTags, statusTags),
  )
  const [error, setError] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const createRequestIdRef = useRef(0)
  const createAbortRef = useRef<AbortController | null>(null)

  const schemaOptions = useMemo(() => getSchemaOptions(config), [config])
  const profileOptions = useMemo(() => getProfileOptions(profiles), [profiles])

  useEffect(() => {
    return () => abortCreate(createRequestIdRef, createAbortRef)
  }, [])

  const close = useCallback(() => {
    abortCreate(createRequestIdRef, createAbortRef, setIsCreating)
    onClose()
  }, [onClose])

  async function submit() {
    const validation = buildPayload(form)
    if (!validation.ok) {
      setError(validation.error)
      return
    }

    const requestId = createRequestIdRef.current + 1
    createRequestIdRef.current = requestId
    createAbortRef.current?.abort()

    const controller = new AbortController()
    createAbortRef.current = controller
    setIsCreating(true)
    setError(null)

    try {
      await createRecord(validation.payload, controller.signal)
      if (createRequestIdRef.current !== requestId || controller.signal.aborted) return

      setIsCreating(false)
      createAbortRef.current = null
      onClose()
      await onCreated()
    } catch (caught) {
      if (
        createRequestIdRef.current !== requestId ||
        controller.signal.aborted ||
        axios.isCancel(caught)
      ) {
        return
      }
      setError(caught instanceof Error ? caught.message : t('create.errorGeneral'))
      setIsCreating(false)
    } finally {
      if (createRequestIdRef.current === requestId) {
        createAbortRef.current = null
      }
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/30"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close()
      }}
    >
      <aside
        aria-labelledby="create-record-title"
        aria-modal="true"
        className="ml-auto grid h-full w-full max-w-2xl grid-rows-[auto_1fr_auto] overflow-hidden border-l border-slate-200 bg-stone-50 text-slate-950 shadow-xl"
        role="dialog"
      >
        <header className="flex min-w-0 items-start justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4">
          <div className="min-w-0">
            <p className="mb-1 text-xs font-bold uppercase text-slate-500">
              {t('create.subtitle')}
            </p>
            <h2 className="text-xl font-semibold leading-tight" id="create-record-title">
              {t('create.title')}
            </h2>
          </div>
          <Button
            type="button"
            variant="ghost"
            onClick={close}
            title={t('create.closeTitle')}
            icon={<XMarkIcon className="h-4 w-4" />}
          >
            {t('create.close')}
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
              <Select
                label={t('create.schema')}
                value={form.schema}
                onChange={(event) =>
                  setForm((current) => ({ ...current, schema: event.target.value }))
                }
                options={schemaOptions}
                disabled={isCreating}
              />
              <TextInput
                label={t('create.titleField')}
                value={form.title}
                onChange={(event) =>
                  setForm((current) => ({ ...current, title: event.target.value }))
                }
                placeholder={t('create.titlePlaceholder')}
                disabled={isCreating}
                required
              />
            </div>

            <TextAreaField
              label={t('create.description')}
              value={form.description}
              onChange={(value) =>
                setForm((current) => ({ ...current, description: value }))
              }
              placeholder={t('create.descriptionPlaceholder')}
              disabled={isCreating}
              rows={3}
            />

            <TextAreaField
              label={t('create.content')}
              value={form.content}
              onChange={(value) =>
                setForm((current) => ({ ...current, content: value }))
              }
              placeholder={t('create.contentPlaceholder')}
              disabled={isCreating}
              rows={5}
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <TagInput
                label={t('create.statusTag')}
                value={form.statusTag}
                tags={statusTags}
                fallbackTags={knownTags.filter((tag) => tag.startsWith('status:'))}
                onChange={(value) =>
                  setForm((current) => ({ ...current, statusTag: value }))
                }
                disabled={isCreating}
                placeholder={t('create.statusTagPlaceholder')}
              />
              <TagInput
                label={t('create.priorityTag')}
                value={form.priorityTag}
                tags={priorityTags}
                fallbackTags={knownTags.filter((tag) => tag.startsWith('priority:'))}
                onChange={(value) =>
                  setForm((current) => ({ ...current, priorityTag: value }))
                }
                disabled={isCreating}
                placeholder={t('create.priorityTagPlaceholder')}
                optional
              />
            </div>

            <div className="grid gap-1.5">
              <label className="text-xs font-bold text-slate-500" htmlFor={assigneeListId}>
                {t('create.assignee')}
              </label>
              <input
                id={assigneeListId}
                className={cn(
                  'min-h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-normal text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100',
                )}
                value={form.assignee}
                onChange={(event) =>
                  setForm((current) => ({ ...current, assignee: event.target.value }))
                }
                placeholder="public key"
                list={`${assigneeListId}-list`}
                disabled={isCreating}
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
              label={t('create.assets')}
              value={form.assetsText}
              onChange={(value) =>
                setForm((current) => ({ ...current, assetsText: value }))
              }
              placeholder={t('create.assetsPlaceholder')}
              disabled={isCreating}
              rows={4}
              hint={t('create.assetsHint')}
            />
          </form>
        </div>

        <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 bg-white px-5 py-4">
          <Button type="button" variant="ghost" onClick={close} disabled={isCreating}>
            {t('create.cancel')}
          </Button>
          <Button
            type="button"
            onClick={() => void submit()}
            disabled={isCreating}
            icon={<PlusIcon className="h-4 w-4" />}
          >
            {isCreating ? t('create.creating') : t('create.createButton')}
          </Button>
        </footer>
      </aside>
    </div>
  )
}

function initialFormState(
  config: BoardConfig | null,
  knownTags: Tag[],
  statusTags: Tag[],
): FormState {
  return {
    schema: getDefaultSchema(config),
    title: '',
    description: '',
    content: '',
    statusTag: getDefaultStatusTag(statusTags, knownTags),
    priorityTag: '',
    assignee: '',
    assetsText: '',
  }
}

function getSchemaOptions(config: BoardConfig | null): { value: string; label: string }[] {
  const schemas = config?.records.schemas?.length ? config.records.schemas : [CARD_SCHEMA]
  return schemas.map((schema) => ({ value: schema, label: schema }))
}

function getDefaultSchema(config: BoardConfig | null): string {
  const schemas = config?.records.schemas
  if (!schemas || schemas.length === 0) return CARD_SCHEMA
  if (schemas.includes(CARD_SCHEMA as SchemaName)) return CARD_SCHEMA
  return schemas[0]
}

function getDefaultStatusTag(statusTags: Tag[], knownTags: Tag[]): string {
  if (statusTags.includes('status:todo' as Tag) || knownTags.includes('status:todo' as Tag)) {
    return 'status:todo'
  }
  return ''
}

function buildPayload(
  form: FormState,
): { ok: true; payload: CreateRecordPayload } | { ok: false; error: string } {
  const schema = form.schema.trim()
  const title = form.title.trim()
  const statusTag = form.statusTag.trim() as Tag
  const priorityTag = form.priorityTag.trim() as Tag
  const assignee = form.assignee.trim()
  const description = form.description.trim()
  const content = form.content.trim()
  const tags = uniqueValues([statusTag, priorityTag].filter(Boolean) as Tag[])
  const assets = uniqueValues(
    form.assetsText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean),
  )

  if (!schema) return { ok: false, error: 'Schema is required.' }
  if (!title) return { ok: false, error: 'Title is required.' }
  if (!statusTag) return { ok: false, error: 'Status tag is required.' }

  return {
    ok: true,
    payload: {
      schema,
      tags,
      assignee: assignee || undefined,
      body: {
        title,
        ...(description ? { description } : {}),
        ...(content ? { content } : {}),
      },
      assets,
      relations: [],
    },
  }
}

function uniqueValues<T extends string>(values: T[]): T[] {
  return [...new Set(values)]
}

function abortCreate(
  requestIdRef: React.MutableRefObject<number>,
  abortRef: React.MutableRefObject<AbortController | null>,
  setIsCreating?: (value: boolean) => void,
) {
  requestIdRef.current += 1
  abortRef.current?.abort()
  abortRef.current = null
  setIsCreating?.(false)
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
