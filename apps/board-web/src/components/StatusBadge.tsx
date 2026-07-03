import type { BoardProjectionStatus } from '@labour-board/shared'
import { useTranslation } from 'react-i18next'
import { Badge } from './ui/Badge'

interface StatusBadgeProps {
  status?: BoardProjectionStatus
}

const statusColor: Record<
  BoardProjectionStatus,
  'green' | 'amber' | 'red' | 'slate'
> = {
  clean: 'green',
  partial: 'amber',
  blocked: 'red',
  empty: 'amber',
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const { t } = useTranslation()

  return (
    <Badge color={status ? statusColor[status] : 'slate'}>
      {status ? t(`badge.${status}`) : t('badge.loading')}
    </Badge>
  )
}
