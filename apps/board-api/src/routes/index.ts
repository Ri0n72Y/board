import type { Hono } from 'hono'
import { createConfigRoute } from './config.js'
import { createPatchesRoute } from './patches.js'
import { createProfilesRoute } from './profiles.js'
import { createRecordsRoute } from './records.js'
import { createSnapshotHeadRoute } from './snapshotHead.js'
import type { ConfigService } from '../services/configService.js'
import type { ProfileService } from '../services/profileService.js'
import type { RecordService } from '../services/recordService.js'

export interface ApiRouteServices {
  configService: ConfigService
  profileService: ProfileService
  recordService: RecordService
}

export function mountApiRoutes(app: Hono, services: ApiRouteServices): void {
  app.route('/api/v0/config', createConfigRoute(services.configService))
  app.route('/api/v0/profiles', createProfilesRoute(services.profileService))
  app.route('/api/v0/patches', createPatchesRoute(services.recordService))
  app.route(
    '/api/v0/snapshot-head',
    createSnapshotHeadRoute(services.recordService)
  )
  app.route('/api/v0/records', createRecordsRoute(services.recordService))
}
