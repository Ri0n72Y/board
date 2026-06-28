import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

interface EditableSectionProps {
  title: string
  editing?: boolean
  dirty?: boolean
  disabled?: boolean
  children: ReactNode
  editor?: ReactNode
  onEdit?: () => void
}

export function EditableSection({
  title,
  editing = false,
  dirty = false,
  disabled = false,
  children,
  editor,
  onEdit,
}: EditableSectionProps) {
  return (
    <section
      className={cn(
        'rounded-xl border border-slate-200 bg-white p-4 transition-shadow',
        dirty && 'shadow-[0_0_0_2px_rgba(16,185,129,0.35)]',
        editing && 'border-emerald-300 bg-emerald-50/40',
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {onEdit && !editing && (
          <button
            type="button"
            className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            disabled={disabled}
            onClick={onEdit}
          >
            Edit
          </button>
        )}
      </div>
      {editing && editor ? editor : children}
    </section>
  )
}
