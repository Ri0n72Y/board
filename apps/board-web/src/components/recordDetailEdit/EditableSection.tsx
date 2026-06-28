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
  return (
    <section
      className={cn(
        'rounded-lg border border-slate-200 bg-white p-4 transition',
        canEdit && !editing && 'cursor-pointer hover:border-emerald-300 hover:bg-emerald-50/20',
        editing && 'border-emerald-300 bg-emerald-50/30',
        dirty && 'shadow-[0_0_0_2px_rgba(16,185,129,0.35)]',
      )}
      onClick={() => {
        if (!editing && canEdit) onEdit?.()
      }}
    >
      {inline && !editing ? (
        <div className="flex items-start justify-between gap-4">
          <h3 className="shrink-0 text-xs font-bold uppercase text-slate-500">{title}</h3>
          <div className="min-w-0 flex-1 text-right" onClick={(event) => event.stopPropagation()}>
            {children}
          </div>
        </div>
      ) : (
        <>
          <h3 className="mb-2 text-xs font-bold uppercase text-slate-500">{title}</h3>
          <div onClick={(event) => event.stopPropagation()}>
            {editing && editor ? editor : children}
          </div>
        </>
      )}
    </section>
  )
}
