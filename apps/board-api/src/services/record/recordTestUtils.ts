import { DEFAULT_BOARD_CONFIG, type BoardConfig } from '@labour-board/shared'
import { vi } from 'vitest'
import type { BoardConfigPidWriter } from '../../config/boardConfig.js'
import { MemoryRecordRepository } from '../../repositories/recordRepository.js'
import { MemorySnapshotHeadRepository, type StoredPatchDoc } from '../../repositories/snapshotHeadRepository.js'
import { RecordService } from '../recordService.js'

export function createRecordService(): RecordService {
  const repository = new MemoryRecordRepository()
  return new RecordService(
    repository,
    new MemorySnapshotHeadRepository(repository),
    structuredClone(DEFAULT_BOARD_CONFIG)
  )
}

export function createServiceWithRepo(): { service: RecordService; repo: MemoryRecordRepository } {
  const repo = new MemoryRecordRepository()
  const service = new RecordService(repo, new MemorySnapshotHeadRepository(repo), structuredClone(DEFAULT_BOARD_CONFIG))
  return { service, repo }
}

export function makePatchDoc(
  id: string,
  targetId: string,
  parentId: string | null,
  overrides?: Partial<StoredPatchDoc>
): StoredPatchDoc {
  return {
    id,
    pid: 'CARD-1',
    schema: 'CardBody',
    targetId,
    parentId,
    createdBy: 'local',
    createdAt: new Date().toISOString(),
    ...overrides,
  }
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
