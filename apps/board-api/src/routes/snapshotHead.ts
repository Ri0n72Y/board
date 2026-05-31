import { Hono } from 'hono'
import type { ApiResponse } from '@labour-board/shared'
import { ok } from '../http/responses.js'
import type { RecordService, SnapshotHead } from '../services/recordService.js'

type SnapshotHeadResponse = Pick<SnapshotHead, 'version' | 'records'>

export function createSnapshotHeadRoute(recordService: RecordService): Hono {
  const snapshotHead = new Hono()

  snapshotHead.get('/', async (c) => {
    const head = await recordService.getSnapshotHead()
    return c.json<ApiResponse<SnapshotHeadResponse>>(
      ok({ version: head.version, records: head.records })
    )
  })

  return snapshotHead
}
