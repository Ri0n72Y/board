/**
 * Context pack i18n templates.
 *
 * Maps locale → built-in template strings. Only L2 headings and static
 * instructional text are translated. Record data (titles, descriptions,
 * tags, ids) is never translated.
 */

export type ContextPackLocale = 'en-US' | 'zh-CN'

function normalizeLocale(locale?: string): ContextPackLocale {
  if (locale === 'zh-CN') return 'zh-CN'
  return 'en-US'
}

interface ContextPackStrings {
  // Context pack header
  title: string
  contextMetadata: string
  agentReadingInstructions: string
  scope: string
  knownLimitations: string

  // Metadata labels
  profile: string
  source: string
  level: string
  generatedAt: string
  recordCount: string
  projectionStatus: string
  snapshotId: string
  filters: string
  contextGoal: string
  profileDescription: string
  centerRecordId: string
  sprintTag: string
  snapshotCreatedAt: string
  snapshotReason: string

  // Agent reading instructions
  noExecutionAuth: string
  keepUuidRelations: string

  // Scope
  includedRecords: string
  includedRelations: string
  includedAssets: string
  includedDiagnostics: string
  excluded: string
  excludedByOption: string

  // Known limitations
  notLiveSession: string
  noToolPermission: string
  snapshotStatic: string
  currentBoardDynamic: string

  // Board export headers
  boardExportTitle: string
  snapshotExportTitle: string
  exportMetadata: string
  howToUse: string
  boardSummary: string
  statusOverview: string
  sprintOverview: string
  status: string
  sprint: string
  recordsByStatus: string
  record: string
  relatedRecords: string
  sprintExport: string
  relationsGraph: string
  assetsIndex: string
  diagnostics: string

  // Status labels
  totalBaseRecords: string
  visibleCurrentRecords: string
  exportedRecords: string
  archivedRecords: string
  blockedRecords: string
  snapshotHeadVersion: string

  // Record fields
  id: string
  pid: string
  schema: string
  assignee: string
  tags: string
  assets: string
  relations: string
  description: string
  rawId: string
  constraint: string
  targetId: string
  relationDescription: string
  content: string
  unassigned: string
  none: string
  noAssets: string
  noRelations: string
  noRecords: string
  noDiagnostics: string
  noRelatedRecords: string
  recordNotFound: string
  noRelationsExported: string
  uncategorized: string
  relationConstraintLabels: Record<string, string>
}

const EN: ContextPackStrings = {
  title: '# LabourBoard Agent Context Pack',
  contextMetadata: '## Context Metadata',
  agentReadingInstructions: '## Agent Reading Instructions',
  scope: '## Scope',
  knownLimitations: '## Known Limitations',

  profile: 'Profile',
  source: 'Source',
  level: 'Level',
  generatedAt: 'Generated At',
  recordCount: 'Record Count',
  projectionStatus: 'Projection Status',
  snapshotId: 'Snapshot ID',
  filters: 'Filters',
  contextGoal: 'Context Goal',
  profileDescription: 'Profile Description',
  centerRecordId: 'Center Record ID',
  sprintTag: 'Sprint Tag',
  snapshotCreatedAt: 'Snapshot Created At',
  snapshotReason: 'Snapshot Reason',

  noExecutionAuth: 'This file is not execution authorization. Do not mutate the board based on this file alone; patch/edit/move operations must still go through LabourBoard APIs and human confirmation.',
  keepUuidRelations: 'Keep relation targets as UUID record ids. Public pids such as CARD-n are labels for reading, not relation targets.',

  includedRecords: 'Included records',
  includedRelations: 'Included relations',
  includedAssets: 'Included assets',
  includedDiagnostics: 'Included diagnostics',
  excluded: 'Excluded',
  excludedByOption: 'excluded by option',

  notLiveSession: 'This context is a Markdown export, not a live agent session.',
  noToolPermission: 'It does not include permission to call tools, apply patches, restore snapshots, or perform writes.',
  snapshotStatic: 'Snapshot source is a static checkpoint and does not change with the current board.',
  currentBoardDynamic: 'Current-board source is a dynamic projection generated at request time.',

  boardExportTitle: 'LabourBoard Current Board Export',
  snapshotExportTitle: 'LabourBoard Snapshot Export',
  exportMetadata: '## Export Metadata',
  howToUse: '## How To Use This Context\nThis file is a structured project board export for agent reading. Records are grouped by status. Use pid/id/tags/assets/relations to reason about dependencies and sprint scope.',
  boardSummary: '## Board Summary',
  statusOverview: '## Status Overview',
  sprintOverview: '## Sprint Overview',
  status: 'Status',
  sprint: 'Sprint',
  recordsByStatus: '## Records By Status',
  record: '## Record',
  relatedRecords: '## Related Records',
  sprintExport: '## Sprint Export',
  relationsGraph: '## Relations / Requirement Graph',
  assetsIndex: '## Assets Index',
  diagnostics: '## Diagnostics',

  totalBaseRecords: 'Total base records',
  visibleCurrentRecords: 'Visible current records',
  exportedRecords: 'Exported records',
  archivedRecords: 'Archived records',
  blockedRecords: 'Blocked records',
  snapshotHeadVersion: 'Snapshot head version',

  id: 'id',
  pid: 'pid',
  schema: 'schema',
  assignee: 'assignee',
  tags: 'tags',
  assets: 'assets',
  relations: 'relations',
  description: 'description',
  rawId: 'raw id',
  constraint: 'constraint',
  targetId: 'target id',
  relationDescription: 'description',
  content: 'content',
  unassigned: 'unassigned',
  none: 'none',
  noAssets: 'No assets in exported records.',
  noRelations: 'No relations in exported records.',
  noRecords: 'No records in this export.',
  noDiagnostics: 'No diagnostics.',
  noRelatedRecords: 'No related records in this export.',
  recordNotFound: 'Record not found.',
  noRelationsExported: 'No relations in exported records.',
  uncategorized: 'uncategorized',
  relationConstraintLabels: {
    dependsOn: 'Depends on',
    blocks: 'Blocks',
    blockedBy: 'Blocked by',
    relatedTo: 'Related to',
    relatesTo: 'Relates to',
    duplicates: 'Duplicates',
    parentOf: 'Parent of',
    childOf: 'Child of',
    contains: 'Contains',
    supports: 'Supports',
    implementedBy: 'Implemented by',
  },
}

