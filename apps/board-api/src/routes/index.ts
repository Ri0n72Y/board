import type { Hono } from 'hono'
import { createConfigRoute } from './config.js'
import { createRecordsRoute } from './records.js'
import type { ConfigService } from '../services/configService.js'
import type { RecordService } from '../services/recordService.js'

export interface ApiRouteServices {
  configService: ConfigService
  recordService: RecordService
}

export function mountApiRoutes(app: Hono, services: ApiRouteServices): void {
  app.route('/api/v0/config', createConfigRoute(services.configService))
  app.route('/api/v0/records', createRecordsRoute(services.recordService))
}
