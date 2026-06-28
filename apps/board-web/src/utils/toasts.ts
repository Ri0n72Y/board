import { toast } from 'react-toastify'

const DEFAULT_TOAST_OPTIONS = {
  position: 'bottom-right' as const,
  autoClose: 3000,
  hideProgressBar: true,
  closeOnClick: true,
  pauseOnFocusLoss: false,
  pauseOnHover: true,
}

export function toastSuccess(message: string) {
  return toast.success(message, DEFAULT_TOAST_OPTIONS)
}

export function toastInfo(message: string, toastId?: string) {
  return toast.info(message, {
    ...DEFAULT_TOAST_OPTIONS,
    toastId,
  })
}

export function toastWarning(message: string) {
  return toast.warning(message, DEFAULT_TOAST_OPTIONS)
}

export function toastError(message: string) {
  return toast.error(message, DEFAULT_TOAST_OPTIONS)
}

export function dismissToast(toastId?: string) {
  toast.dismiss(toastId)
}
