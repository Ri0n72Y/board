import type { Hono } from 'hono'
import { createBoardCurrentExportRoute } from './boardCurrentExport.js'
import { createBoardCurrentRoute } from './boardCurrent.js'
import { createConfigRoute } from './config.js'
import { createPatchesRoute } from './patches.js'
import { createProfilesRoute } from './profiles.js'
import { createRecordsRoute } from './records.js'
import { createSnapshotsRoute } from './snapshots.js'
import { createAgentRoute } from './agentDrafts.js'
import { createAgentSkillsRoute } from './agentSkills.js'
import { createAgentSuggestionsRoute } from './agentSuggestions.js'
import type { ConfigService } from '../services/configService.js'
import type { ProfileService } from '../services/profileService.js'
import type { RecordService } from '../services/recordService.js'
import type { SnapshotService } from '../services/snapshot/snapshotService.js'
import type { AgentDraftService } from '../services/agent/agentDraftService.js'
import type { AgentResponseService } from '../services/agent/agentResponseService.js'
import type { AgentSkillService } from '../services/agent/agentSkillService.js'
import type { AgentSuggestionService } from '../services/agent/agentSuggestionService.js'
import type { RecordRepository } from '../repositories/recordRepository.js'
import type { SnapshotHeadRepository } from '../repositories/snapshotHeadRepository.js'

export interface ApiRouteServices {
  configService: ConfigService
  profileService: ProfileService
  recordService: RecordService
  snapshotService: SnapshotService
  agentDraftService: AgentDraftService
  agentResponseService: AgentResponseService
  agentSkillService: AgentSkillService
  agentSuggestionService: AgentSuggestionService
  recordRepository: RecordRepository
  snapshotHeadRepository: SnapshotHeadRepository
}

export function mountApiRoutes(app: Hono, services: ApiRouteServices): void {
  app.route(
    '/api/v0/board',
    createBoardCurrentExportRoute(
      services.recordRepository,
      services.snapshotHeadRepository
    )
  )
  app.route(
    '/api/v0/board',
    createBoardCurrentRoute(
      services.recordRepository,
      services.snapshotHeadRepository
    )
  )
  app.route('/api/v0/config', createConfigRoute(services.configService))
  app.route('/api/v0/profiles', createProfilesRoute(services.profileService))
  app.route('/api/v0/patches', createPatchesRoute(services.recordService))
  app.route('/api/v0/snapshots', createSnapshotsRoute(services.snapshotService))
  app.route('/api/v0/records', createRecordsRoute(services.recordService))
  app.route(
    '/api/v0/agent',
    createAgentRoute(services.agentDraftService, services.agentResponseService)
  )
  app.route('/api/v0/agent', createAgentSkillsRoute(services.agentSkillService))
  app.route(
    '/api/v0/agent',
    createAgentSuggestionsRoute(services.agentSuggestionService)
  )
}
