import type { DeepPartial } from './patch.js'
import type { Profile } from './profile.js'
import type {
  AssetRef,
  PublicKey,
  RecordBody,
  RecordId,
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

export interface CreatePatchInput<TBodyPatch = DeepPartial<RecordBody>> {
  targetId: RecordId
  parentId?: RecordId
  tags?: Tag[]
  assignee?: PublicKey
  body?: TBodyPatch
  assets?: AssetRef[]
  relations?: RelationRef[]
  description?: string
}

export type CreateProfileInput = Profile

export interface UpdateProfileInput {
  name?: string
  extra?: Record<string, unknown> | null
}
