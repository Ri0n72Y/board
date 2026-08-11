import { Fragment } from 'react'
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from '@headlessui/react'
import { useTranslation } from 'react-i18next'

interface KeyboardShortcutsDialogProps {
  open: boolean
  onClose: () => void
}

export function KeyboardShortcutsDialog({
  open,
  onClose,
}: KeyboardShortcutsDialogProps) {
  const { t } = useTranslation()

  const shortcuts = [
    { keys: ['⌘K'], label: t('shortcuts.search') },
    { keys: ['N'], label: t('shortcuts.createRecord') },
    { keys: ['B'], label: t('shortcuts.boardView') },
    { keys: ['L'], label: t('shortcuts.listView') },
    { keys: ['?'], label: t('shortcuts.help') },
  ]

  return (
    <Transition appear show={open} as={Fragment}>
      <Dialog
        as="div"
        className="relative z-50"
        onClose={onClose}
      >
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-150 motion-reduce:transition-none"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-100 motion-reduce:transition-none"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-slate-950/30" aria-hidden="true" />
        </TransitionChild>

        <div className="fixed inset-0 flex items-center justify-center p-4">
          <TransitionChild
            as={Fragment}
            enter="ease-out duration-150 motion-reduce:transition-none"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-100 motion-reduce:transition-none"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <DialogPanel className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-5 shadow-2xl">
              <DialogTitle
                as="h2"
                className="text-base font-semibold text-slate-950"
              >
                {t('shortcuts.title')}
              </DialogTitle>

              <ul className="mt-4 grid gap-2">
                {shortcuts.map((shortcut) => (
                  <li
                    key={shortcut.label}
                    className="flex items-center justify-between gap-4"
                  >
                    <span className="text-sm text-slate-600">
                      {shortcut.label}
                    </span>
                    <span className="flex shrink-0 gap-1">
                      {shortcut.keys.map((key) => (
                        <kbd
                          key={key}
                          className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-xs text-slate-500"
                        >
                          {key}
                        </kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                autoFocus
                onClick={onClose}
                className="mt-5 w-full rounded-md border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-emerald-500 hover:bg-emerald-50"
              >
                {t('shortcuts.close')}
              </button>
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  )
}
