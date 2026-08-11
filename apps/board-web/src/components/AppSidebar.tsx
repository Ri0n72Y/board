import { useTranslation } from 'react-i18next'
import {
  Squares2X2Icon,
  ChatBubbleLeftRightIcon,
  CameraIcon,
  FolderIcon,
  ArrowDownTrayIcon,
  ExclamationTriangleIcon,
  Cog6ToothIcon,
  MagnifyingGlassIcon,
  UsersIcon,
} from '@heroicons/react/20/solid'
import { cn } from '../lib/cn'

interface AppSidebarProps {
  issuesCount: number
  issuesActive: boolean
  exportDisabled: boolean
  contextDisabled: boolean
  onToggleIssues: () => void
  onOpenAgentDrafts: () => void
  onOpenSnapshots: () => void
  onOpenContextPack: () => void
  onExportCurrent: () => void
  onOpenSettings: () => void
  onOpenSearch: () => void
  onOpenMembers: () => void
}

function SidebarItem({
  icon,
  label,
  active = false,
  pressed = false,
  disabled = false,
  badge,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  active?: boolean
  pressed?: boolean
  disabled?: boolean
  badge?: number
  onClick?: () => void
}) {
  const selected = active || pressed
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      aria-pressed={pressed ? true : undefined}
      className={cn(
        `flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors`,
        selected
          ? 'bg-slate-200/70 font-medium text-slate-950'
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950',
        disabled && 'cursor-not-allowed opacity-40 hover:bg-transparent'
      )}
    >
      <span className="h-4 w-4 shrink-0" aria-hidden="true">
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {typeof badge === 'number' && badge > 0 && (
        <span className="shrink-0 rounded-full bg-red-100 px-1.5 text-[11px] font-semibold text-red-700">
          {badge}
        </span>
      )}
    </button>
  )
}

function SidebarGroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-2.5 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
      {children}
    </p>
  )
}

export function AppSidebar({
  issuesCount,
  issuesActive,
  exportDisabled,
  contextDisabled,
  onToggleIssues,
  onOpenAgentDrafts,
  onOpenSnapshots,
  onOpenContextPack,
  onExportCurrent,
  onOpenSettings,
  onOpenSearch,
  onOpenMembers,
}: AppSidebarProps) {
  const { t } = useTranslation()

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="flex h-16 shrink-0 items-center gap-2 border-b border-slate-200 px-4">
        <span className="flex h-6 w-6 items-center justify-center rounded bg-emerald-600 text-xs font-bold text-white">
          LB
        </span>
        <span className="truncate text-sm font-bold text-slate-950">
          {t('header.appTitle')}
        </span>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        <div className="relative mb-2">
          <MagnifyingGlassIcon
            className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <button
            type="button"
            onClick={onOpenSearch}
            className="flex h-8 w-full items-center rounded-md border border-slate-200 bg-slate-50 pl-8 pr-2 text-sm text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-700"
          >
            <span className="min-w-0 flex-1 truncate text-left">
              {t('sidebar.search')}
            </span>
            <kbd className="shrink-0 rounded border border-slate-200 bg-white px-1 text-[10px] font-medium text-slate-400">
              ⌘K
            </kbd>
          </button>
        </div>

        <SidebarGroupLabel>{t('sidebar.workspace')}</SidebarGroupLabel>
        <SidebarItem
          icon={<Squares2X2Icon className="h-4 w-4" />}
          label={t('sidebar.board')}
          active
        />

        <SidebarGroupLabel>{t('sidebar.actions')}</SidebarGroupLabel>
        <SidebarItem
          icon={<ChatBubbleLeftRightIcon className="h-4 w-4" />}
          label={t('header.agentDrafts')}
          onClick={onOpenAgentDrafts}
        />
        <SidebarItem
          icon={<CameraIcon className="h-4 w-4" />}
          label={t('header.snapshots')}
          onClick={onOpenSnapshots}
        />
        <SidebarItem
          icon={<FolderIcon className="h-4 w-4" />}
          label={t('header.contextPack')}
          disabled={contextDisabled}
          onClick={onOpenContextPack}
        />
        <SidebarItem
          icon={<ArrowDownTrayIcon className="h-4 w-4" />}
          label={t('header.exportCurrentBoard')}
          disabled={exportDisabled}
          onClick={onExportCurrent}
        />
        <SidebarItem
          icon={<ExclamationTriangleIcon className="h-4 w-4" />}
          label={t('sidebar.issues')}
          pressed={issuesActive}
          badge={issuesCount}
          onClick={onToggleIssues}
        />
      </nav>

      <div className="shrink-0 border-t border-slate-200 px-3 py-2">
        <SidebarItem
          icon={<UsersIcon className="h-4 w-4" />}
          label={t('sidebar.members')}
          onClick={onOpenMembers}
        />
        <SidebarItem
          icon={<Cog6ToothIcon className="h-4 w-4" />}
          label={t('header.settings')}
          onClick={onOpenSettings}
        />
      </div>
    </aside>
  )
}
