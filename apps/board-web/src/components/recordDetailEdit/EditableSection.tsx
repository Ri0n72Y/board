import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

interface EditableSectionProps {
  title: string
  editing?: boolean
  dirty?: boolean
  disabled?: boolean
  inline?: boolean
  children: ReactNode
  editor?: ReactNode
  onEdit?: () => void
}

export function EditableSection({
  title,
  editing = false,
  dirty = false,
  disabled = false,
  inline = false,
  children,
  editor,
  onEdit,
}: EditableSectionProps) {
  const canEdit = Boolean(onEdit && !disabled)
  const content = editing && editor ? editor : children
  const interactive = canEdit && !editing
  return (
    <section
      className={cn(
        'rounded-lg border bg-white p-4 transition',
        editing
          ? 'border-emerald-600 bg-emerald-50/30 ring-2 ring-emerald-100'
          : dirty
            ? 'border-amber-400 bg-amber-50/30'
            : 'border-slate-200',
        interactive &&
          'cursor-pointer hover:border-emerald-300 hover:bg-emerald-50/20'
      )}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? title : undefined}
      onClick={(event) => {
        event.stopPropagation()
        if (!editing && canEdit) onEdit?.()
      }}
      onKeyDown={(event) => {
        if (!interactive) return
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          event.stopPropagation()
          onEdit?.()
        }
      }}
    >
      {inline && !editing ? (
        <div className="flex items-start justify-between gap-4">
          <h3 className="shrink-0 text-xs font-bold uppercase text-slate-500">
            {title}
          </h3>
          <div className="min-w-0 flex-1 text-right">{content}</div>
        </div>
      ) : (
        <>
          <h3 className="mb-2 text-xs font-bold uppercase text-slate-500">
            {title}
          </h3>
          <div>{content}</div>
        </>
      )}
    </section>
  )
}
