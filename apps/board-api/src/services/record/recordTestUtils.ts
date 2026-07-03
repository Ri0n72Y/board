import { DEFAULT_BOARD_CONFIG, type BoardConfig } from '@labour-board/shared'
import { vi } from 'vitest'
import type { BoardConfigPidWriter } from '../../config/boardConfig.js'
import { MemoryRecordRepository } from '../../repositories/recordRepository.js'
import {
  MemorySnapshotHeadRepository,
  type StoredPatchDoc,
} from '../../repositories/snapshotHeadRepository.js'
import type { SnapshotHeadRepository } from '../../repositories/snapshotHeadRepository.js'
import { RecordService } from '../recordService.js'

export function createRecordService(): RecordService {
  const repository = new MemoryRecordRepository()
  return new RecordService(
    repository,
    new MemorySnapshotHeadRepository(repository),
    structuredClone(DEFAULT_BOARD_CONFIG)
  )
}

export function createServiceWithRepo(): {
  service: RecordService
  repo: MemoryRecordRepository
  head: SnapshotHeadRepository
} {
  const repo = new MemoryRecordRepository()
  const head = new MemorySnapshotHeadRepository(repo)
  const service = new RecordService(
    repo,
    head,
    structuredClone(DEFAULT_BOARD_CONFIG)
  )
  return { service, repo, head }
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

export async function appendArchivePatch(
  service: RecordService,
  recordId: string
) {
  const head = await service.getRecordCurrentHead(recordId)
  if (!head) return null
  return service.createRecordPatch(recordId, {
    parentId: head.lastPatchId,
    currentVersion: head.currentVersion,
    tagChanges: { add: ['status:archived'] },
    description: 'Archive record',
  })
}
