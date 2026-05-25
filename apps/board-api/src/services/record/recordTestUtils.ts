import { DEFAULT_BOARD_CONFIG, type BoardConfig } from '@labour-board/shared'
import { vi } from 'vitest'
import type { BoardConfigPidWriter } from '../../config/boardConfig.js'
import { MemoryRecordRepository } from '../../repositories/recordRepository.js'
import { RecordService } from '../recordService.js'

export function createRecordService(): RecordService {
  return new RecordService(
    new MemoryRecordRepository(),
    structuredClone(DEFAULT_BOARD_CONFIG)
  )
}

export function createWriter(): BoardConfigPidWriter & {
  schedulePidWrite: ReturnType<typeof vi.fn>
} {
  return {
    schedulePidWrite: vi.fn<(config: BoardConfig) => void>(),
    flush: vi.fn(async () => {}),
  }
}

export function cloneDefaultBoardConfig(): BoardConfig {
  return structuredClone(DEFAULT_BOARD_CONFIG)
}