const ZH: ContextPackStrings = {
  title: '# LabourBoard Agent 上下文包',
  contextMetadata: '## 上下文元数据',
  agentReadingInstructions: '## Agent 阅读指南',
  scope: '## 范围',
  knownLimitations: '## 已知限制',

  profile: '配置',
  source: '来源',
  level: '级别',
  generatedAt: '生成时间',
  recordCount: '记录数',
  projectionStatus: '投影状态',
  snapshotId: '快照 ID',
  filters: '筛选条件',
  contextGoal: '上下文目标',
  profileDescription: '配置描述',
  centerRecordId: '中心记录 ID',
  sprintTag: '迭代标签',
  snapshotCreatedAt: '快照创建时间',
  snapshotReason: '快照原因',

  noExecutionAuth: '此文件不是执行授权。请勿仅凭此文件修改看板；补丁/编辑/移动操作仍须通过 LabourBoard API 和人工确认。',
  keepUuidRelations: '关联目标请保持 UUID 记录 ID。CARD-n 等公开 pid 为阅读标签，非关联目标。',

  includedRecords: '包含的记录',
  includedRelations: '包含的关联',
  includedAssets: '包含的资产',
  includedDiagnostics: '包含的诊断',
  excluded: '排除',
  excludedByOption: '按选项排除',

  notLiveSession: '此上下文是 Markdown 导出，不是实时 Agent 会话。',
  noToolPermission: '不包含调用工具、应用补丁、恢复快照或执行写入的权限。',
  snapshotStatic: '快照来源是静态检查点，不随当前看板变化。',
  currentBoardDynamic: '当前看板来源是请求时生成的动态投影。',

  boardExportTitle: 'LabourBoard 当前看板导出',
  snapshotExportTitle: 'LabourBoard 快照导出',
  exportMetadata: '## 导出元数据',
  howToUse: '## 如何使用此上下文\n此文件为结构化项目看板导出，供 Agent 阅读。记录按状态分组。请使用 pid/id/tags/assets/relations 分析依赖和迭代范围。',
  boardSummary: '## 看板摘要',
  statusOverview: '## 状态概览',
  sprintOverview: '## 迭代概览',
  status: '状态',
  sprint: '迭代',
  recordsByStatus: '## 按状态排列的记录',
  record: '## 记录',
  relatedRecords: '## 相关记录',
  sprintExport: '## 迭代导出',
  relationsGraph: '## 关联 / 需求图谱',
  assetsIndex: '## 资产索引',
  diagnostics: '## 诊断',

  totalBaseRecords: '基础记录总数',
  visibleCurrentRecords: '可见当前记录',
  exportedRecords: '导出记录数',
  archivedRecords: '已归档记录',
  blockedRecords: '已阻塞记录',
  snapshotHeadVersion: '快照头版本',

  id: 'id',
  pid: 'pid',
  schema: '模式',
  assignee: '负责人',
  tags: '标签',
  assets: '资产',
  relations: '关联',
  description: '描述',
  rawId: '原始 ID',
  constraint: '约束',
  targetId: '目标 ID',
  relationDescription: '说明',
  content: '内容',
  unassigned: '未分配',
  none: '无',
  noAssets: '导出记录中无资产。',
  noRelations: '导出记录中无关联。',
  noRecords: '此导出中无记录。',
  noDiagnostics: '无诊断信息。',
  noRelatedRecords: '此导出中无相关记录。',
  recordNotFound: '未找到记录。',
  noRelationsExported: '导出记录中无关联。',
  uncategorized: '未分类',
  relationConstraintLabels: {
    dependsOn: '依赖',
    blocks: '阻塞',
    blockedBy: '被阻塞',
    relatedTo: '相关',
    relatesTo: '相关',
    duplicates: '重复',
    parentOf: '父级',
    childOf: '子级',
    contains: '包含',
    supports: '支持',
    implementedBy: '实现于',
  },
}

const STRINGS: Record<ContextPackLocale, ContextPackStrings> = {
  'en-US': EN,
  'zh-CN': ZH,
}

export function getContextPackStrings(locale?: string): ContextPackStrings {
  return STRINGS[normalizeLocale(locale)]
}

export { normalizeLocale }
