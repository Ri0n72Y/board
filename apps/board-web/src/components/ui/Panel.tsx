import { type ReactNode } from 'react'
import { cn } from '../../lib/cn'

interface PanelProps {
  children: ReactNode
  className?: string
}

export function Panel({ children, className }: PanelProps) {
  return (
    <section
      className={cn(
        'rounded-lg border border-slate-200 bg-white p-5',
        className
      )}
    >
      {children}
    </section>
  )
}
