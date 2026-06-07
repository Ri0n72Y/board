import { ExclamationTriangleIcon } from '@heroicons/react/20/solid'

export function AgentDraftSafetyBanner() {
  return (
    <section className="grid gap-2 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950">
      <div className="flex items-center gap-2">
        <ExclamationTriangleIcon className="h-5 w-5 shrink-0" />
        <strong className="text-sm font-semibold uppercase">Draft Only - Not Executed</strong>
      </div>
      <p className="text-sm">This is a static context pack saved for review. No AI call has been made. No agent execution, patch, or board mutation has been performed.</p>
      <p className="text-xs text-amber-800">Drafts are reviewed by humans before being handed to an Agent.</p>
    </section>
  )
}
