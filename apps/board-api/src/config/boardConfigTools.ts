import type { BoardConfig } from '@labour-board/shared'

export function cleanExcludeTags(config: BoardConfig): BoardConfig {
  const configuredTags = getConfiguredTags(config)
  return {
    ...config,
    snapshot: {
      ...config.snapshot,
      excludeTags: config.snapshot.excludeTags.filter((tag) =>
        configuredTags.has(tag)
      ),
    },
  }
}

export function getConfiguredTags(config: BoardConfig): Set<string> {
  return new Set([
    ...config.tags.status.required.map((tag) => tag.id),
    ...config.tags.status.custom.map((tag) => tag.id),
    ...config.tags.priority.defaults.map((tag) => tag.id),
    ...config.tags.priority.custom.map((tag) => tag.id),
    ...config.tags.asset.defaults.map((tag) => tag.id),
    ...config.tags.asset.custom.map((tag) => tag.id),
    ...config.tags.transaction.defaults.map((tag) => tag.id),
    ...config.tags.transaction.custom.map((tag) => tag.id),
    ...config.tags.custom.map((tag) => tag.id),
  ])
}