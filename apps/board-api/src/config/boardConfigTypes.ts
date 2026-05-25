import type { BoardConfig } from '@labour-board/shared'

export interface LoadBoardConfigOptions {
  defaultConfigPath?: string
}

export interface LoadedBoardConfig {
  config: BoardConfig
  configPath: string
  needsPidReconciliation: boolean
  warnings: string[]
  writable: boolean
}

export interface BoardConfigPidWriter {
  schedulePidWrite(config: BoardConfig): void
  flush(): Promise<void>
}

export class BoardConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BoardConfigError'
  }
}
