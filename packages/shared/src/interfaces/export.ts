import type { BoardCurrentQuery } from './boardCurrent.js'

export type BoardExportFormat = 'markdown'

export type BoardExportSource = 'current-board' | 'snapshot'

export type BoardExportLevel =
  | 'full'
  | 'summary'
  | 'meta'
  | 'card'
  | 'related'
  | 'sprint'
  | 'filtered'

export type AgentContextProfile =
  | 'agent-full'
  | 'agent-sprint'
  | 'agent-filtered'
  | 'agent-card'
  | 'agent-related'
  | 'agent-snapshot'
  | 'human-summary'

export interface BoardExportOptions {
  source: BoardExportSource
  level: BoardExportLevel
  format: BoardExportFormat
  recordId?: string
  sprintTag?: string
  includeDiagnostics?: boolean
  includeRelations?: boolean
  includeAssets?: boolean
  includeContent?: boolean
  filters?: BoardCurrentQuery
  snapshotId?: string
  snapshotCreatedAt?: string
  snapshotReason?: string
  generatedAt?: string
}

export interface BoardContextPackOptions extends Omit<BoardExportOptions, 'level'> {
  profile: AgentContextProfile
  level?: BoardExportLevel
  contextGoal?: string
}

export interface BoardExportResult {
  format: 'markdown'
  filename: string
  content: string
  meta: {
    source: BoardExportSource
    level: BoardExportLevel
    recordCount: number
    generatedAt: string
    sourceSnapshotId?: string
    filters?: Record<string, unknown>
  }
}

export interface BoardContextPackResult extends BoardExportResult {
  meta: BoardExportResult['meta'] & {
    profile: AgentContextProfile
    contextGoal?: string
  }
}
