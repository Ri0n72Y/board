import type {
  CreateSnapshotInput,
  PublicKey,
  SnapshotDetail,
  SnapshotSummary,
} from '@labour-board/shared'
import type { RecordRepository } from '../../repositories/recordRepository.js'
import type { SnapshotHeadRepository } from '../../repositories/snapshotHeadRepository.js'
import type { SnapshotRepository } from '../../repositories/snapshotRepository.js'
import { getBoardCurrentProjection } from '../boardCurrent/boardCurrentService.js'
import { resolveActor } from '../record/recordResponses.js'

export class SnapshotService {
  private readonly recordRepository: RecordRepository
  private readonly snapshotHeadRepository: SnapshotHeadRepository
  private readonly snapshotRepository: SnapshotRepository

  constructor(
    recordRepository: RecordRepository,
    snapshotHeadRepository: SnapshotHeadRepository,
    snapshotRepository: SnapshotRepository
  ) {
    this.recordRepository = recordRepository
    this.snapshotHeadRepository = snapshotHeadRepository
    this.snapshotRepository = snapshotRepository
  }

  async createManualSnapshot(
    input: CreateSnapshotInput,
    createdBy?: PublicKey
  ): Promise<SnapshotDetail> {
    const projection = await getBoardCurrentProjection({
      repository: this.recordRepository,
      snapshotHeadRepository: this.snapshotHeadRepository,
    })
    const patches = await this.recordRepository.listPatches()
    const reason = normalizeReason(input.reason)
    const snapshot: SnapshotDetail = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      createdBy: resolveActor(createdBy),
      ...(reason ? { reason } : {}),
      recordCount: projection.records.length,
      patchCount: patches.length,
      source: 'manual',
      projectionStatus: projection.summary.projectionStatus,
      projection: structuredClone(projection),
    }

    return this.snapshotRepository.create(snapshot)
  }

  async listSnapshots(): Promise<SnapshotSummary[]> {
    return this.snapshotRepository.list()
  }

  async getSnapshot(id: string): Promise<SnapshotDetail | null> {
    return this.snapshotRepository.findById(id)
  }
}

function normalizeReason(reason: unknown): string | undefined {
  if (typeof reason !== 'string') return undefined
  const trimmed = reason.trim()
  return trimmed === '' ? undefined : trimmed
}
