import type { BoardConfig } from '@labour-board/shared'
import type { RedisConfigStore } from '../config/redisConfigStore.js'

/**
 * In-memory RedisConfigStore used when Redis is not configured (tests,
 * single-process dev). PID counters are process-local; this is acceptable
 * when there is exactly one server process.
 */
export function createMemoryPidStore(
  initialConfig: BoardConfig
): RedisConfigStore {
  const counters = new Map<string, number>()
  const latest = new Map<
    string,
    { recordId: string; pid: string; number: number }
  >()

  for (const prefix of initialConfig.pid.prefixes) {
    const seed = initialConfig.pid.latest?.[prefix]?.number
    counters.set(prefix, seed ?? 0)
  }

  return {
    async loadConfig() {
      return null
    },
    async saveConfig() {},
    async drawNextNumber(prefix) {
      const next = (counters.get(prefix) ?? 0) + 1
      counters.set(prefix, next)
      return next
    },
    async readLatestNumber(prefix) {
      return latest.get(prefix)?.number
    },
    async saveLatestNumber(prefix, recordId, pid, number) {
      latest.set(prefix, { recordId, pid, number })
    },
    async reconcileCounter(prefix, minNumber) {
      const current = counters.get(prefix) ?? 0
      if (current < minNumber) counters.set(prefix, minNumber)
    },
    exportYaml() {
      return ''
    },
    async importYaml() {
      return initialConfig
    },
  }
}
