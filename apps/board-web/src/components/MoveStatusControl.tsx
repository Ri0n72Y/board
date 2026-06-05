import type { Tag } from '@labour-board/shared'
import type { MoveStatusOption } from '../utils/statusMove'

interface MoveStatusControlProps {
  currentStatus: Tag | null
  options: MoveStatusOption[]
  isMoving?: boolean
  error?: string | null
  onMove: (targetStatusTag: Tag) => void
}

export function MoveStatusControl({
  currentStatus,
  options,
  isMoving = false,
  error,
  onMove,
}: MoveStatusControlProps) {
  const availableOptions = options.filter((option) => option.tag !== currentStatus)
  const disabled = isMoving || availableOptions.length === 0

  return (
    <div className="grid gap-1.5">
      <label className="grid gap-1 text-xs font-bold uppercase text-slate-500">
        Move to
        <select
          className="min-h-9 w-full rounded-md border border-slate-200 bg-white px-2.5 text-sm font-medium normal-case text-slate-800 outline-none transition focus:border-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          value=""
          disabled={disabled}
          aria-label="Move to status"
          onChange={(event) => {
            const targetStatusTag = event.currentTarget.value as Tag
            event.currentTarget.value = ''
            if (!targetStatusTag || targetStatusTag === currentStatus) return
            onMove(targetStatusTag)
          }}
        >
          <option value="">
            {isMoving
              ? 'Moving...'
              : availableOptions.length > 0
                ? 'Select status'
                : 'No moves'}
          </option>
          {availableOptions.map((option) => (
            <option key={option.tag} value={option.tag}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  )
}
