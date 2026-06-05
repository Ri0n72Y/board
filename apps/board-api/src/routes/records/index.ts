import { Hono } from 'hono'
import type { RecordService } from '../../services/recordService.js'
import { createRecordCrudRoute } from './recordCrudRoute.js'
import { createRecordHeadRoute } from './recordHeadRoute.js'
import { createRecordPatchRoute } from './recordPatchRoute.js'
import { createRecordHistoryRoute } from './recordHistoryRoute.js'

export function createRecordsRoute(recordService: RecordService): Hono {
  const records = new Hono()

  records.route('/', createRecordCrudRoute(recordService))
  records.route('/', createRecordHeadRoute(recordService))
  records.route('/', createRecordPatchRoute(recordService))
  records.route('/', createRecordHistoryRoute(recordService))

  return records
}
