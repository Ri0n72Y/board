import { useTranslation } from 'react-i18next'
import { Cog6ToothIcon } from '@heroicons/react/20/solid'
import type { BoardStatusColumn } from '../utils/boardView'
import { useState } from 'react'
import { AnimatedDrawer } from './ui/AnimatedDrawer'
import { cn } from '../lib/cn'
import { changeLanguage, type Language, LANGUAGES } from '../i18n'
import { ProfileManagerDrawer } from './ProfileManagerDrawer'

interface AppSettingsDrawerProps {
  open: boolean
  onClose: () => void
  visibleColumnOptions: BoardStatusColumn[]
  visibleColumnIds: string[]
  onVisibleColumnIdsChange: (columnIds: string[]) => void
}

export function AppSettingsDrawer({
  open,
  onClose,
  visibleColumnOptions,
  visibleColumnIds,
  onVisibleColumnIdsChange,
}: AppSettingsDrawerProps) {
  const { t, i18n } = useTranslation()
  const selected = new Set(visibleColumnIds)
  const [isProfileManagerOpen, setIsProfileManagerOpen] = useState(false)

  function toggleColumn(columnId: string) {
    const next = selected.has(columnId)
      ? visibleColumnIds.filter((id) => id !== columnId)
      : [...visibleColumnIds, columnId]
    onVisibleColumnIdsChange(next)
  }

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

        <section className="mt-4 grid gap-3 rounded-lg border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold uppercase text-slate-500">
            {t('settings.members')}
          </h3>
          <p className="text-xs text-slate-500">{t('settings.membersHint')}</p>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-emerald-500 hover:bg-emerald-50"
            onClick={() => setIsProfileManagerOpen(true)}
          >
            {t('settings.manageMembers')}
          </button>
        </section>

        <section
          className="mt-4 grid gap-3 rounded-lg border border-slate-200 bg-white p-5"
          data-testid="visible-columns-settings"
        >
          <div className="grid gap-1">
            <h3 className="text-sm font-semibold uppercase text-slate-500">
              {t('settings.visibleColumns')}
            </h3>
            <p className="text-xs text-slate-500">
              {t('settings.visibleColumnsHint')}
            </p>
          </div>
          <div className="grid gap-2">
            {visibleColumnOptions.map((column) => (
              <label
                key={column.id}
                className="flex min-h-9 cursor-pointer items-center gap-3 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:border-emerald-500 hover:bg-emerald-50"
              >
                <input
                  type="checkbox"
                  data-testid={`visible-column-${column.id}`}
                  className="h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
                  checked={selected.has(column.id)}
                  onChange={() => toggleColumn(column.id)}
                />
                <span className="min-w-0 truncate">{column.label}</span>
              </label>
            ))}
          </div>
          <p className="text-xs text-slate-500">
            {t('settings.visibleColumnsEmptyFallback')}
          </p>
        </section>
      </AnimatedDrawer>

      <ProfileManagerDrawer
        open={isProfileManagerOpen}
        onClose={() => setIsProfileManagerOpen(false)}
      />
    </>
  )
}
