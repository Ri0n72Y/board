import type { TagDefinition, TagNamespaceConfig } from '../interfaces/tag.js'

/**
 * Archive is a special lifecycle tag, separate from the status namespace.
 * Archived records keep their workflow status and stay in their status column;
 * the lifecycle:archived tag only marks them as archived.
 */
export const ARCHIVED_TAG = 'lifecycle:archived'

export const REQUIRED_TAG_NAMESPACES = [
  {
    id: 'status',
    displayName: 'Status',
    locked: true,
  },
  {
    id: 'priority',
    displayName: 'Priority',
    locked: true,
  },
  {
    id: 'asset',
    displayName: 'Asset',
    locked: true,
  },
  {
    id: 'transaction',
    displayName: 'Transaction',
    locked: false,
  },
  {
    id: 'lifecycle',
    displayName: 'Lifecycle',
    locked: true,
  },
] as const satisfies readonly TagNamespaceConfig[]

export const REQUIRED_STATUS_TAGS = [
  {
    id: 'status:todo',
    displayName: 'todo',
    locked: true,
  },
  {
    id: 'status:doing',
    displayName: 'doing',
    locked: true,
  },
  {
    id: 'status:done',
    displayName: 'done',
    locked: true,
  },
] as const satisfies readonly TagDefinition[]

export const CUSTOM_STATUS_TAGS = [
  {
    id: 'status:backlog',
    displayName: 'backlog',
  },
  {
    id: 'status:blocked',
    displayName: 'blocked',
  },
] as const satisfies readonly TagDefinition[]

export const DEFAULT_PRIORITY_TAGS = [
  {
    id: 'priority:urgent-important',
    displayName: '紧急重要',
  },
  {
    id: 'priority:urgent-not-important',
    displayName: '紧急不重要',
  },
  {
    id: 'priority:not-urgent-important',
    displayName: '重要不紧急',
  },
  {
    id: 'priority:not-urgent-not-important',
    displayName: '不重要不紧急',
  },
] as const satisfies readonly TagDefinition[]

export const DEFAULT_ASSET_TAGS = [
  {
    id: 'asset:image',
    displayName: '图片',
  },
  {
    id: 'asset:preset',
    displayName: '预设',
  },
  {
    id: 'asset:model',
    displayName: '模型',
  },
  {
    id: 'asset:audio',
    displayName: '音频',
  },
  {
    id: 'asset:document',
    displayName: '文档',
  },
  {
    id: 'asset:config',
    displayName: '配置',
  },
] as const satisfies readonly TagDefinition[]

export const DEFAULT_TRANSACTION_TAGS = [
  {
    id: 'transaction:meeting',
    displayName: '会议',
  },
  {
    id: 'transaction:ai',
    displayName: 'AI操作',
  },
  {
    id: 'transaction:bulk',
    displayName: '批量操作',
  },
  {
    id: 'transaction:manual',
    displayName: '手动操作',
  },
] as const satisfies readonly TagDefinition[]
