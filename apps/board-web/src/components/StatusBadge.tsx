import type { BoardProjectionStatus } from '@labour-board/shared'
import { Badge } from './ui/Badge'

interface StatusBadgeProps {
  status?: BoardProjectionStatus
}

const statusColor: Record<BoardProjectionStatus, 'green' | 'amber' | 'red' | 'slate'> = {
  clean: 'green',
  partial: 'amber',
  blocked: 'red',
  empty: 'amber',
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <Badge color={status ? statusColor[status] : 'slate'}>
      {status ?? 'loading'}
    </Badge>
  )
}
