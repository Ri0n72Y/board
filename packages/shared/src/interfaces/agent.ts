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

// ─── Agent Skill types (2.3) ───

export type AgentSkillSource = 'built-in' | 'project' | 'workspace' | 'server' | 'local'

export interface AgentSkillSummary {
  id: string
  name: string
  description: string
  source: AgentSkillSource
  path: string
  contentHash: string // sha256 hex
  updatedAt?: string
}

export interface AgentSkillDetail extends AgentSkillSummary {
  markdown: string
}

export interface AgentSkillSnapshot {
  id: string
  name: string
  source: AgentSkillSource
  path: string
  contentHash: string
  markdown: string
}

export interface ListAgentSkillsResponse {
  skills: AgentSkillSummary[]
}

export interface GetAgentSkillResponse {
  skill: AgentSkillDetail
}

// ─── Agent Suggestion types (2.3) ───

export type AgentSuggestionStatus = 'generated' | 'reviewed' | 'discarded'

export type AgentSuggestionAuditBudgetStatus = 'passed' | 'blocked'

export type AgentSuggestionAuditValidationStatus = 'passed' | 'failed'

export interface AgentSuggestionAudit {
  providerKind: 'mock' | 'disabled' | 'openai-compatible'
  providerModel: string
  generatedAt: string
  contextHash: string
  contextCharCount: number
  skillCharCount: number
  instructionCharCount: number
  estimatedInputTokens: number
  estimatedOutputTokens?: number
  maxInputChars: number
  maxEstimatedInputTokens: number
  budgetCheckStatus: AgentSuggestionAuditBudgetStatus
  outputValidationStatus: AgentSuggestionAuditValidationStatus
  realProvider: boolean
}

export interface AgentSuggestionSummary {
  id: string
  draftId: string
  title: string
  summary: string
  highlights: string[] // max 5
  status: AgentSuggestionStatus
  createdAt: string
  createdBy: string
  provider: string
  model: string
  contextHash: string
}

export interface AgentSuggestionDetail extends AgentSuggestionSummary {
  markdown: string
  skillSnapshots: AgentSkillSnapshot[]
  diagnostics?: string[]
  audit?: AgentSuggestionAudit
}

export interface CreateAgentSuggestionInput {
  title?: string
  instruction?: string
  skillIds?: string[]
  provider?: string
}

export interface CreateAgentSuggestionResponse {
  suggestion: AgentSuggestionDetail
}

export interface ListAgentSuggestionsResponse {
  suggestions: AgentSuggestionSummary[]
}

export interface GetAgentSuggestionResponse {
  suggestion: AgentSuggestionDetail
}

export interface UpdateAgentSuggestionReviewInput {
  status: AgentSuggestionStatus
}

export interface UpdateAgentSuggestionReviewResponse {
  suggestion: AgentSuggestionDetail
}
