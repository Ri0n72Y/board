import { Field, Label, Switch } from '@headlessui/react'
import { cn } from '../../lib/cn'

interface SwitchFieldProps {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  className?: string
}

export function SwitchField({ label, checked, onChange, className }: SwitchFieldProps) {
  return (
    <Field className={cn('flex items-center gap-2', className)}>
      <Switch
        checked={checked}
        onChange={onChange}
        className={cn(
          'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-emerald-100',
          checked ? 'bg-emerald-600' : 'bg-slate-300'
        )}
      >
        <span
          className={cn(
            'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-4' : 'translate-x-0'
          )}
        />
      </Switch>
      <Label className="text-xs font-bold text-slate-500 cursor-pointer">
        {label}
      </Label>
    </Field>
  )
}
