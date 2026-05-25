import type { BoardConfig } from '@labour-board/shared'
import type { BoardConfigPidWriter } from '../../config/boardConfig.js'
import type {
  BoardRecord,
  RecordRepository,
} from '../../repositories/recordRepository.js'
import { RecordValidationError } from '../recordService.js'

export class PidAllocator {
  private readonly boardConfig: BoardConfig
  private readonly boardConfigWriter?: BoardConfigPidWriter
  private pidLock: Promise<void> = Promise.resolve()
  private readonly repository: RecordRepository

  constructor(
    repository: RecordRepository,
    boardConfig: BoardConfig,
    boardConfigWriter?: BoardConfigPidWriter
  ) {
    this.repository = repository
    this.boardConfig = boardConfig
    this.boardConfigWriter = boardConfigWriter
  }

  async drawPid(prefix: string, recordId: string): Promise<string> {
    return this.withPidLock(async () => {
      const cachedNumber = this.boardConfig.pid.latest?.[prefix]?.number
      const nextNumber = Math.max(
        this.boardConfig.pid.nextNumber,
        cachedNumber === undefined ? 0 : cachedNumber + 1
      )
      const cachedPid = `${prefix}-${nextNumber}`
      const existing = await this.repository.findByPid(cachedPid)
      const pid = existing ? await this.drawPidFromRecordScan(prefix) : cachedPid

      this.persistPidState(prefix, recordId, pid)
      return pid
    })
  }

  async reconcilePidState(): Promise<void> {
    const records = await this.repository.list({
      includeArchived: true,
      excludeTags: this.boardConfig.snapshot.excludeTags,
    })
    let changed = false
    let maxNumber = 0

    for (const prefix of this.boardConfig.pid.prefixes) {
      const max = findMaxPidRecord(records, prefix)
      if (!max) {
        continue
      }

      maxNumber = Math.max(maxNumber, max.number)
      const current = this.boardConfig.pid.latest?.[prefix]
      if (current?.recordId === max.record.id && current.number === max.number) {
        continue
      }

      this.boardConfig.pid.latest = {
        ...this.boardConfig.pid.latest,
        [prefix]: {
          recordId: max.record.id,
          pid: max.record.pid,
          number: max.number,
        },
      }
      changed = true
    }

    const reconciledNextNumber = Math.max(1, maxNumber + 1)
    if (this.boardConfig.pid.nextNumber !== reconciledNextNumber) {
      this.boardConfig.pid.nextNumber = reconciledNextNumber
      changed = true
    }

    if (changed) {
      this.boardConfigWriter?.schedulePidWrite(this.boardConfig)
    }
  }

  private async drawPidFromRecordScan(prefix: string): Promise<string> {
    const records = await this.repository.list({
      includeArchived: true,
      excludeTags: this.boardConfig.snapshot.excludeTags,
    })
    const nextNumber = Math.max(
      this.boardConfig.pid.nextNumber,
      ...records
        .map((record) => parsePublicIdNumber(record.pid, prefix))
        .filter((value): value is number => value !== undefined)
        .map((value) => value + 1)
    )

    return `${prefix}-${nextNumber}`
  }

  private persistPidState(prefix: string, recordId: string, pid: string): void {
    const number = parsePublicIdNumber(pid, prefix)
    if (number === undefined) {
      throw new RecordValidationError(`Invalid generated pid: ${pid}`)
    }

    this.boardConfig.pid.latest = {
      ...this.boardConfig.pid.latest,
      [prefix]: {
        recordId,
        pid,
        number,
      },
    }
    this.boardConfigWriter?.schedulePidWrite(this.boardConfig)
  }

  private async withPidLock<T>(operation: () => Promise<T>): Promise<T> {
    const previous = this.pidLock
    let release: () => void = () => {}
    this.pidLock = new Promise<void>((resolve) => {
      release = resolve
    })

    await previous
    try {
      return await operation()
    } finally {
      release()
    }
  }
}

function parsePublicIdNumber(pid: string, prefix: string): number | undefined {
  const match = new RegExp(`^${escapeRegExp(prefix)}-(\\d+)$`).exec(pid)
  if (!match) {
    return undefined
  }

  return Number(match[1])
}

function findMaxPidRecord(
  records: BoardRecord[],
  prefix: string
): { record: BoardRecord; number: number } | undefined {
  let max: { record: BoardRecord; number: number } | undefined
  for (const record of records) {
    const number = parsePublicIdNumber(record.pid, prefix)
    if (number === undefined) {
      continue
    }

    if (!max || number > max.number) {
      max = { record, number }
    }
  }

  return max
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
