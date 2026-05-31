import type { DeepPartial, PatchItem } from './patch.js'
import type { Profile } from './profile.js'
import type {
  AssetRef,
  PublicKey,
  RecordBody,
  RecordId,
  RecordItem,
  RelationRef,
  SchemaName,
} from './record.js'
import type { Tag } from './tag.js'

export interface ApiError {
  code: string
  message: string
  details?: unknown
}

export type ApiResponse<T> =
  | {
      ok: true
      data: T
    }
  | {
      ok: false
      error: ApiError
    }

export interface RecordQuery {
  id?: RecordId
  pid?: string
  schema?: SchemaName
  tags?: Tag[]
  tagMatch?: 'all' | 'any'
  assignee?: PublicKey
  assetId?: AssetRef
  relationTarget?: RecordId
  includeArchived?: boolean
  q?: string
  limit?: number
  cursor?: string
}

export interface CreateRecordInput<TBody = RecordBody> {
  pidPrefix?: string
  schema: SchemaName
  tags?: Tag[]
  assignee?: PublicKey
  body: TBody
  assets?: AssetRef[]
  relations?: RelationRef[]
}

/**
 * Legacy PATCH /api/v0/records/:id input – direct mutation of a record.
 * Distinct from CreateRecordPatchInput; does not carry targetId, parentId,
 * or snapshotVersion.
 */
export interface UpdateRecordInput<TBodyPatch = DeepPartial<RecordBody>> {
  tags?: Tag[]
  assignee?: PublicKey | null
  body?: TBodyPatch
  assets?: AssetRef[]
  relations?: RelationRef[]
  description?: string
}

/**
 * POST /api/v0/records/:id/patches input – appends a patch to the record's
 * patch chain.  targetId comes from the URL path parameter, not the body.
 */
export interface CreateRecordPatchInput<TBodyPatch = DeepPartial<RecordBody>> {
  /** Points to the previous patch in the chain; null for the first patch. */
  parentId: RecordId | null
  /** Client's observed snapshot version for optimistic concurrency. */
  snapshotVersion: number
  tags?: Tag[]
  assignee?: PublicKey | null
  body?: TBodyPatch
  assets?: AssetRef[]
  relations?: RelationRef[]
  description?: string
}

export interface RecordHistoryResponse {
  record: RecordResponse<RecordItem<RecordBody>>
  status: 'empty' | 'complete' | 'broken' | 'conflicted'
  patches: RecordResponse<PatchItem<DeepPartial<RecordBody>>>[]
  diagnostics?: RecordHistoryDiagnostic[]
  replay?: RecordHistoryReplay
}

export interface RecordHistoryDiagnostic {
  code: string
  message: string
  patchId?: string
  parentId?: string | null
}

export interface RecordHistoryReplayStep {
  patch: RecordResponse<PatchItem<DeepPartial<RecordBody>>>
  state: RecordItem<RecordBody>
}

export interface RecordHistoryReplay {
  finalState: RecordItem<RecordBody>
  steps: RecordHistoryReplayStep[]
}

export type CreateProfileInput = Profile

export interface UpdateProfileInput {
  name?: string
  extra?: Record<string, unknown> | null
}

export interface RecordResponse<T> {
  createdBy: PublicKey
  createdAt: string
  body: T
}
