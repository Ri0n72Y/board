import { Button as HuiButton } from '@headlessui/react'
import { type ComponentProps, type ReactNode, forwardRef } from 'react'
import { cn } from '../../lib/cn'

type ButtonVariant = 'default' | 'ghost' | 'danger'

interface ButtonProps extends ComponentProps<'button'> {
  variant?: ButtonVariant
  icon?: ReactNode
}

const variantClass: Record<ButtonVariant, string> = {
  default: 'bg-white text-slate-950 hover:border-emerald-700',
  ghost:
    'border-transparent bg-transparent text-slate-400 hover:border-slate-300 hover:text-slate-600',
  danger:
    'border-red-200 bg-red-50 text-red-700 hover:border-red-400 hover:bg-red-100',
}

const base =
  'inline-flex items-center justify-center gap-1.5 min-h-10 rounded-md border border-slate-200 px-3.5 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-60'

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { className, variant = 'default', icon, children, ...props },
    ref
  ) {
    return (
      <HuiButton
        ref={ref}
        className={cn(base, variantClass[variant], className)}
        {...props}
      >
        {icon && <span aria-hidden="true">{icon}</span>}
        {children}
      </HuiButton>
    )
  }
)
