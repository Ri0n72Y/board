import type { BoardConfig } from '../interfaces/boardConfig.js'
import { RECORD_SCHEMAS } from './schemas.js'
import {
  DEFAULT_ASSET_TAGS,
  DEFAULT_PRIORITY_TAGS,
  DEFAULT_TRANSACTION_TAGS,
  REQUIRED_STATUS_TAGS,
  REQUIRED_TAG_NAMESPACES,
} from './tags.js'

export const DEFAULT_BOARD_CONFIG = {
  records: {
    schemas: [
      RECORD_SCHEMAS.card,
      RECORD_SCHEMAS.asset,
      RECORD_SCHEMAS.transaction,
    ],
  },
  pid: {
    prefixes: ['CARD', 'ASSET', 'TEST', 'TX'],
    schemaPrefixes: {
      [RECORD_SCHEMAS.card]: 'CARD',
      [RECORD_SCHEMAS.asset]: 'ASSET',
      [RECORD_SCHEMAS.transaction]: 'TX',
    },
    nextNumber: 1,
  },
  tags: {
    namespaces: [...REQUIRED_TAG_NAMESPACES],
    status: {
      required: [...REQUIRED_STATUS_TAGS],
      custom: [],
    },
    priority: {
      defaults: [...DEFAULT_PRIORITY_TAGS],
      custom: [],
    },
    asset: {
      defaults: [...DEFAULT_ASSET_TAGS],
      custom: [],
    },
    transaction: {
      defaults: [...DEFAULT_TRANSACTION_TAGS],
      custom: [],
    },
    custom: [],
  },
  relations: {
    constraints: [
      'blocks',
      'blockedBy',
      'dependsOn',
      'relatedTo',
      'duplicate',
      'contains',
      'childOf',
      'supports',
      'implementedBy',
      'asset:completion-of',
      'progress:contributes-to',
    ],
  },
  snapshot: {
    excludeTags: ['status:archived'],
  },
} as const satisfies BoardConfig
