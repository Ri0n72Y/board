import { toast, type ToastOptions } from 'react-toastify'

export type AppToastId = string
export type AppToastLevel = 'success' | 'info' | 'warning' | 'error'

export const APP_TOAST_IDS = {
  boardHiddenColumns: 'board-hidden-columns',
  currentBoardExport: 'current-board-export',
  contextPackExport: 'context-pack-export',
  snapshotCreate: 'snapshot-create',
  snapshotExport: 'snapshot-export',
} as const satisfies Record<string, AppToastId>

export const APP_TOAST_DEFAULT_OPTIONS: ToastOptions = {
  position: 'bottom-right',
  autoClose: 3000,
  hideProgressBar: true,
  closeOnClick: true,
  pauseOnFocusLoss: false,
  pauseOnHover: true,
}

interface AppToastOptions {
  toastId?: AppToastId
  autoClose?: ToastOptions['autoClose']
}

function buildOptions(options?: AppToastOptions): ToastOptions {
  return {
    ...APP_TOAST_DEFAULT_OPTIONS,
    ...(options?.toastId ? { toastId: options.toastId } : {}),
    ...(options?.autoClose !== undefined ? { autoClose: options.autoClose } : {}),
  }
}

export function appToast(
  level: AppToastLevel,
  message: string,
  options?: AppToastOptions
) {
  return toast[level](message, buildOptions(options))
}

export function toastSuccess(message: string, toastId?: AppToastId) {
  return appToast('success', message, { toastId })
}

export function toastInfo(message: string, toastId?: AppToastId) {
  return appToast('info', message, { toastId })
}

export function toastWarning(message: string, toastId?: AppToastId) {
  return appToast('warning', message, { toastId })
}

export function toastError(message: string, toastId?: AppToastId) {
  return appToast('error', message, { toastId, autoClose: 5000 })
}

export function dismissToast(toastId?: AppToastId) {
  toast.dismiss(toastId)
}
