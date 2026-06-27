import type { BoardCurrentTagMatch, Tag } from '@labour-board/shared'
import {
  MagnifyingGlassIcon,
  ExclamationTriangleIcon,
  AdjustmentsHorizontalIcon,
  XMarkIcon,
} from '@heroicons/react/20/solid'
import { useTranslation } from 'react-i18next'
import { Button } from './ui/Button'
import { SwitchField } from './ui/SwitchField'
import { SearchSelect } from './ui/SearchSelect'
import { cn } from '../lib/cn'
import { formatTagLabel } from '../utils/tagDisplay'
import {
  getReferenceDisplayLabel,
  type RecordReferenceOption,
} from '../utils/recordReferenceOptions'

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
  assetOptions?: RecordReferenceOption[]
  relationTargetOptions?: RecordReferenceOption[]
  profileOptions?: {
    value: string
    label: string
    description?: string
    meta?: string
  }[]
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
  assetOptions = [],
  relationTargetOptions = [],
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
}: BoardFiltersProps) {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage

  const hasMetadataWarning =
    metadataError && (metadataError.config || metadataError.profiles)
  const hasAnyFilter =
    q.trim() ||
    tags.length > 0 ||
    assignee.trim() ||
    assetId.trim() ||
    relationTarget.trim() ||
    includeArchived
  const assetIdLabel = getReferenceDisplayLabel(assetOptions, assetId)
  const relationTargetLabel = getReferenceDisplayLabel(
    relationTargetOptions,
    relationTarget
  )

  return (
    <div className="border-b border-slate-200 bg-slate-50/95 px-6 py-2.5 sm:px-8">
      {/* Metadata inline warnings — compact */}
      {metadataLoading && (
        <span className="mr-2 inline-block text-xs text-slate-400">
          {t('metadata.loading.all')}
        </span>
      )}
      {hasMetadataWarning && (
        <span
          className="mr-2 inline-flex items-center gap-1 text-xs text-amber-700"
          role="alert"
        >
          <ExclamationTriangleIcon className="h-3 w-3 shrink-0" />
          {metadataError?.config && t('metadata.error.config')}
          {metadataError?.config && metadataError?.profiles && ' '}
          {metadataError?.profiles && t('metadata.error.profiles')}
        </span>
      )}

      {/* Main filter row — compact, single row, no wrap */}
      <div className="flex min-h-9 flex-nowrap items-center gap-6 overflow-hidden">
        <div className="relative min-w-0 flex-[1_1_32rem]">
          <MagnifyingGlassIcon className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            className="h-9 w-full rounded-md border border-slate-200 bg-white pl-8 pr-3 text-sm text-slate-950 outline-none placeholder:text-slate-400 focus:border-emerald-700 focus:ring-1 focus:ring-emerald-100"
            value={q}
            onChange={(event) => onQChange(event.target.value)}
            placeholder={t('filters.searchPlaceholder')}
            aria-label={t('filters.search')}
          />
        </div>

        <div className="relative hidden w-44 shrink-0 sm:block">
          <input
            type="text"
            className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none placeholder:text-slate-400 focus:border-emerald-700 focus:ring-1 focus:ring-emerald-100"
            placeholder={t('filters.tagPlaceholder')}
            aria-label={t('filters.tagSearch')}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const input = e.currentTarget as HTMLInputElement
                const val = input.value.trim()
                if (val) {
                  onAddTag(val)
                  input.value = ''
                }
              }
            }}
          />
        </div>

        <div className="w-60 shrink-0">
          <SearchSelect
            mode="option"
            value={assignee || null}
            onChange={(next) => onAssigneeChange(next ?? '')}
            options={profileOptions}
            placeholder={t('filters.assigneePlaceholder')}
          />
        </div>

        <SwitchField
          label={t('filters.includeArchived')}
          checked={includeArchived}
          onChange={onIncludeArchivedChange}
          className="shrink-0 whitespace-nowrap"
        />

        {onClearFilters && hasAnyFilter && (
          <Button
            type="button"
            variant="ghost"
            className="min-h-9 shrink-0 px-3 text-sm"
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
            className="min-h-9 shrink-0 px-3 text-sm"
            onClick={onOpenAdvanced}
            icon={<AdjustmentsHorizontalIcon className="h-4 w-4" />}
          >
            {t('filters.advancedFilters')}
          </Button>
        )}
      </div>

      {/* Active tag chips — only when present */}
      {tags.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {tags.map((tag) => (
            <button
              className={chipClassName({ selected: true })}
              key={tag}
              type="button"
              onClick={() => onRemoveTag(tag)}
              title={t('filters.removeTagFilter')}
            >
              {formatTagLabel(tag, lang)}
            </button>
          ))}
        </div>
      )}

      {/* Active filter chips: assetId / relationTarget — only when present */}
      {(assetId.trim() || relationTarget.trim()) && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {assetId.trim() && (
            <button
              className={chipClassName({ selected: true })}
              type="button"
              onClick={() => onAssetIdChange('')}
              title={t('filters.removeFilter')}
            >
              {t('filters.assetId')}: {assetIdLabel}
            </button>
          )}
          {relationTarget.trim() && (
            <button
              className={chipClassName({ selected: true })}
              type="button"
              onClick={() => onRelationTargetChange('')}
              title={t('filters.removeFilter')}
            >
              {t('filters.relationTarget')}: {relationTargetLabel}
            </button>
          )}
        </div>
      )}
    </div>
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
      {label && (
        <span className="text-xs font-bold text-slate-500">{label}</span>
      )}
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
            title={
              selected
                ? t('filters.removeTagFilter')
                : t('filters.addTagFilter')
            }
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
    'inline-flex min-h-[28px] max-w-full items-center rounded-full bg-slate-100 px-2.5 font-mono text-xs leading-tight text-slate-700 break-all',
    selected && 'border border-emerald-700 bg-emerald-100 text-emerald-800',
    readonly && 'border border-slate-200'
  )
}
