import type { RelationConstraint } from './record.js'
import type { Tag, TagDefinition, TagNamespaceConfig } from './tag.js'

export type PidPrefix = string

export interface BoardConfig {
  pid: {
    prefixes: PidPrefix[]
    nextNumber: number
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
