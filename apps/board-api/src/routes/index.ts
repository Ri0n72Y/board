import type { Hono } from 'hono'
import { createRecordsRoute } from './records.js'
import type { RecordService } from '../services/recordService.js'

export interface ApiRouteServices {
  recordService: RecordService
}

export function mountApiRoutes(app: Hono, services: ApiRouteServices): void {
  app.route('/api/v0/records', createRecordsRoute(services.recordService))
}
