import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { BoardConfig, Profile, RelationRef, Tag } from '@labour-board/shared'
import {
  ExclamationTriangleIcon,
  PlusIcon,
  XMarkIcon,
} from '@heroicons/react/20/solid'
import { useTranslation } from 'react-i18next'
import axios from 'axios'
import { createRecord, type CreateRecordPayload } from '../api/records'
import { getProfileOptions } from '../utils/board'
import type { RelationConstraintOption } from '../utils/relationDisplay'
import { normalizeRelationDrafts } from '../utils/relationDisplay'
import type { RecordReferenceOption } from '../utils/recordReferenceOptions'
import { formatTagLabel } from '../utils/tagDisplay'
import { RelationEditor } from './RelationEditor'
import { Button } from './ui/Button'
import { Select } from './ui/Select'
import { SearchSelect } from './ui/SearchSelect'
import { TextInput } from './ui/TextInput'

interface CreateRecordDrawerProps {
  open: boolean
  config: BoardConfig | null
  /** Profile list for assignee selector. */
  profiles?: unknown[] | null
  knownTags: Tag[]
  statusTags: Tag[]
  priorityTags: Tag[]
  assetOptions: RecordReferenceOption[]
  relationTargetOptions: RecordReferenceOption[]
  relationConstraintOptions: RelationConstraintOption[]
  onClose: () => void
  onCreated: () => Promise<void> | void
}

interface FormState {
  schema: string
  title: string
  summary: string
  details: string
  statusTag: string
  priorityTag: string
  otherTags: Tag[]
  assignee: string
  assets: string[]
  relations: RelationRef[]
}

const CARD_SCHEMA = 'CardBody'

