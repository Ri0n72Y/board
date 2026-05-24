import type {
  AssetRef,
  PublicId,
  PublicKey,
  RecordBody,
  RecordId,
  RelationRef,
  SchemaName,
} from './record.js'
import type { Tag } from './tag.js'

// Patch apply rules: objects merge recursively, arrays replace as whole values,
// undefined means "not submitted" and must not be written, null explicitly clears.
export type DeepPartial<T> = T extends readonly unknown[]
  ? T
  : T extends object
    ? {
        [TKey in keyof T]?: DeepPartial<T[TKey]>
      }
    : T

export interface PatchItem<TBodyPatch = DeepPartial<RecordBody>> {
  id: RecordId
  pid: PublicId
  schema: SchemaName
  targetId: RecordId
  parentId?: RecordId
  tags?: Tag[]
  assignee?: PublicKey | null
  body?: TBodyPatch
  assets?: AssetRef[]
  relations?: RelationRef[]
  description?: string
}
