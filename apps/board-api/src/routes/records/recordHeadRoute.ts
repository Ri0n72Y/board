import { Hono } from 'hono'
import type {
  ApiResponse,
  RecordCurrentHeadResponse,
} from '@labour-board/shared'
import { error, ok } from '../../http/responses.js'
import {
  CurrentHeadConflictError,
  type RecordService,
} from '../../services/recordService.js'

export function createRecordHeadRoute(recordService: RecordService): Hono {
  const records = new Hono()

  records.get('/:id/head', async (c) => {
    try {
      const head = await recordService.getRecordCurrentHead(c.req.param('id'))
      if (!head) {
        return c.json(error('NOT_FOUND', 'Record not found'), 404)
      }

      return c.json<ApiResponse<RecordCurrentHeadResponse>>(ok(head))
    } catch (caught) {
      if (caught instanceof CurrentHeadConflictError) {
        return c.json(error('CONFLICT', caught.message), 409)
      }
      throw caught
    }
  })

  return records
}
