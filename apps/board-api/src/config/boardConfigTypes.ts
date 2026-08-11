import type { Redis } from 'ioredis'
import type { BoardConfig } from '@labour-board/shared'
import type { RedisConfigStore } from './redisConfigStore.js'

export interface LoadBoardConfigOptions {
  defaultConfigPath?: string
  /** When provided, config loads from Redis (runtime source of truth). */
  redis?: Redis
}

export interface LoadedBoardConfig {
  config: BoardConfig
  configPath: string
  needsPidReconciliation: boolean
  warnings: string[]
  writable: boolean
  /** Present when Redis is enabled. */
  configStore?: RedisConfigStore
}

export class BoardConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BoardConfigError'
  }
}
