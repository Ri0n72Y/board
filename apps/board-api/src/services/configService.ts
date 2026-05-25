import type { BoardConfig } from '@labour-board/shared'

export class ConfigService {
  private readonly config: BoardConfig

  constructor(config: BoardConfig) {
    this.config = config
  }

  getConfig(): BoardConfig {
    return this.config
  }
}
