import { type ComponentProps, type ReactNode } from 'react'
import { cn } from '../../lib/cn'

interface PanelProps extends ComponentProps<'section'> {
  children: ReactNode
}

export function Panel({ children, className, ...props }: PanelProps) {
  return (
    <section
      className={cn(
        'rounded-lg border border-slate-200 bg-white p-5',
        className
      )}
      {...props}
    >
      {children}
    </section>
  )
}
