import { Field, Label, Select as HuiSelect } from '@headlessui/react'
import { type ComponentProps, forwardRef } from 'react'
import { cn } from '../../lib/cn'

interface SelectProps extends ComponentProps<'select'> {
  label?: string
  options: { value: string; label: string }[]
}

const selectClass =
  'min-h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-normal text-slate-950 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100'

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  function Select({ label, options, className, ...props }, ref) {
    return (
      <Field className="grid gap-1.5">
        {label && (
          <Label className="text-xs font-bold text-slate-500">{label}</Label>
        )}
        <HuiSelect ref={ref} className={cn(selectClass, className)} {...props}>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </HuiSelect>
      </Field>
    )
  }
)
