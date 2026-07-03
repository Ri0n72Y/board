import { Field, Input, Label } from '@headlessui/react'
import { type ComponentProps, type ReactNode, forwardRef } from 'react'
import { cn } from '../../lib/cn'

interface TextInputProps extends ComponentProps<'input'> {
  label?: string
  icon?: ReactNode
  after?: ReactNode
}

const inputClass =
  'min-h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-normal text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100'

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
  function TextInput({ label, icon, after, className, ...props }, ref) {
    return (
      <Field className="grid gap-1.5">
        {label && (
          <Label className="text-xs font-bold text-slate-500">{label}</Label>
        )}
        <div
          className={cn(
            'relative flex',
            after &&
              'rounded-md border border-slate-200 focus-within:border-emerald-700 focus-within:ring-2 focus-within:ring-emerald-100'
          )}
        >
          {icon && (
            <span className="pointer-events-none absolute left-3 top-1/2 flex h-4 w-4 -translate-y-1/2 items-center justify-center text-slate-400">
              {icon}
            </span>
          )}
          <Input
            ref={ref}
            className={cn(
              inputClass,
              after &&
                'flex-1 rounded-l-md rounded-r-none border-0 outline-none focus:ring-0',
              icon && 'pl-9',
              className
            )}
            {...props}
          />
          {after}
        </div>
      </Field>
    )
  }
)
