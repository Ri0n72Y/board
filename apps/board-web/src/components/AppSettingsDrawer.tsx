import { useCallback, useMemo, useState, type Ref } from 'react'
import { useTranslation } from 'react-i18next'
import { DragDropProvider, useDraggable, useDroppable } from '@dnd-kit/react'
import { Cog6ToothIcon } from '@heroicons/react/20/solid'
import type { BoardStatusColumn } from '../utils/boardView'
import { AnimatedDrawer } from './ui/AnimatedDrawer'
import { cn } from '../lib/cn'
import { changeLanguage, type Language, LANGUAGES } from '../i18n'
import { ProfileManagerDrawer } from './ProfileManagerDrawer'
import { TagConfigReadOnlyPanel } from './TagConfigReadOnlyPanel'
import { useBoardMetadataStore } from '../stores/boardMetadataStore'

const SETTINGS_COLUMN_DND_TYPE = 'settings-board-column-order'
const COLUMN_ORDER_ID_PREFIX = 'settings-column:'

type SettingsTab = 'board' | 'tags' | 'general'

interface ColumnDragEndEvent {
  canceled?: boolean
  operation: {
    source?: { id?: string | number | null } | null
    target?: { id?: string | number | null } | null
  }
}

interface AppSettingsDrawerProps {
  open: boolean
  onClose: () => void
  visibleColumnOptions: BoardStatusColumn[]
  visibleColumnIds: string[]
  columnOrderIds?: string[]
  onVisibleColumnIdsChange: (columnIds: string[]) => void
  onColumnOrderIdsChange?: (columnIds: string[]) => void
}

