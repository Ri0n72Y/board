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

export interface TagChange {
  namespace: string
  from: Tag | null
  to: Tag | null
}

export interface TagChanges {
  add?: Tag[]
  remove?: Tag[]
  change?: TagChange[]
}

export interface PatchItem<TBodyPatch = DeepPartial<RecordBody>> {
  id: RecordId
  pid: PublicId
  schema: SchemaName
  targetId: RecordId
  /** Points to the previous patch; null for the first patch in the chain. */
  parentId: RecordId | null
  tagChanges?: TagChanges
  assignee?: PublicKey | null
  body?: TBodyPatch
  assets?: AssetRef[]
  relations?: RelationRef[]
  description?: string
}
