import { useTranslation } from 'react-i18next'
import { XMarkIcon, Cog6ToothIcon } from '@heroicons/react/20/solid'
import { Button } from './ui/Button'
import { cn } from '../lib/cn'
import { changeLanguage, type Language, LANGUAGES } from '../i18n'

interface AppSettingsDrawerProps {
  open: boolean
  onClose: () => void
}

export function AppSettingsDrawer({ open, onClose }: AppSettingsDrawerProps) {
  const { t, i18n } = useTranslation()

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/30"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <aside
        aria-labelledby="settings-title"
        aria-modal="true"
        className="ml-auto grid h-full w-full max-w-sm grid-rows-[auto_1fr] overflow-hidden border-l border-slate-200 bg-stone-50 text-slate-950 shadow-xl"
        role="dialog"
      >
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4">
          <div>
            <p className="mb-1 text-xs font-bold uppercase text-slate-500">
              {t('header.settings')}
            </p>
            <h2 className="text-xl font-semibold leading-tight" id="settings-title">
              {t('settings.title')}
            </h2>
          </div>
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            title={t('settings.close')}
            icon={<XMarkIcon className="h-4 w-4" />}
          >
            {t('settings.close')}
          </Button>
        </header>

        <div className="grid content-start gap-6 overflow-y-auto px-5 py-4">
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
                        : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-500 hover:bg-emerald-50',
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
        </div>
      </aside>
    </div>
  )
}
