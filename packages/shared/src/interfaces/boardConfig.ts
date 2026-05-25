import type { PublicId, RecordId, RelationConstraint } from './record.js'
import type { SchemaName } from './record.js'
import type { Tag, TagDefinition, TagNamespaceConfig } from './tag.js'

export type PidPrefix = string

export interface BoardConfig {
  records: {
    schemas: SchemaName[]
  }
  pid: {
    prefixes: PidPrefix[]
    schemaPrefixes: Partial<Record<SchemaName, PidPrefix>>
    nextNumber: number
    latest?: Partial<
      Record<
        PidPrefix,
        {
          recordId: RecordId
          pid: PublicId
          number: number
        }
      >
    >
  }
  tags: {
    namespaces: TagNamespaceConfig[]
    status: {
      required: TagDefinition[]
      custom: TagDefinition[]
    }
    priority: {
      defaults: TagDefinition[]
      custom: TagDefinition[]
    }
    asset: {
      defaults: TagDefinition[]
      custom: TagDefinition[]
    }
    transaction: {
      defaults: TagDefinition[]
      custom: TagDefinition[]
    }
    custom: TagDefinition[]
  }
  relations: {
    constraints: RelationConstraint[]
  }
  snapshot: {
    excludeTags: Tag[]
  }
}
