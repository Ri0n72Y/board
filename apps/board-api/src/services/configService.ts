import type { BoardConfig } from '@labour-board/shared'
import type { AgentRuntimeConfig } from '../config/agentEnv.js'
import type { RedisConfigStore } from '../config/redisConfigStore.js'

export class ConfigService {
  private config: BoardConfig
  private readonly agentRuntimeConfig: AgentRuntimeConfig
  private readonly configStore?: RedisConfigStore

  constructor(
    config: BoardConfig,
    agentRuntimeConfig: AgentRuntimeConfig,
    configStore?: RedisConfigStore
  ) {
    this.config = config
    this.agentRuntimeConfig = agentRuntimeConfig
    this.configStore = configStore
  }

  getConfig(): BoardConfig {
    return this.config
  }

  /**
   * Update the in-memory config in place and persist to Redis.
   *
   * The config object is shared by reference with RecordService/PidAllocator
   * (created in createApiServices), so mutating it in place makes the update
   * visible to every consumer without rebuilding services.
   */
  async updateConfig(config: BoardConfig): Promise<BoardConfig> {
    const target = this.config
    // Replace all top-level keys in place, preserving object identity.
    for (const key of Object.keys(target) as (keyof BoardConfig)[]) {
      delete target[key]
    }
    Object.assign(target, config)
    if (this.configStore) {
      await this.configStore.saveConfig(target)
    }
    return target
  }

  /** Re-read the latest config from Redis (hot reload after external edits). */
  async reloadConfig(): Promise<BoardConfig> {
    if (this.configStore) {
      const latest = await this.configStore.loadConfig()
      if (latest) {
        return this.updateConfig(latest)
      }
    }
    return this.config
  }

  getAgentRuntimeConfig(): AgentRuntimeConfig {
    return this.agentRuntimeConfig
  }

  /** Export the static config parts as YAML text (visualization / editing). */
  exportYaml(): string {
    if (!this.configStore) {
      throw new Error('Redis config store is not enabled')
    }
    return this.configStore.exportYaml(this.config)
  }

  /**
   * Import static config from YAML text, preserving the live pid runtime
   * state, then persist to Redis.
   */
  async importYaml(yamlText: string): Promise<BoardConfig> {
    if (!this.configStore) {
      throw new Error('Redis config store is not enabled')
    }
    const next = await this.configStore.importYaml(yamlText, this.config)
    return this.updateConfig(next)
  }
}
