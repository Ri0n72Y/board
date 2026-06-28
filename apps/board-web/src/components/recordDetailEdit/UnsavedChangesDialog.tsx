import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from '@headlessui/react'

interface UnsavedChangesDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel: string
  cancelLabel: string
  onConfirm: () => void
  onCancel: () => void
}

export function UnsavedChangesDialog(props: UnsavedChangesDialogProps) {
  return (
    <Dialog
      open={props.open}
      onClose={props.onCancel}
      className="relative z-[70]"
    >
      <DialogBackdrop className="fixed inset-0 bg-slate-950/40" />
      <div className="fixed inset-0 grid place-items-center p-4">
        <DialogPanel className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-2xl">
          <DialogTitle className="text-base font-semibold text-slate-950">
            {props.title}
          </DialogTitle>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {props.message}
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-700"
              onClick={props.onCancel}
            >
              {props.cancelLabel}
            </button>
            <button
              type="button"
              className="rounded-md bg-slate-950 px-3 py-1.5 text-sm font-semibold text-white"
              onClick={props.onConfirm}
            >
              {props.confirmLabel}
            </button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  )
}
