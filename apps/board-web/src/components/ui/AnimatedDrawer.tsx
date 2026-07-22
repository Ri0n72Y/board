import { Fragment, type ReactNode } from 'react'
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from '@headlessui/react'
import { XMarkIcon } from '@heroicons/react/20/solid'
import { cn } from '../../lib/cn'
import { Button } from './Button'

export type DrawerSize = 'sm' | 'md' | 'lg' | 'xl'

const SIZE_CLASS: Record<DrawerSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
  xl: 'max-w-5xl',
}

interface AnimatedDrawerProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
  size?: DrawerSize
  closeLabel?: string
  closeDisabled?: boolean
}

export function AnimatedDrawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = 'md',
  closeLabel = 'Close',
  closeDisabled = false,
}: AnimatedDrawerProps) {
  return (
    <Transition appear show={open} as={Fragment}>
      <Dialog
        as="div"
        className="relative z-50"
        onClose={() => {
          if (!closeDisabled) onClose()
        }}
      >
        {/* Backdrop */}
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-slate-950/30" aria-hidden="true" />
        </TransitionChild>

        {/* Panel container */}
        <div className="fixed inset-0 overflow-hidden">
          <div className="flex h-full justify-end">
            <TransitionChild
              as={Fragment}
              enter="transform transition ease-out duration-300"
              enterFrom="translate-x-full"
              enterTo="translate-x-0"
              leave="ease-in duration-200"
              leaveFrom="translate-x-0"
              leaveTo="translate-x-full"
            >
              <DialogPanel
                className={cn(
                  'grid h-full w-full grid-rows-[auto_1fr_auto] overflow-hidden border-l border-slate-200 bg-stone-50 text-slate-950 shadow-xl',
                  SIZE_CLASS[size]
                )}
              >
                {/* Header */}
                <header className="flex min-w-0 items-start justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4">
                  <div className="min-w-0">
                    {subtitle && (
                      <p className="mb-1 text-xs font-bold uppercase text-slate-500">
                        {subtitle}
                      </p>
                    )}
                    <DialogTitle
                      as="h2"
                      className="text-xl font-semibold leading-tight"
                    >
                      {title}
                    </DialogTitle>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={onClose}
                    disabled={closeDisabled}
                    title={closeLabel}
                    icon={<XMarkIcon className="h-4 w-4" />}
                  >
                    {closeLabel}
                  </Button>
                </header>

                {/* Body — scrollable */}
                <div className="min-h-0 overflow-y-auto px-5 py-4">
                  {children}
                </div>

                {/* Footer — sticky */}
                {footer && (
                  <footer className="border-t border-slate-200 bg-white px-5 py-4">
                    {footer}
                  </footer>
                )}
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}
