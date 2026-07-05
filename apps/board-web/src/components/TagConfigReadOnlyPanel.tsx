import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type {
  BoardConfig,
  TagDefinition,
  TagNamespaceConfig,
} from '@labour-board/shared'
import { formatTagLabel } from '../utils/tagDisplay'

interface TagConfigReadOnlyPanelProps {
  config: BoardConfig | null
  isLoading: boolean
  error: string | null
}

interface TagGroupView {
  key: string
  title: string
  tags: TagDefinition[]
}

export function TagConfigReadOnlyPanel({
  config,
  isLoading,
  error,
}: TagConfigReadOnlyPanelProps) {
  const { i18n } = useTranslation()
  const lang = i18n.resolvedLanguage ?? i18n.language ?? 'en-US'
  const copy = getCopy(lang)
  const tagGroups = config ? buildTagGroups(config, copy.groups) : []
  const tagCount = tagGroups.reduce((total, group) => total + group.tags.length, 0)

  return (
    <section
      className="mt-4 grid gap-3 rounded-lg border border-slate-200 bg-white p-5"
      data-testid="tag-config-readonly"
    >
      <div className="grid gap-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold uppercase text-slate-500">
            {copy.title}
          </h3>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
            {copy.readOnly}
          </span>
        </div>
        <p className="text-xs text-slate-500">{copy.hint}</p>
      </div>

      {isLoading && <p className="text-sm text-slate-500">{copy.loading}</p>}
      {!isLoading && error && (
        <p
          className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"
          role="alert"
        >
          {copy.error}: {error}
        </p>
      )}
      {!isLoading && !config && !error && (
        <p className="text-sm text-slate-500">{copy.empty}</p>
      )}

      {config && (
        <div className="grid gap-3">
          <div className="grid gap-2 rounded-md border border-slate-100 bg-slate-50 p-3 sm:grid-cols-3">
            <SummaryStat label={copy.tags} value={tagCount} />
            <SummaryStat label={copy.namespaces} value={config.tags.namespaces.length} />
            <SummaryStat label={copy.snapshotExcluded} value={config.snapshot.excludeTags.length} />
          </div>

          <ReadOnlyCard title={copy.namespaces}>
            <NamespaceList
              items={config.tags.namespaces}
              emptyLabel={copy.noItems}
              lockedLabel={copy.locked}
            />
          </ReadOnlyCard>

          {tagGroups.map((group) => (
            <ReadOnlyCard key={group.key} title={group.title}>
              <TagList
                items={group.tags}
                lang={lang}
                emptyLabel={copy.noItems}
                lockedLabel={copy.locked}
              />
            </ReadOnlyCard>
          ))}

          {config.snapshot.excludeTags.length > 0 && (
            <ReadOnlyCard title={copy.snapshotExcluded}>
              <div className="flex flex-wrap gap-2">
                {config.snapshot.excludeTags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700"
                    title={tag}
                  >
                    {formatTagLabel(tag, lang)}
                  </span>
                ))}
              </div>
            </ReadOnlyCard>
          )}
        </div>
      )}
    </section>
  )
}

function SummaryStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="grid gap-0.5">
      <span className="text-[11px] font-medium uppercase text-slate-400">
        {label}
      </span>
      <span className="text-lg font-semibold text-slate-800">{value}</span>
    </div>
  )
}

function ReadOnlyCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="grid gap-2 rounded-md border border-slate-100 bg-slate-50 p-3">
      <h4 className="text-xs font-semibold uppercase text-slate-500">{title}</h4>
      {children}
    </div>
  )
}

function NamespaceList({
  items,
  emptyLabel,
  lockedLabel,
}: {
  items: TagNamespaceConfig[]
  emptyLabel: string
  lockedLabel: string
}) {
  if (items.length === 0) return <EmptyText>{emptyLabel}</EmptyText>
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((namespace) => (
        <span
          key={namespace.id}
          className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700"
          title={namespace.id}
        >
          <span className="truncate">{namespace.displayName ?? namespace.id}</span>
          <code className="text-[10px] font-normal text-slate-400">
            {namespace.id}
          </code>
          {namespace.locked && <LockPill>{lockedLabel}</LockPill>}
        </span>
      ))}
    </div>
  )
}

