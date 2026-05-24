import type { BoardStatus } from '../constants/statuses.js'
import type { BoardTag } from '../constants/tags.js'
import type { RecordBody } from './body.js'

export interface RecordMeta {
  createdAt: string
  updatedAt: string
  deleted?: boolean
  status?: BoardStatus
  tags?: BoardTag[]
  parentId?: string
  projectId?: string
}

export interface RecordEnvelope<TBody> {
  id: string
  body: TBody
  meta: RecordMeta
}

export interface RecordQuery {
  tag?: string
  status?: BoardStatus
  parentId?: string
  projectId?: string
  includeDeleted?: boolean
}

export interface CreateRecordInput {
  id?: string
  body: RecordBody
  meta?: Partial<RecordMeta>
}

export interface UpdateRecordInput {
  body?: Partial<RecordBody>
  meta?: Partial<RecordMeta>
}
