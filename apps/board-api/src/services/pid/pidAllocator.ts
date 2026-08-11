import type { BoardConfig } from '@labour-board/shared'
import type { RedisConfigStore } from '../../config/redisConfigStore.js'
import type {
  StoredRecordDoc,
  RecordRepository,
} from '../../repositories/recordRepository.js'
import { RecordValidationError } from '../recordService.js'
import { escapeRegExp } from '../../utils/string.js'

export class PidAllocator {
  private readonly boardConfig: BoardConfig
  private readonly configStore: RedisConfigStore
  private pidLock: Promise<void> = Promise.resolve()
  private readonly repository: RecordRepository

  constructor(
    repository: RecordRepository,
    boardConfig: BoardConfig,
    configStore: RedisConfigStore
  ) {
    this.repository = repository
    this.boardConfig = boardConfig
    this.configStore = configStore
  }

  async drawPid(prefix: string, recordId: string): Promise<string> {
    return this.withPidLock(async () => {
      // Loop with atomic INCR + conflict probe: each iteration claims a fresh
      // number from Redis and checks it is unused. Safe across processes
      // (unlike a shared record scan, which can hand out the same max+1).
      let pid: string
      for (let attempt = 0; attempt < 1000; attempt++) {
        const nextNumber = await this.configStore.drawNextNumber(prefix)
        const candidate = `${prefix}-${nextNumber}`
        const existing = await this.repository.findByPid(candidate)
        if (!existing) {
          pid = candidate
          await this.persistPidState(prefix, recordId, pid)
          return pid
        }
      }
      throw new RecordValidationError(
        `Unable to allocate a unique pid for prefix ${prefix} after 1000 attempts`
      )
    })
  }

  async reconcilePidState(): Promise<void> {
    const records = await this.repository.list({
      includeArchived: true,
      excludeTags: this.boardConfig.snapshot.excludeTags,
    })

    for (const prefix of this.boardConfig.pid.prefixes) {
      const max = findMaxPidRecord(records, prefix)
      if (!max) {
        continue
      }

      const latestNumber = await this.configStore.readLatestNumber(prefix)
      if (latestNumber === max.number) {
        continue
      }

      // Seed the atomic counter past the DB max so the next draw continues
      // after the highest record. This is atomic (SET if less).
      await this.configStore.reconcileCounter(prefix, max.number)
      await this.configStore.saveLatestNumber(
        prefix,
        max.record.id,
        max.record.pid,
        max.number
      )
    }
  }

  private async persistPidState(
    prefix: string,
    recordId: string,
    pid: string
  ): Promise<void> {
    const number = parsePublicIdNumber(pid, prefix)
    if (number === undefined) {
      throw new RecordValidationError(`Invalid generated pid: ${pid}`)
    }

    await this.configStore.saveLatestNumber(prefix, recordId, pid, number)
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
  records: StoredRecordDoc[],
  prefix: string
): { record: StoredRecordDoc; number: number } | undefined {
  let max: { record: StoredRecordDoc; number: number } | undefined
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
