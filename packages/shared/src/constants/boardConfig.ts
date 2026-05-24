import type { BoardConfig } from "../interfaces/boardConfig.js";
import {
  DEFAULT_ASSET_TAGS,
  DEFAULT_PRIORITY_TAGS,
  REQUIRED_STATUS_TAGS,
  REQUIRED_TAG_NAMESPACES,
} from "./tags.js";

export const DEFAULT_BOARD_CONFIG = {
  pid: {
    prefixes: ["CARD", "ASSET", "TEST"],
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
    custom: [],
  },
  relations: {
    constraints: [
      "blocks",
      "blockedBy",
      "dependsOn",
      "relatedTo",
      "duplicate",
      "contains",
      "childOf",
      "supports",
      "implementedBy",
      "asset:completion-of",
      "progress:contributes-to",
    ],
  },
  snapshot: {
    excludeTags: ["status:archived"],
  },
} as const satisfies BoardConfig;