function TagList({
  items,
  lang,
  emptyLabel,
  lockedLabel,
}: {
  items: TagDefinition[]
  lang: string
  emptyLabel: string
  lockedLabel: string
}) {
  if (items.length === 0) return <EmptyText>{emptyLabel}</EmptyText>
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((tag) => (
        <span
          key={tag.id}
          className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700"
          title={tag.id}
        >
          <span className="truncate">
            {tag.displayName ?? formatTagLabel(tag.id, lang)}
          </span>
          <code className="text-[10px] font-normal text-slate-400">
            {tag.id}
          </code>
          {tag.locked && <LockPill>{lockedLabel}</LockPill>}
        </span>
      ))}
    </div>
  )
}

function EmptyText({ children }: { children: ReactNode }) {
  return <p className="text-xs text-slate-400">{children}</p>
}

function LockPill({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
      {children}
    </span>
  )
}

function buildTagGroups(
  config: BoardConfig,
  labels: TagConfigCopy['groups']
): TagGroupView[] {
  return [
    { key: 'status-required', title: labels.statusRequired, tags: config.tags.status.required },
    { key: 'status-custom', title: labels.statusCustom, tags: config.tags.status.custom },
    { key: 'priority-defaults', title: labels.priorityDefaults, tags: config.tags.priority.defaults },
    { key: 'priority-custom', title: labels.priorityCustom, tags: config.tags.priority.custom },
    { key: 'asset-defaults', title: labels.assetDefaults, tags: config.tags.asset.defaults },
    { key: 'asset-custom', title: labels.assetCustom, tags: config.tags.asset.custom },
    { key: 'transaction-defaults', title: labels.transactionDefaults, tags: config.tags.transaction.defaults },
    { key: 'transaction-custom', title: labels.transactionCustom, tags: config.tags.transaction.custom },
    { key: 'custom', title: labels.customTags, tags: config.tags.custom },
  ]
}

interface TagConfigCopy {
  title: string
  hint: string
  readOnly: string
  loading: string
  error: string
  empty: string
  tags: string
  namespaces: string
  snapshotExcluded: string
  noItems: string
  locked: string
  groups: {
    statusRequired: string
    statusCustom: string
    priorityDefaults: string
    priorityCustom: string
    assetDefaults: string
    assetCustom: string
    transactionDefaults: string
    transactionCustom: string
    customTags: string
  }
}

function getCopy(lang: string): TagConfigCopy {
  if (lang.startsWith('zh')) {
    return {
      title: '标签配置',
      hint: '只读查看当前看板配置中的标签命名空间、系统标签和自定义标签。',
      readOnly: '只读',
      loading: '正在加载标签配置...',
      error: '标签配置加载失败',
      empty: '当前没有可显示的标签配置。',
      tags: '标签',
      namespaces: '命名空间',
      snapshotExcluded: '快照排除标签',
      noItems: '无配置项。',
      locked: '锁定',
      groups: {
        statusRequired: '状态 / 必填',
        statusCustom: '状态 / 自定义',
        priorityDefaults: '优先级 / 默认',
        priorityCustom: '优先级 / 自定义',
        assetDefaults: '资产 / 默认',
        assetCustom: '资产 / 自定义',
        transactionDefaults: '事务 / 默认',
        transactionCustom: '事务 / 自定义',
        customTags: '其他自定义标签',
      },
    }
  }

  return {
    title: 'Tag configuration',
    hint: 'Read-only overview of tag namespaces, system tags, and custom tags in the current board config.',
    readOnly: 'Read-only',
    loading: 'Loading tag configuration...',
    error: 'Tag configuration failed to load',
    empty: 'No tag configuration is available.',
    tags: 'Tags',
    namespaces: 'Namespaces',
    snapshotExcluded: 'Snapshot excluded tags',
    noItems: 'No configured items.',
    locked: 'Locked',
    groups: {
      statusRequired: 'Status / Required',
      statusCustom: 'Status / Custom',
      priorityDefaults: 'Priority / Defaults',
      priorityCustom: 'Priority / Custom',
      assetDefaults: 'Asset / Defaults',
      assetCustom: 'Asset / Custom',
      transactionDefaults: 'Transaction / Defaults',
      transactionCustom: 'Transaction / Custom',
      customTags: 'Other custom tags',
    },
  }
}
