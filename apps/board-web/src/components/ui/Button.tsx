import { Button as HuiButton } from '@headlessui/react'
import { type ComponentProps, type ReactNode, forwardRef } from 'react'
import { cn } from '../../lib/cn'

type ButtonVariant = 'default' | 'ghost'

interface ButtonProps extends ComponentProps<'button'> {
  variant?: ButtonVariant
  icon?: ReactNode
}

const variantClass: Record<ButtonVariant, string> = {
  default: 'bg-white text-slate-950 hover:border-emerald-700',
  ghost:
    'border-transparent bg-transparent text-slate-400 hover:border-slate-300 hover:text-slate-600',
}

const base =
  'inline-flex items-center justify-center gap-1.5 min-h-10 rounded-md border border-slate-200 px-3.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60'

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
        {icon}
        {children}
      </HuiButton>
    )
  }
)
