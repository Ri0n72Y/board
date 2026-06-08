import { useId, useState } from 'react'
import type { BoardCurrentTagMatch, Tag } from '@labour-board/shared'
import {
  MagnifyingGlassIcon,
  TagIcon,
  HashtagIcon,
  LinkIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/20/solid'
import { useTranslation } from 'react-i18next'
import { Button } from './ui/Button'
import { TextInput } from './ui/TextInput'
import { Select } from './ui/Select'
import { SwitchField } from './ui/SwitchField'
import { Panel } from './ui/Panel'
import { cn } from '../lib/cn'
import { formatTagLabel } from '../utils/tagDisplay'

interface MetadataErrorState {
  config: string | null
  profiles: string | null
}

interface BoardFiltersProps {
  q: string
  tags: Tag[]
  tagMatch: BoardCurrentTagMatch
  includeArchived: boolean
  assignee: string
  assetId: string
  relationTarget: string
  knownTags: Tag[]
  /** Config-driven status tag options (only tag ids). */
  statusTags?: Tag[]
  /** Config-driven priority tag options (only tag ids). */
  priorityTags?: Tag[]
  /** Profile options for assignee autocomplete. */
  profileOptions?: { value: string; label: string }[]
  /** Whether metadata is still loading. */
  metadataLoading?: boolean
  /** Metadata load errors. */
  metadataError?: MetadataErrorState
  onQChange: (q: string) => void
  onAddTag: (tag: string) => void
  onRemoveTag: (tag: Tag) => void
  onTagMatchChange: (tagMatch: BoardCurrentTagMatch) => void
  onIncludeArchivedChange: (includeArchived: boolean) => void
  onAssigneeChange: (assignee: string) => void
  onAssetIdChange: (assetId: string) => void
  onRelationTargetChange: (relationTarget: string) => void
}

const tagMatchOptions = (t: (key: string) => string): { value: string; label: string }[] => [
  { value: 'all', label: t('filters.tagMatchAll') },
  { value: 'any', label: t('filters.tagMatchAny') },
]

export function BoardFilters({
  q,
  tags,
  tagMatch,
  includeArchived,
  assignee,
  assetId,
  relationTarget,
  knownTags,
  statusTags = [],
  priorityTags = [],
  profileOptions = [],
  metadataLoading = false,
  metadataError,
  onQChange,
  onAddTag,
  onRemoveTag,
  onTagMatchChange,
  onIncludeArchivedChange,
  onAssigneeChange,
  onAssetIdChange,
  onRelationTargetChange,
}: BoardFiltersProps) {
  const { t } = useTranslation()
  const [tagInput, setTagInput] = useState('')
  const assigneeListId = useId()

  function submitTag() {
    onAddTag(tagInput)
    setTagInput('')
  }

  const hasMetadataWarning =
    metadataError && (metadataError.config || metadataError.profiles)

  return (
    <>
      <Panel className="p-4" aria-label="Board filters">
        {/* Metadata loading / warning */}
        {metadataLoading && (
          <p className="mb-3 text-xs text-slate-400">
            {t('metadata.loading.all')}
          </p>
        )}
        {hasMetadataWarning && (
          <div
            className="mb-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"
            role="alert"
          >
            <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {metadataError?.config && t('metadata.error.config')}
              {metadataError?.config && metadataError?.profiles && ' '}
              {metadataError?.profiles && t('metadata.error.profiles')}
            </span>
          </div>
        )}

        <div className="grid gap-3 lg:grid-cols-4">
          <TextInput
            label={t('filters.search')}
            value={q}
            onChange={(event) => onQChange(event.target.value)}
            placeholder={t('filters.searchPlaceholder')}
            icon={<MagnifyingGlassIcon className="h-4 w-4" />}
          />

          <TextInput
            label={t('filters.tag')}
            value={tagInput}
            onChange={(event) => setTagInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                submitTag()
              }
            }}
            placeholder={t('filters.tagPlaceholder')}
            icon={<TagIcon className="h-4 w-4" />}
            after={
              <Button type="button" onClick={submitTag} className="shrink-0 rounded-l-none">
                {t('filters.tagAdd')}
              </Button>
            }
          />

          <Select
            label={t('filters.tagMatch')}
            value={tagMatch}
            onChange={(event) =>
              onTagMatchChange(event.target.value as BoardCurrentTagMatch)
            }
            options={tagMatchOptions(t)}
          />

          <div className="flex flex-col justify-end gap-3">
            <div className="grid gap-1.5">
              <label
                className="text-xs font-bold text-slate-500"
                htmlFor={assigneeListId}
              >
                {t('filters.assignee')}
              </label>
              <input
                id={assigneeListId}
                className={cn(
                  'min-h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-normal text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100',
                )}
                value={assignee}
                onChange={(event) => onAssigneeChange(event.target.value)}
                placeholder={t('filters.assigneePlaceholder')}
                list={`${assigneeListId}-list`}
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
            <SwitchField
              label={t('filters.includeArchived')}
              checked={includeArchived}
              onChange={onIncludeArchivedChange}
            />
          </div>
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <TextInput
            label={t('filters.assetId')}
            value={assetId}
            onChange={(event) => onAssetIdChange(event.target.value)}
            placeholder={t('filters.assetIdPlaceholder')}
            icon={<HashtagIcon className="h-4 w-4" />}
          />
          <TextInput
            label={t('filters.relationTarget')}
            value={relationTarget}
            onChange={(event) => onRelationTargetChange(event.target.value)}
            placeholder={t('filters.relationTargetPlaceholder')}
            icon={<LinkIcon className="h-4 w-4" />}
          />
        </div>
      </Panel>

      {/* Config-driven status / priority tag quick-select */}
      {(statusTags.length > 0 || priorityTags.length > 0) && (
        <Panel className="mt-3 px-4 py-3" aria-label="Config tag options">
          {statusTags.length > 0 && (
            <TagChipRow
              label={t('filters.statusOptions')}
              tags={statusTags}
              onTagClick={onAddTag}
            />
          )}
          {priorityTags.length > 0 && (
            <TagChipRow
              label={t('filters.priorityOptions')}
              tags={priorityTags}
              onTagClick={onAddTag}
            />
          )}
        </Panel>
      )}

      {/* Active / Known tags */}
      {(tags.length > 0 || knownTags.length > 0) && (
        <Panel className="mt-3 px-4 py-3" aria-label="Tag filters">
          {tags.length > 0 && (
            <TagChipRow
              label={t('filters.activeTag')}
              tags={tags}
              selected
              onTagClick={onRemoveTag}
            />
          )}
          {knownTags.length > 0 && (
            <TagChipRow label={t('filters.knownTag')} tags={knownTags} onTagClick={onAddTag} />
          )}
        </Panel>
      )}
    </>
  )
}

