import { ExclamationTriangleIcon } from '@heroicons/react/20/solid'
import { useTranslation } from 'react-i18next'

export function AgentDraftSafetyBanner() {
  const { t } = useTranslation()

  return (
    <section className="grid gap-2 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950">
      <div className="flex items-center gap-2">
        <ExclamationTriangleIcon className="h-5 w-5 shrink-0" />
        <strong className="text-sm font-semibold uppercase">{t('agent.safety.title')}</strong>
      </div>
      <p className="text-sm">{t('agent.safety.description')}</p>
      <p className="text-xs text-amber-800">{t('agent.safety.footer')}</p>
    </section>
  )
}
