import type { BoardStatus } from '../constants/statuses.js'
import type { BoardTag } from '../constants/tags.js'

export interface AssetRef {
  id?: string
  name?: string
  url: string
  mimeType?: string
}

export interface GitRef {
  repository?: string
  branch?: string
  commit?: string
  pullRequest?: string
}

export interface TestRef {
  name: string
  status?: 'passed' | 'failed' | 'skipped' | 'unknown'
  url?: string
}

export interface CardBody {
  title: string
  description?: string
  status?: BoardStatus
  tags?: BoardTag[]
  projectId?: string
  parentId?: string
}

export interface RecordBody {
  kind: 'card' | 'note' | 'event' | string
  title?: string
  description?: string
  card?: CardBody
  assets?: AssetRef[]
  git?: GitRef
  tests?: TestRef[]
  content?: unknown
}