export function AppSettingsDrawer({
  open,
  onClose,
  visibleColumnOptions,
  visibleColumnIds,
  columnOrderIds = [],
  onVisibleColumnIdsChange,
  onColumnOrderIdsChange,
}: AppSettingsDrawerProps) {
  const { t, i18n } = useTranslation()
  const isZh = (i18n.resolvedLanguage ?? i18n.language).startsWith('zh')
  const [activeTab, setActiveTab] = useState<SettingsTab>('board')
  const selected = useMemo(() => new Set(visibleColumnIds), [visibleColumnIds])
  const [isProfileManagerOpen, setIsProfileManagerOpen] = useState(false)
  const config = useBoardMetadataStore((state) => state.config)
  const metadataLoading = useBoardMetadataStore((state) => state.isLoading)
  const metadataError = useBoardMetadataStore((state) => state.error)
  const orderedVisibleColumnOptions = useMemo(() => {
    const byId = new Map(visibleColumnOptions.map((column) => [column.id, column]))
    const preferredOrder =
      columnOrderIds.length > 0
        ? columnOrderIds
        : [
            ...visibleColumnIds,
            ...visibleColumnOptions
              .map((column) => column.id)
              .filter((id) => !selected.has(id)),
          ]
    const ordered = preferredOrder
      .map((id) => byId.get(id))
      .filter((column): column is BoardStatusColumn => column != null)
    const orderedIds = new Set(ordered.map((column) => column.id))
    const missing = visibleColumnOptions.filter((column) => !orderedIds.has(column.id))
    return [...ordered, ...missing]
  }, [columnOrderIds, selected, visibleColumnIds, visibleColumnOptions])
  const orderedColumnIds = useMemo(
    () => orderedVisibleColumnOptions.map((column) => column.id),
    [orderedVisibleColumnOptions]
  )

  const toggleColumn = useCallback(
    (columnId: string) => {
      const next = selected.has(columnId)
        ? visibleColumnIds.filter((id) => id !== columnId)
        : orderedColumnIds.filter((id) => id === columnId || selected.has(id))
      onVisibleColumnIdsChange(next)
    },
    [onVisibleColumnIdsChange, orderedColumnIds, selected, visibleColumnIds]
  )

  const reorderColumn = useCallback(
    (sourceId: string, targetId: string) => {
      const next = moveColumnId(orderedColumnIds, sourceId, targetId)
      if (onColumnOrderIdsChange) {
        onColumnOrderIdsChange(next)
        return
      }
      onVisibleColumnIdsChange(next.filter((id) => selected.has(id)))
    },
    [onColumnOrderIdsChange, onVisibleColumnIdsChange, orderedColumnIds, selected]
  )

  const handleColumnDragEnd = useCallback(
    (event: ColumnDragEndEvent) => {
      if (event.canceled) return
      const sourceId = parseColumnOrderId(event.operation.source?.id)
      const targetId = parseColumnOrderId(event.operation.target?.id)
      if (!sourceId || !targetId || sourceId === targetId) return
      reorderColumn(sourceId, targetId)
    },
    [reorderColumn]
  )

  const tabs: { id: SettingsTab; label: string }[] = [
    {
      id: 'board',
      label: t('settings.tabs.board', {
        defaultValue: isZh ? '看板' : 'Board',
      }),
    },
    {
      id: 'tags',
      label: t('settings.tabs.tags', {
        defaultValue: isZh ? '标签' : 'Tags',
      }),
    },
    {
      id: 'general',
      label: t('settings.tabs.general', {
        defaultValue: isZh ? '通用' : 'General',
      }),
    },
  ]

  return (
    <>
      <AnimatedDrawer
        open={open && !isProfileManagerOpen}
        onClose={onClose}
        title={t('settings.title')}
        subtitle={t('header.settings')}
        size="sm"
        closeLabel={t('settings.close')}
      >
        <div className="mb-4 flex flex-wrap gap-2" role="tablist">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={cn(
                'rounded-md border px-3 py-1.5 text-sm font-medium transition',
                activeTab === tab.id
                  ? 'border-emerald-600 bg-emerald-100 text-emerald-800'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-500 hover:bg-emerald-50'
              )}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'board' && (
          <section
            className="grid gap-3 rounded-lg border border-slate-200 bg-white p-5"
            data-testid="visible-columns-settings"
          >
            <div className="grid gap-1">
              <h3 className="text-sm font-semibold uppercase text-slate-500">
                {t('settings.visibleColumns')}
              </h3>
              <p className="text-xs text-slate-500">
                {t('settings.visibleColumnsHint')}
              </p>
              <p className="text-xs text-slate-500">
                {t('settings.columnOrderHint', {
                  defaultValue: isZh
                    ? '拖拽行左侧手柄调整列顺序。'
                    : 'Drag the row handle to reorder board columns.',
                })}
              </p>
            </div>
            <DragDropProvider onDragEnd={handleColumnDragEnd}>
              <div className="grid gap-2">
                {orderedVisibleColumnOptions.map((column) => (
                  <ColumnOrderRow
                    key={column.id}
                    column={column}
                    checked={selected.has(column.id)}
                    onToggle={() => toggleColumn(column.id)}
                  />
                ))}
              </div>
            </DragDropProvider>
            <p className="text-xs text-slate-500">
              {t('settings.visibleColumnsEmptyFallback')}
            </p>
          </section>
        )}

        {activeTab === 'tags' && (
          <TagConfigReadOnlyPanel
            config={config}
            isLoading={metadataLoading}
            error={metadataError.config}
          />
        )}

        {activeTab === 'general' && (
          <GeneralSettingsPanel
            onOpenProfileManager={() => setIsProfileManagerOpen(true)}
          />
        )}
      </AnimatedDrawer>

      <ProfileManagerDrawer
        open={isProfileManagerOpen}
        onClose={() => setIsProfileManagerOpen(false)}
      />
    </>
  )
}

