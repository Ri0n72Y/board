import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

interface EditableSectionProps {
  title: string
  editing?: boolean
  dirty?: boolean
  disabled?: boolean
  children: ReactNode
  editor?: ReactNode
  editLabel: string
  onEdit?: () => void
}

export function EditableSection({
  title,
  editing = false,
  dirty = false,
  disabled = false,
  children,
  editor,
  editLabel,
  onEdit,
}: EditableSectionProps) {
  return (
    <section
      className={cn(
        'rounded-lg border border-slate-200 bg-white p-4 transition',
        onEdit && !editing && !disabled && 'cursor-pointer hover:border-emerald-300 hover:bg-emerald-50/20',
        editing && 'border-emerald-300 bg-emerald-50/30',
        dirty && 'shadow-[0_0_0_2px_rgba(16,185,129,0.35)]',
      )}
      onClick={() => {
        if (!editing && !disabled) onEdit?.()
      }}
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="text-xs font-bold uppercase text-slate-500">{title}</h3>
        {onEdit && !editing && (
          <button
            type="button"
            className="rounded-md px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
            disabled={disabled}
            onClick={(event) => {
              event.stopPropagation()
              onEdit()
            }}
          >
            {editLabel}
          </button>
        )}
      </div>
      <div onClick={(event) => event.stopPropagation()}>
        {editing && editor ? editor : children}
      </div>
    </section>
  )
}
