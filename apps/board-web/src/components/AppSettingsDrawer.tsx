import { useTranslation } from 'react-i18next'
import { Cog6ToothIcon } from '@heroicons/react/20/solid'
import { AnimatedDrawer } from './ui/AnimatedDrawer'
import { cn } from '../lib/cn'
import { changeLanguage, type Language, LANGUAGES } from '../i18n'

interface AppSettingsDrawerProps {
  open: boolean
  onClose: () => void
}

export function AppSettingsDrawer({ open, onClose }: AppSettingsDrawerProps) {
  const { t, i18n } = useTranslation()

  return (
    <AnimatedDrawer
      open={open}
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
    </AnimatedDrawer>
  )
}
