import type { AgentContextProfile, BoardContextPackOptions, BoardContextPackResult } from './export.js'
import type { BoardCurrentQuery } from './boardCurrent.js'

export type AgentDraftStatus = 'draft' | 'reviewed' | 'discarded'

export type AgentDraftSource = 'current-board' | 'snapshot'

export interface AgentDraftReview {
  status: AgentDraftStatus
  reviewedAt?: string
  reviewedBy?: string
  reviewNote?: string
}

export interface UpdateAgentDraftReviewInput {
  status: AgentDraftStatus
  reviewNote?: string
}

export interface UpdateAgentDraftReviewResponse {
  draft: AgentDraftDetail
}

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
  reviewedAt?: string
  reviewedBy?: string
  reviewNote?: string
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

export interface AgentDraftHandoffOptions {
  generatedAt?: string
}

export interface AgentDraftHandoffResult {
  format: 'markdown'
  filename: string
  content: string
  meta: {
    draftId: string
    draftTitle: string
    profile: AgentContextProfile
    source: AgentDraftSource
    status: AgentDraftStatus
    generatedAt: string
    reviewedAt: string
    reviewedBy: string
    recordCount: number
    snapshotId?: string
  }
}

export interface GetAgentDraftHandoffResponse {
  handoff: AgentDraftHandoffResult
}

// ─── Agent Response types (1.16) ───

export type AgentResponseSource = 'manual-paste'

export interface CreateAgentResponseInput {
  draftId: string
  source: AgentResponseSource
  responseMarkdown: string
  externalAgentName?: string
  responseNote?: string
}

export interface AgentResponseSummary {
  id: string
  draftId: string
  draftTitle: string
  source: AgentResponseSource
  externalAgentName?: string
  pastedAt: string
  pastedBy: string
  responseNote?: string
  responseLength: number
}

export interface AgentResponseDetail extends AgentResponseSummary {
  responseMarkdown: string
  draftSnapshot: {
    id: string
    title: string
    status: AgentDraftStatus
    profile: AgentContextProfile
    source: AgentDraftSource
    reviewedAt: string
    reviewedBy: string
  }
}

export interface CreateAgentResponseResponse {
  response: AgentResponseDetail
}

export interface ListAgentResponsesResponse {
  responses: AgentResponseSummary[]
}

export interface GetAgentResponseResponse {
  response: AgentResponseDetail
}
