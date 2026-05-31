import { Hono } from 'hono'
import type {
  ApiResponse,
  RecordHistoryResponse,
} from '@labour-board/shared'
import { error, ok } from '../../http/responses.js'
import type { RecordService } from '../../services/recordService.js'

export function createRecordHistoryRoute(recordService: RecordService): Hono {
  const records = new Hono()

  records.get('/:id/history', async (c) => {
    const history = await recordService.getRecordHistory(c.req.param('id'))
    if (!history) {
      return c.json(error('NOT_FOUND', 'Record not found'), 404)
    }

    return c.json<ApiResponse<RecordHistoryResponse>>(ok(history))
  })

  return records
}
