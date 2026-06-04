import {
  ListBulletIcon,
  RectangleGroupIcon,
} from '@heroicons/react/20/solid'
import { cn } from '../lib/cn'

export type BoardViewMode = 'list' | 'board'

interface ViewModeToggleProps {
  value: BoardViewMode
  onChange: (value: BoardViewMode) => void
}

const options: {
  value: BoardViewMode
  label: string
  icon: typeof ListBulletIcon
}[] = [
  { value: 'list', label: 'List View', icon: ListBulletIcon },
  { value: 'board', label: 'Board View', icon: RectangleGroupIcon },
]

export function ViewModeToggle({ value, onChange }: ViewModeToggleProps) {
  return (
    <div
      className="inline-flex min-h-10 rounded-md border border-slate-200 bg-white p-1"
      role="group"
      aria-label="View mode"
    >
      {options.map((option) => {
        const Icon = option.icon
        const selected = value === option.value
        return (
          <button
            key={option.value}
            type="button"
            className={cn(
              'inline-flex items-center justify-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition',
              selected
                ? 'bg-emerald-100 text-emerald-800'
                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700',
            )}
            aria-pressed={selected}
            title={option.label}
            onClick={() => onChange(option.value)}
          >
            <Icon className="h-4 w-4" />
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
