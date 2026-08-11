import { parseDocument, stringify } from 'yaml'
import type { BoardConfig } from '@labour-board/shared'
import { isRecord } from '../utils/object.js'
import { normalizeBoardConfig } from './boardConfigNormalize.js'
import type { Redis } from 'ioredis'
import {
  BOARD_CONFIG_REDIS_KEY,
  BOARD_PID_NEXT_KEY,
  BOARD_PID_LATEST_KEY,
} from '../db/redis.js'

/**
 * Redis-backed configuration store.
 *
 * Data source split:
 * - Redis holds the FULL BoardConfig (including pid runtime state: nextNumber
 *   and latest per prefix). It is the source of truth at runtime.
 * - YAML holds only the STATIC parts (tags, status, priority, schemas, pid
 *   prefixes). Editing YAML (usually by an AI) and re-importing updates the
 *   static parts in Redis while preserving pid runtime state.
 */

const PID_LATEST_HASH_PREFIX = `${BOARD_PID_LATEST_KEY}:`

export interface RedisConfigStore {
  /** Load the full config from Redis, or null when absent. */
  loadConfig(): Promise<BoardConfig | null>
  /** Persist the full config to Redis. */
  saveConfig(config: BoardConfig): Promise<void>
  /** Atomically claim the next number for a pid prefix. */
  drawNextNumber(prefix: string): Promise<number>
  /** Read the latest claimed pid number for a prefix. */
  readLatestNumber(prefix: string): Promise<number | undefined>
  /** Record the latest claimed pid for a prefix. */
  saveLatestNumber(
    prefix: string,
    recordId: string,
    pid: string,
    number: number
  ): Promise<void>
  /**
   * Atomically ensure the counter for a prefix is at least `minNumber`.
   * Used during reconciliation to seed the counter past DB max.
   */
  reconcileCounter(prefix: string, minNumber: number): Promise<void>
  /** Export the static config parts to YAML text. */
  exportYaml(config: BoardConfig): string
  /** Import static config from YAML text, merging with the current runtime pid state. */
  importYaml(
    yamlText: string,
    current: BoardConfig | null
  ): Promise<BoardConfig>
}

export function createRedisConfigStore(redis: Redis): RedisConfigStore {
  return {
    async loadConfig() {
      const raw = await redis.get(BOARD_CONFIG_REDIS_KEY)
      if (!raw) return null
      try {
        return JSON.parse(raw) as BoardConfig
      } catch {
        return null
      }
    },

    async saveConfig(config) {
      await redis.set(BOARD_CONFIG_REDIS_KEY, JSON.stringify(config))
    },

    async drawNextNumber(prefix) {
      return redis.incr(`${BOARD_PID_NEXT_KEY}:${prefix}`)
    },

    async readLatestNumber(prefix) {
      const value = await redis.hget(
        `${PID_LATEST_HASH_PREFIX}${prefix}`,
        'number'
      )
      if (value === null || value === undefined) return undefined
      const number = Number(value)
      return Number.isFinite(number) ? number : undefined
    },

    async saveLatestNumber(prefix, recordId, pid, number) {
      await redis.hset(`${PID_LATEST_HASH_PREFIX}${prefix}`, {
        recordId,
        pid,
        number: String(number),
      })
    },

    async reconcileCounter(prefix, minNumber) {
      const key = `${BOARD_PID_NEXT_KEY}:${prefix}`
      const script = `
        local current = redis.call('GET', KEYS[1])
        local num = tonumber(current)
        if num == nil or num < tonumber(ARGV[1]) then
          return redis.call('SET', KEYS[1], ARGV[1])
        end
        return current
      `
      await redis.eval(script, 1, key, String(minNumber))
    },

    exportYaml(config) {
      const exported = stripPidRuntimeState(config)
      return stringify(exported)
    },

    async importYaml(yamlText, current) {
      const document = parseDocument(yamlText)
      if (document.errors.length > 0) {
        throw new Error(
          `Invalid board config YAML: ${document.errors
            .map((yamlError) => yamlError.message)
            .join('; ')}`
        )
      }
      const raw = document.toJS() as unknown
      if (!isRecord(raw)) {
        throw new Error('Board config YAML root must be a mapping')
      }

      const imported = {
        ...(current ?? {}),
        ...(raw as Partial<BoardConfig>),
        pid: {
          ...(current?.pid ?? {}),
          ...(isRecord(raw.pid) ? raw.pid : {}),
        },
      } as BoardConfig

      // Imported YAML may carry stale pid runtime seeds; they must not
      // override the live Redis state, so strip them and keep current.
      delete (imported.pid as { nextNumber?: number }).nextNumber
      delete (imported.pid as { latest?: unknown }).latest

      // Validate the merged structure before persisting; an invalid shape
      // (e.g. pid.prefixes as a string) must not reach Redis and replace the
      // running config.
      const normalized = normalizeBoardConfig(imported, '<yaml-import>')

      if (current?.pid) {
        normalized.pid.nextNumber = current.pid.nextNumber
        normalized.pid.latest = current.pid.latest
      }

      return normalized
    },
  }
}

function stripPidRuntimeState(config: BoardConfig): unknown {
  const { pid, ...rest } = config
  return {
    ...rest,
    pid: {
      prefixes: pid.prefixes,
      schemaPrefixes: pid.schemaPrefixes,
    },
  }
}