export function CreateRecordDrawer({
  open,
  config,
  profiles,
  knownTags,
  statusTags,
  priorityTags,
  assetOptions,
  relationTargetOptions,
  relationConstraintOptions,
  onClose,
  onCreated,
}: CreateRecordDrawerProps) {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage
  const [form, setForm] = useState<FormState>(() =>
    initialFormState(config, statusTags, priorityTags),
  )
  const [error, setError] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const createRequestIdRef = useRef(0)
  const createAbortRef = useRef<AbortController | null>(null)

  const schemaOptions = useMemo(() => {
    function label(schema: string): string {
      const key = SCHEMA_KEYS[schema] ?? schema
      return t(key)
    }
    const SCHEMA_KEYS: Record<string, string> = {
      CardBody: 'create.schemaCard',
      AssetBody: 'create.schemaAsset',
      TransactionBody: 'create.schemaTransaction',
    }
    const schemas = config?.records.schemas?.length ? config.records.schemas : [CARD_SCHEMA]
    return schemas.map((s) => ({ value: s as string, label: label(s) }))
  }, [config, t])
  const profileOptions = useMemo(() => getProfileOptions(profiles as Profile[] | null), [profiles])

  // Non-status/non-priority known tags for "other tags" section
  const otherTagOptions = useMemo(
    () =>
      knownTags.filter(
        (tag) => !tag.startsWith('status:') && !tag.startsWith('priority:'),
      ),
    [knownTags],
  )
  const otherTagSelectOptions = useMemo(
    () =>
      otherTagOptions.map((tag) => ({
        value: tag,
        label: formatTagLabel(tag, lang),
        meta: tag,
      })),
    [otherTagOptions, lang],
  )

  useEffect(() => {
    return () => abortCreate(createRequestIdRef, createAbortRef)
  }, [])

  // Derive effective status/priority: use form choice, fallback to config default
  const effectiveStatusTag = form.statusTag || statusTags[0] || ''
  const effectivePriorityTag = form.priorityTag || priorityTags[0] || ''

  const close = useCallback(() => {
    abortCreate(createRequestIdRef, createAbortRef, setIsCreating)
    onClose()
  }, [onClose])

  async function submit() {
    const validation = buildPayload(form, effectiveStatusTag, effectivePriorityTag)
    if (!validation.ok) {
      setError(t(validation.error))
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
      if (createRequestIdRef.current !== requestId || controller.signal.aborted || axios.isCancel(caught)) return
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
              label={t('create.summary')}
              value={form.summary}
              onChange={(value) =>
                setForm((current) => ({ ...current, summary: value }))
              }
              placeholder={t('create.summaryPlaceholder')}
              disabled={isCreating}
              rows={3}
            />

            <TextAreaField
              label={t('create.details')}
              value={form.details}
              onChange={(value) =>
                setForm((current) => ({ ...current, details: value }))
              }
              placeholder={t('create.detailsPlaceholder')}
              disabled={isCreating}
              rows={5}
            />

            {/* Status select-only chip grid */}
            <div className="grid gap-2">
              <label className="text-xs font-bold text-slate-500">
                {t('create.statusTag')}
              </label>
              <div className="flex flex-wrap gap-1.5">
                {statusTags.length > 0 ? (
                  statusTags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      className={
                        effectiveStatusTag === tag
                          ? 'inline-flex min-h-[28px] max-w-full items-center rounded-full border border-emerald-700 bg-emerald-100 px-2.5 text-xs font-medium text-emerald-800'
                          : 'inline-flex min-h-[28px] max-w-full items-center rounded-full bg-slate-100 px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-200'
                      }
                      onClick={() => setForm((c) => ({ ...c, statusTag: tag }))}
                      disabled={isCreating}
                    >
                      {formatTagLabel(tag, lang)}
                    </button>
                  ))
                ) : (
                  <p className="text-xs text-slate-400">{t('create.noConfigTags')}</p>
                )}
              </div>
            </div>

            {/* Priority select-only chip grid */}
            <div className="grid gap-2">
              <label className="text-xs font-bold text-slate-500">
                {t('create.priorityTag')}
              </label>
              <div className="flex flex-wrap gap-1.5">
                {priorityTags.length > 0 ? (
                  priorityTags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      className={
                        effectivePriorityTag === tag
                          ? 'inline-flex min-h-[28px] max-w-full items-center rounded-full border border-emerald-700 bg-emerald-100 px-2.5 text-xs font-medium text-emerald-800'
                          : 'inline-flex min-h-[28px] max-w-full items-center rounded-full bg-slate-100 px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-200'
                      }
                      onClick={() =>
                        setForm((c) => ({
                          ...c,
                          priorityTag: c.priorityTag === tag ? '' : tag,
                        }))
                      }
                      disabled={isCreating}
                    >
                      {formatTagLabel(tag, lang)}
                    </button>
                  ))
                ) : (
                  <p className="text-xs text-slate-400">{t('create.noConfigTags')}</p>
                )}
              </div>
            </div>

            {/* Other tags */}
            {otherTagOptions.length > 0 && (
              <SearchSelect
                mode="tag"
                label={t('create.otherTags')}
                options={otherTagSelectOptions}
                values={form.otherTags}
                multiple
                onChangeMany={(nextTags) =>
                  setForm((current) => ({
                    ...current,
                    otherTags: nextTags.filter((tag) =>
                      otherTagOptions.includes(tag as Tag),
                    ) as Tag[],
                  }))
                }
                placeholder={t('searchSelect.searchPlaceholder')}
                selectedLabel={t('create.otherTags')}
                emptyText={t('create.noConfigTags')}
                disabled={isCreating}
              />
            )}

            <SearchSelect
              mode="option"
              label={t('create.assignee')}
              value={form.assignee || null}
              onChange={(next) =>
                setForm((current) => ({ ...current, assignee: next ?? '' }))
              }
              options={profileOptions}
              placeholder={t('create.assigneePlaceholder')}
              disabled={isCreating}
            />

            <SearchSelect
              mode="option"
              label={t('create.assetSelector')}
              options={assetOptions}
              values={form.assets}
              multiple
              onChangeMany={(assets) =>
                setForm((current) => ({ ...current, assets }))
              }
              placeholder={t('searchSelect.searchPlaceholder')}
              selectedLabel={t('create.assets')}
              emptyText={t('filters.noAssetOptions')}
              allowCustomValue={false}
              disabled={isCreating}
            />

            <RelationEditor
              label={t('relations.title')}
              value={form.relations}
              targetOptions={relationTargetOptions}
              constraintOptions={relationConstraintOptions}
              onChange={(relations) =>
                setForm((current) => ({ ...current, relations }))
              }
              disabled={isCreating}
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
  _config: BoardConfig | null,
  statusTags: Tag[],
  priorityTags: Tag[],
): FormState {
  return {
    schema: CARD_SCHEMA,
    title: '',
    summary: '',
    details: '',
    statusTag: statusTags[0] ?? '',
    priorityTag: priorityTags[0] ?? '',
    otherTags: [],
    assignee: '',
    assets: [],
    relations: [],
  }
}

function buildPayload(
  form: FormState,
  effectiveStatusTag: string,
  effectivePriorityTag: string,
): { ok: true; payload: CreateRecordPayload } | { ok: false; error: string } {
  const schema = form.schema.trim()
  const title = form.title.trim()
  const statusTag = effectiveStatusTag.trim() as Tag
  const priorityTag = effectivePriorityTag.trim() as Tag
  const assignee = form.assignee.trim()
  const description = form.summary.trim()
  const content = form.details.trim()
  const tags = uniqueValues(
    [statusTag, priorityTag, ...form.otherTags].filter(Boolean) as Tag[],
  )
  const assets = uniqueValues(form.assets.map((asset) => asset.trim()).filter(Boolean))
  const relations = normalizeRelationDrafts(form.relations)

  if (!schema) return { ok: false, error: 'create.errorSchemaRequired' }
  if (!title) return { ok: false, error: 'create.errorTitleRequired' }
  if (!statusTag) return { ok: false, error: 'create.errorStatusTagRequired' }

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
      relations,
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
