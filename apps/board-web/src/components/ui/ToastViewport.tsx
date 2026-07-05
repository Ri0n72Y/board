import { ToastContainer } from 'react-toastify'
import { APP_TOAST_DEFAULT_OPTIONS } from '../../utils/toasts'

export function ToastViewport() {
  return <ToastContainer {...APP_TOAST_DEFAULT_OPTIONS} />
}
