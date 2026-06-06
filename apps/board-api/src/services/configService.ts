import type { BoardConfig } from '@labour-board/shared'
import type { AgentRuntimeConfig } from '../config/agentEnv.js'

export class ConfigService {
  private readonly config: BoardConfig
  private readonly agentRuntimeConfig: AgentRuntimeConfig

  constructor(config: BoardConfig, agentRuntimeConfig: AgentRuntimeConfig) {
    this.config = config
    this.agentRuntimeConfig = agentRuntimeConfig
  }

  getConfig(): BoardConfig {
    return this.config
  }

  getAgentRuntimeConfig(): AgentRuntimeConfig {
    return this.agentRuntimeConfig
  }
}
