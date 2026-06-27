import { type ComponentProps, type ReactNode } from 'react'
import { cn } from '../../lib/cn'

type BadgeColor = 'green' | 'amber' | 'red' | 'slate'

interface BadgeProps extends ComponentProps<'span'> {
  color?: BadgeColor
  children: ReactNode
}

const colorClass: Record<BadgeColor, string> = {
  green: 'bg-emerald-100 text-emerald-800',
  amber: 'bg-amber-100 text-amber-800',
  red: 'bg-red-100 text-red-800',
  slate: 'bg-slate-100 text-slate-500',
}

export function Badge({
  color = 'slate',
  children,
  className,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-full px-3 text-xs font-bold uppercase',
        colorClass[color],
        className
      )}
      {...props}
    >
      {children}
    </span>
  )
}