function GeneralSettingsPanel({
  onOpenProfileManager,
}: {
  onOpenProfileManager: () => void
}) {
  const { t, i18n } = useTranslation()
  return (
    <div className="grid gap-4">
      <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-5">
        <h3 className="text-sm font-semibold uppercase text-slate-500">
          {t('settings.language')}
        </h3>
        <div className="flex flex-wrap gap-2">
          {LANGUAGES.map((lang) => {
            const isActive = i18n.language === lang
            return (
              <button
                key={lang}
                type="button"
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md border px-4 py-2 text-sm font-medium transition',
                  isActive
                    ? 'border-emerald-500 bg-emerald-100 text-emerald-800 cursor-default'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-500 hover:bg-emerald-50'
                )}
                disabled={isActive}
                onClick={() => changeLanguage(lang as Language)}
                aria-pressed={isActive}
              >
                {isActive && <Cog6ToothIcon className="h-3.5 w-3.5" />}
                {lang === 'en-US'
                  ? t('settings.language.enUS')
                  : t('settings.language.zhCN')}
              </button>
            )
          })}
        </div>
      </section>

      <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-5">
        <h3 className="text-sm font-semibold uppercase text-slate-500">
          {t('settings.members')}
        </h3>
        <p className="text-xs text-slate-500">{t('settings.membersHint')}</p>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-emerald-500 hover:bg-emerald-50"
          onClick={onOpenProfileManager}
        >
          {t('settings.manageMembers')}
        </button>
      </section>
    </div>
  )
}

function ColumnOrderRow({
  column,
  checked,
  onToggle,
}: {
  column: BoardStatusColumn
  checked: boolean
  onToggle: () => void
}) {
  const { t, i18n } = useTranslation()
  const isZh = (i18n.resolvedLanguage ?? i18n.language).startsWith('zh')
  const dragLabel = t('settings.columnDragHandle', {
    column: column.label,
    defaultValue: isZh
      ? `拖拽调整 ${column.label} 列顺序`
      : `Drag to reorder ${column.label}`,
  })
  const { ref: dragRef, handleRef, isDragging } = useDraggable({
    id: `${COLUMN_ORDER_ID_PREFIX}${column.id}`,
    type: SETTINGS_COLUMN_DND_TYPE,
  })
  const { ref: dropRef, isDropTarget } = useDroppable({
    id: `${COLUMN_ORDER_ID_PREFIX}${column.id}`,
    accept: SETTINGS_COLUMN_DND_TYPE,
  })
  const setRowRef = useCallback(
    (element: HTMLDivElement | null) => {
      dragRef(element)
      dropRef(element)
    },
    [dragRef, dropRef]
  )

  return (
    <div
      ref={setRowRef}
      className={cn(
        'flex min-h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition',
        isDropTarget && 'border-emerald-500 bg-emerald-50',
        isDragging && 'opacity-60 ring-2 ring-emerald-100'
      )}
      data-testid={`column-order-${column.id}`}
    >
      <button
        ref={handleRef as Ref<HTMLButtonElement>}
        type="button"
        className="shrink-0 cursor-grab rounded border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-xs text-slate-500 active:cursor-grabbing"
        aria-label={dragLabel}
        title={dragLabel}
      >
        ⋮⋮
      </button>
      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          data-testid={`visible-column-${column.id}`}
          className="h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
          checked={checked}
          onChange={onToggle}
        />
        <span className="min-w-0 truncate">{column.label}</span>
      </label>
    </div>
  )
}

function parseColumnOrderId(id: string | number | null | undefined): string | null {
  if (typeof id !== 'string') return null
  if (!id.startsWith(COLUMN_ORDER_ID_PREFIX)) return null
  return id.slice(COLUMN_ORDER_ID_PREFIX.length) || null
}

function moveColumnId(
  columnIds: readonly string[],
  sourceId: string,
  targetId: string
): string[] {
  const sourceIndex = columnIds.indexOf(sourceId)
  const targetIndex = columnIds.indexOf(targetId)
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex)
    return [...columnIds]

  const next = [...columnIds]
  const [moved] = next.splice(sourceIndex, 1)
  next.splice(targetIndex, 0, moved)
  return next
}
