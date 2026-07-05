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
  description: string
  tags: TagDefinition[]
}

export function TagConfigReadOnlyPanel({
  config,
  isLoading,
  error,
}: TagConfigReadOnlyPanelProps) {
  const { i18n } = useTranslation()
  const lang = i18n.resolvedLanguage
  const copy = getCopy(lang)
  const tagGroups = config ? buildTagGroups(config, copy) : []
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
            <SummaryStat label={copy.excludedSnapshotTags} value={config.snapshot.excludeTags.length} />
          </div>

          <ReadOnlyCard
            title={copy.namespaces}
            description={copy.namespacesDescription}
          >
            {config.tags.namespaces.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {config.tags.namespaces.map((namespace) => (
                  <NamespaceChip
                    key={namespace.id}
                    namespace={namespace}
                    lockedLabel={copy.locked}
                  />
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400">{copy.noItems}</p>
            )}
          </ReadOnlyCard>

          <div className="grid gap-3">
            {tagGroups.map((group) => (
              <ReadOnlyCard
                key={group.key}
                title={group.title}
                description={group.description}
              >
                {group.tags.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {group.tags.map((tag) => (
                      <TagChip
                        key={tag.id}
                        tag={tag}
                        lang={lang}
                        lockedLabel={copy.locked}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">{copy.noItems}</p>
                )}
              </ReadOnlyCard>
            ))}
          </div>

          {config.snapshot.excludeTags.length > 0 && (
            <ReadOnlyCard
              title={copy.excludedSnapshotTags}
              description={copy.excludedSnapshotTagsDescription}
            >
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

function ReadOnlyCard({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="grid gap-2 rounded-md border border-slate-100 bg-slate-50 p-3">
      <div className="grid gap-0.5">
        <h4 className="text-xs font-semibold uppercase text-slate-500">{title}</h4>
        <p className="text-[11px] text-slate-400">{description}</p>
      </div>
      {children}
    </div>
  )
}

function NamespaceChip({
  namespace,
  lockedLabel,
}: {
  namespace: TagNamespaceConfig
  lockedLabel: string
}) {
  return (
    <span
      className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700"
      title={namespace.id}
    >
      <span className="truncate">{namespace.displayName ?? namespace.id}</span>
      <code className="text-[10px] font-normal text-slate-400">{namespace.id}</code>
      {namespace.locked && (
        <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
          {lockedLabel}
        </span>
      )}
    </span>
  )
}

function TagChip({
  tag,
  lang,
  lockedLabel,
}: {
  tag: TagDefinition
  lang: string
  lockedLabel: string
}) {
  return (
    <span
      className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700"
      title={tag.id}
    >
      <span className="truncate">{tag.displayName ?? formatTagLabel(tag.id, lang)}</span>
      <code className="text-[10px] font-normal text-slate-400">{tag.id}</code>
      {tag.locked && (
        <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
          {lockedLabel}
        </span>
      )}
    </span>
  )
}

function buildTagGroups(config: BoardConfig, copy: TagConfigCopy): TagGroupView[] {
  return [
    {
      key: 'status-required',
      title: copy.statusRequired,
      description: copy.statusRequiredDescription,
      tags: config.tags.status.required,
    },
    {
      key: 'status-custom',
      title: copy.statusCustom,
      description: copy.statusCustomDescription,
      tags: config.tags.status.custom,
    },
    {
      key: 'priority-defaults',
      title: copy.priorityDefaults,
      description: copy.priorityDefaultsDescription,
      tags: config.tags.priority.defaults,
    },
    {
      key: 'priority-custom',
      title: copy.priorityCustom,
      description: copy.priorityCustomDescription,
      tags: config.tags.priority.custom,
    },
    {
      key: 'asset-defaults',
      title: copy.assetDefaults,
      description: copy.assetDefaultsDescription,
      tags: config.tags.asset.defaults,
    },
    {
      key: 'asset-custom',
      title: copy.assetCustom,
      description: copy.assetCustomDescription,
      tags: config.tags.asset.custom,
    },
    {
      key: 'transaction-defaults',
      title: copy.transactionDefaults,
      description: copy.transactionDefaultsDescription,
      tags: config.tags.transaction.defaults,
    },
    {
      key: 'transaction-custom',
      title: copy.transactionCustom,
      description: copy.transactionCustomDescription,
      tags: config.tags.transaction.custom,
    },
    {
      key: 'custom',
      title: copy.customTags,
      description: copy.customTagsDescription,
      tags: config.tags.custom,
    },
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
  namespacesDescription: string
  excludedSnapshotTags: string
  excludedSnapshotTagsDescription: string
  noItems: string
  locked: string
  statusRequired: string
  statusRequiredDescription: string
  statusCustom: string
  statusCustomDescription: string
  priorityDefaults: string
  priorityDefaultsDescription: string
  priorityCustom: string
  priorityCustomDescription: string
  assetDefaults: string
  assetDefaultsDescription: string
  assetCustom: string
  assetCustomDescription: string
  transactionDefaults: string
  transactionDefaultsDescription: string
  transactionCustom: string
  transactionCustomDescription: string
  customTags: string
  customTagsDescription: string
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
      namespacesDescription: '配置中声明的标签命名空间。',
      excludedSnapshotTags: '快照排除标签',
      excludedSnapshotTagsDescription: '创建快照时会被排除的标签。',
      noItems: '无配置项。',
      locked: '锁定',
      statusRequired: '状态 / 必填',
      statusRequiredDescription: '记录必须具备的状态标签集合。',
      statusCustom: '状态 / 自定义',
      statusCustomDescription: '额外配置的状态标签。',
      priorityDefaults: '优先级 / 默认',
      priorityDefaultsDescription: '默认优先级标签集合。',
      priorityCustom: '优先级 / 自定义',
      priorityCustomDescription: '额外配置的优先级标签。',
      assetDefaults: '资产 / 默认',
      assetDefaultsDescription: '默认资产标签集合。',
      assetCustom: '资产 / 自定义',
      assetCustomDescription: '额外配置的资产标签。',
      transactionDefaults: '事务 / 默认',
      transactionDefaultsDescription: '默认事务标签集合。',
      transactionCustom: '事务 / 自定义',
      transactionCustomDescription: '额外配置的事务标签。',
      customTags: '其他自定义标签',
      customTagsDescription: '不属于状态、优先级、资产或事务分组的标签。',
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
    namespacesDescription: 'Tag namespaces declared by the current config.',
    excludedSnapshotTags: 'Snapshot excluded tags',
    excludedSnapshotTagsDescription: 'Tags excluded when snapshots are created.',
    noItems: 'No configured items.',
    locked: 'Locked',
    statusRequired: 'Status / Required',
    statusRequiredDescription: 'Status tags required on records.',
    statusCustom: 'Status / Custom',
    statusCustomDescription: 'Additional configured status tags.',
    priorityDefaults: 'Priority / Defaults',
    priorityDefaultsDescription: 'Default priority tags.',
    priorityCustom: 'Priority / Custom',
    priorityCustomDescription: 'Additional configured priority tags.',
    assetDefaults: 'Asset / Defaults',
    assetDefaultsDescription: 'Default asset tags.',
    assetCustom: 'Asset / Custom',
    assetCustomDescription: 'Additional configured asset tags.',
    transactionDefaults: 'Transaction / Defaults',
    transactionDefaultsDescription: 'Default transaction tags.',
    transactionCustom: 'Transaction / Custom',
    transactionCustomDescription: 'Additional configured transaction tags.',
    customTags: 'Other custom tags',
    customTagsDescription: 'Tags outside status, priority, asset, and transaction groups.',
  }
}
