import type {
  BoardCurrentProjection,
  ProjectionDiagnostic,
} from '@labour-board/shared'
import { useTranslation } from 'react-i18next'
import { AnimatedDrawer } from './ui/AnimatedDrawer'
import { IssuesPanel } from './IssuesPanel'

interface IssuesDrawerProps {
  open: boolean
  onClose: () => void
  blockedRecords: BoardCurrentProjection['blockedRecords']
  diagnostics: ProjectionDiagnostic[]
}

export function IssuesDrawer({
  open,
  onClose,
  blockedRecords,
  diagnostics,
}: IssuesDrawerProps) {
  const { t } = useTranslation()

  return (
    <AnimatedDrawer
      open={open}
      onClose={onClose}
      title={t('sidebar.issues')}
      subtitle={t('issues.subtitle')}
      size="md"
      closeLabel={t('issues.close')}
    >
      <IssuesPanel blockedRecords={blockedRecords} diagnostics={diagnostics} />
    </AnimatedDrawer>
  )
}
