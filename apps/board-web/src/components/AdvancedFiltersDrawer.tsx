import { useMemo } from 'react'
import type {
  BoardCurrentProjection,
  BoardCurrentTagMatch,
  Tag,
} from '@labour-board/shared'
import { useTranslation } from 'react-i18next'
import { AnimatedDrawer } from './ui/AnimatedDrawer'
import { Select } from './ui/Select'
import { SearchSelect } from './ui/SearchSelect'
import { SummaryBar } from './SummaryBar'
import { formatTagLabel } from '../utils/tagDisplay'
import { groupTagsByNamespace, TAG_GROUP_I18N_KEYS } from '../utils/tagGroups'
import type { RecordReferenceOption } from '../utils/recordReferenceOptions'

interface AdvancedFiltersDrawerProps {
  open: boolean
  projection?: BoardCurrentProjection | null
  knownTags: Tag[]
  tags: Tag[]
  tagMatch: BoardCurrentTagMatch
  assetId: string
  relationTarget: string
  assetOptions: RecordReferenceOption[]
  relationTargetOptions: RecordReferenceOption[]
  onAddTag: (tag: string) => void
  onRemoveTag: (tag: Tag) => void
  onTagMatchChange: (tagMatch: BoardCurrentTagMatch) => void
  onAssetIdChange: (assetId: string) => void
  onRelationTargetChange: (relationTarget: string) => void
  onClose: () => void
}

export function AdvancedFiltersDrawer({
  open,
  projection,
  knownTags,
  tags,
  tagMatch,
  assetId,
  relationTarget,
  assetOptions,
  relationTargetOptions,
  onAddTag,
  onRemoveTag,
  onTagMatchChange,
  onAssetIdChange,
  onRelationTargetChange,
  onClose,
}: AdvancedFiltersDrawerProps) {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage

  const tagGroups = useMemo(() => groupTagsByNamespace(knownTags), [knownTags])
  const tagOptions = useMemo(
    () =>
      knownTags.map((tag) => ({
        value: tag,
        label: formatTagLabel(tag, lang),
        meta: tag,
      })),
    [knownTags, lang],
  )

  const tagMatchOptions = useMemo(
    () => [
      { value: 'all' as const, label: t('filters.tagMatchAll') },
      { value: 'any' as const, label: t('filters.tagMatchAny') },
    ],
    [t],
  )

  return (
    <AnimatedDrawer
      open={open}
      onClose={onClose}
      title={t('filters.advancedTitle')}
      subtitle={t('filters.advancedSubtitle')}
      closeLabel={t('filters.close')}
    >
      <div className="grid content-start gap-4">
        {projection && (
          <details className="rounded-lg border border-slate-200 bg-white p-4">
            <summary className="cursor-pointer text-xs font-bold uppercase text-slate-500">
              {t('filters.projectionSummary')}
            </summary>
            <SummaryBar projection={projection} compact />
          </details>
        )}

        {/* Active tags */}
        <section className="grid gap-2 rounded-lg border border-slate-200 bg-white p-4">
          <SearchSelect
            mode="tag"
            label={t('filters.tagSearch')}
            options={tagOptions}
            values={tags}
            multiple
            onChangeMany={(nextTags) => {
              for (const tag of tags) {
                if (!nextTags.includes(tag)) onRemoveTag(tag)
              }
              for (const tag of nextTags) {
                if (!tags.includes(tag as Tag)) onAddTag(tag)
              }
            }}
            placeholder={t('filters.tagPlaceholder')}
            selectedLabel={t('filters.activeTag')}
            emptyText={t('filters.noKnownTags')}
          />
        </section>

        {/* Tag match */}
        <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4">
          <Select
            label={t('filters.tagMatch')}
            value={tagMatch}
            onChange={(event) => onTagMatchChange(event.target.value as BoardCurrentTagMatch)}
            options={tagMatchOptions}
          />
        </section>

        {/* Asset ID / Relation target */}
        <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4">
          <SearchSelect
            mode="option"
            label={t('filters.assetSelector')}
            value={assetId || null}
            onChange={(next) => onAssetIdChange(next ?? '')}
            options={assetOptions}
            placeholder={t('searchSelect.searchPlaceholder')}
            emptyText={t('filters.noAssetOptions')}
            allowCustomValue={false}
          />
          <SearchSelect
            mode="option"
            label={t('filters.relationTargetSelector')}
            value={relationTarget || null}
            onChange={(next) => onRelationTargetChange(next ?? '')}
            options={relationTargetOptions}
            placeholder={t('searchSelect.searchPlaceholder')}
            emptyText={t('filters.noRelationTargetOptions')}
            allowCustomValue={false}
          />
        </section>

        {/* Known tags grouped by namespace */}
        {tagGroups.map((group) => (
          <section
            key={group.key}
            className="grid gap-2 rounded-lg border border-slate-200 bg-white p-4"
          >
            <h3 className="text-xs font-bold uppercase text-slate-500">
              {t(TAG_GROUP_I18N_KEYS[group.key])}
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {group.tags.map((tag) => {
                const isActive = tags.includes(tag as Tag)
                return (
                  <button
                    key={tag}
                    type="button"
                    className={
                      isActive
                        ? 'inline-flex min-h-[28px] max-w-full items-center rounded-full border border-emerald-700 bg-emerald-100 px-2.5 font-mono text-xs leading-tight text-emerald-800 break-all'
                        : 'inline-flex min-h-[28px] max-w-full items-center rounded-full bg-slate-100 px-2.5 font-mono text-xs leading-tight text-slate-700 break-all hover:bg-slate-200'
                    }
                    onClick={() => (isActive ? onRemoveTag(tag as Tag) : onAddTag(tag))}
                    title={isActive ? t('filters.removeTagFilter') : t('filters.addTagFilter')}
                  >
                    {formatTagLabel(tag, lang)}
                  </button>
                )
              })}
            </div>
          </section>
        ))}

        {tagGroups.length === 0 && (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
            {t('filters.noKnownTags')}
          </div>
        )}
      </div>
    </AnimatedDrawer>
  )
}
