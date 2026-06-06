import type { AgentContextProfile, BoardContextPackOptions, BoardContextPackResult } from './export.js'
import type { BoardCurrentQuery } from './boardCurrent.js'

export type AgentDraftStatus = 'draft'

export type AgentDraftSource = 'current-board' | 'snapshot'

export interface CreateAgentDraftInput {
  title: string
  profile: AgentContextProfile
  source: AgentDraftSource
  contextGoal?: string
  recordId?: string
  sprintTag?: string
  snapshotId?: string
  filters?: BoardCurrentQuery
  includeContent?: boolean
  includeAssets?: boolean
  includeRelations?: boolean
  includeDiagnostics?: boolean
}

export interface AgentDraftSummary {
  id: string
  title: string
  status: AgentDraftStatus
  profile: AgentContextProfile
  source: AgentDraftSource
  createdAt: string
  createdBy: string
  contextGoal?: string
  recordCount: number
  snapshotId?: string
}

export interface AgentDraftDetail extends AgentDraftSummary {
  contextMarkdown: string
  contextMeta: BoardContextPackResult['meta']
  exportOptions: Omit<BoardContextPackOptions, 'generatedAt'>
}

export interface CreateAgentDraftResponse {
  draft: AgentDraftDetail
}

export interface ListAgentDraftsResponse {
  drafts: AgentDraftSummary[]
}

export interface GetAgentDraftResponse {
  draft: AgentDraftDetail
}
