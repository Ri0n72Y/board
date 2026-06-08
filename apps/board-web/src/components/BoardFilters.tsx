import { useId } from 'react'
import type { BoardCurrentTagMatch, Tag } from '@labour-board/shared'
import {
  MagnifyingGlassIcon,
  ExclamationTriangleIcon,
  AdjustmentsHorizontalIcon,
  XMarkIcon,
} from '@heroicons/react/20/solid'
import { useTranslation } from 'react-i18next'
import { Button } from './ui/Button'
import { TextInput } from './ui/TextInput'
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
  statusTags?: Tag[]
  priorityTags?: Tag[]
  profileOptions?: { value: string; label: string }[]
  metadataLoading?: boolean
  metadataError?: MetadataErrorState
  onQChange: (q: string) => void
  onAddTag: (tag: string) => void
  onRemoveTag: (tag: Tag) => void
  onTagMatchChange: (tagMatch: BoardCurrentTagMatch) => void
  onIncludeArchivedChange: (includeArchived: boolean) => void
  onAssigneeChange: (assignee: string) => void
  onAssetIdChange: (assetId: string) => void
  onRelationTargetChange: (relationTarget: string) => void
  onOpenAdvanced?: () => void
  onClearFilters?: () => void
}

export function BoardFilters({
  q,
  tags,
  includeArchived,
  assignee,
  assetId,
  relationTarget,
  statusTags = [],
  priorityTags = [],
  profileOptions = [],
  metadataLoading = false,
  metadataError,
  onQChange,
  onAddTag,
  onRemoveTag,
  onIncludeArchivedChange,
  onAssigneeChange,
  onAssetIdChange,
  onRelationTargetChange,
  onOpenAdvanced,
  onClearFilters,
  // Rest unused in simplified main UI, retained for interface compat
}: BoardFiltersProps) {
  const { t } = useTranslation()
  const assigneeListId = useId()

  const hasMetadataWarning =
    metadataError && (metadataError.config || metadataError.profiles)

  const hasAnyFilter =
    q.trim() || tags.length > 0 || assignee.trim() || assetId.trim() || relationTarget.trim() || includeArchived

  return (
    <>
      <Panel className="p-4" aria-label="Board filters">
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

          <div className="grid gap-1.5">
            <label className="text-xs font-bold text-slate-500" htmlFor={assigneeListId}>
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

          <div className="flex flex-col justify-end gap-3 lg:col-span-2">
            <div className="flex flex-wrap items-center gap-2">
              <SwitchField
                label={t('filters.includeArchived')}
                checked={includeArchived}
                onChange={onIncludeArchivedChange}
              />
              {onClearFilters && hasAnyFilter && (
                <Button
                  type="button"
                  variant="ghost"
                  className="min-h-8 px-2.5 text-xs"
                  onClick={onClearFilters}
                  icon={<XMarkIcon className="h-3.5 w-3.5" />}
                >
                  {t('filters.clearFilters')}
                </Button>
              )}
              {onOpenAdvanced && (
                <Button
                  type="button"
                  variant="ghost"
                  className="min-h-8 px-2.5 text-xs"
                  onClick={onOpenAdvanced}
                  icon={<AdjustmentsHorizontalIcon className="h-4 w-4" />}
                >
                  {t('filters.advancedFilters')}
                </Button>
              )}
            </div>
          </div>
        </div>
      </Panel>

      {/* Status quick-select */}
      {statusTags.length > 0 && (
        <Panel className="mt-3 px-4 py-3" aria-label="Status quick filter">
          <TagChipRow
            label={t('filters.statusOptions')}
            tags={statusTags}
            onTagClick={onAddTag}
          />
        </Panel>
      )}

      {/* Priority quick-select */}
      {priorityTags.length > 0 && (
        <Panel className="mt-3 px-4 py-3" aria-label="Priority quick filter">
          <TagChipRow
            label={t('filters.priorityOptions')}
            tags={priorityTags}
            onTagClick={onAddTag}
          />
        </Panel>
      )}

      {/* Active tags */}
      {tags.length > 0 && (
        <Panel className="mt-3 px-4 py-3" aria-label="Active tag filters">
          <TagChipRow
            label={t('filters.activeTag')}
            tags={tags}
            selected
            onTagClick={onRemoveTag}
          />
        </Panel>
      )}

      {/* Active filter summary: assetId / relationTarget / assignee */}
      {(assetId.trim() || relationTarget.trim() || assignee.trim()) && (
        <Panel className="mt-3 px-4 py-3" aria-label="Active ID filters">
          <div className="flex flex-wrap items-center gap-2">
            {assignee.trim() && (
              <button
                className={chipClassName({ selected: true })}
                type="button"
                onClick={() => onAssigneeChange('')}
                title={t('filters.removeFilter')}
              >
                {t('filters.assignee')}: {assignee}
              </button>
            )}
            {assetId.trim() && (
              <button
                className={chipClassName({ selected: true })}
                type="button"
                onClick={() => onAssetIdChange('')}
                title={t('filters.removeFilter')}
              >
                {t('filters.assetId')}: {assetId}
              </button>
            )}
            {relationTarget.trim() && (
              <button
                className={chipClassName({ selected: true })}
                type="button"
                onClick={() => onRelationTargetChange('')}
                title={t('filters.removeFilter')}
              >
                {t('filters.relationTarget')}: {relationTarget}
              </button>
            )}
          </div>
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
    readonly && 'border border-slate-200',
  )
}