/* ─── TagChipRow ─── */

interface TagChipRowProps {
  label?: string
  tags: Tag[]
  selected?: boolean
  readonly?: boolean
  onTagClick?: (tag: Tag) => void
}

export function TagChipRow({
  label,
  tags,
  selected = false,
  readonly = false,
  onTagClick,
}: TagChipRowProps) {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage

  if (tags.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-2">
      {label && <span className="text-xs font-bold text-slate-500">{label}</span>}
      {tags.map((tag) =>
        readonly || !onTagClick ? (
          <span className={chipClassName({ selected, readonly })} key={tag}>
            {formatTagLabel(tag, lang)}
          </span>
        ) : (
          <button
            className={chipClassName({ selected })}
            key={tag}
            type="button"
            onClick={() => onTagClick(tag)}
            title={selected ? t('filters.removeTagFilter') : t('filters.addTagFilter')}
          >
            {formatTagLabel(tag, lang)}
          </button>
        )
      )}
    </div>
  )
}

function chipClassName({
  selected,
  readonly,
}: {
  selected: boolean
  readonly?: boolean
}) {
  return cn(
    'inline-flex min-h-[30px] max-w-full items-center rounded-full bg-slate-100 px-2.5 font-mono text-xs leading-tight text-slate-700 break-all',
    selected && 'border border-emerald-700 bg-emerald-100 text-emerald-800',
    readonly && 'border border-slate-200'
  )
}
