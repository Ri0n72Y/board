import type { Collection, Document } from 'mongodb'
import type { ApiEnv } from '../config/env.js'
import { loadAgentRuntimeConfig } from '../config/agentEnv.js'
import {
  createBoardConfigPidWriter,
  loadBoardConfigState,
} from '../config/boardConfig.js'
import {
  getProfilesCollection,
  getMongoClient,
  getRecordsCollection,
  getSnapshotsCollection,
  getAgentDraftsCollection,
  getAgentResponsesCollection,
} from '../db/mongo.js'
import {
  MemoryProfileRepository,
  MongoProfileRepository,
  type ProfileRepository,
} from '../repositories/profileRepository.js'
import {
  MemoryRecordRepository,
  MongoRecordRepository,
  type RecordRepository,
} from '../repositories/recordRepository.js'
import {
  MemorySnapshotHeadRepository,
  MongoSnapshotHeadRepository,
  type SnapshotHeadRepository,
} from '../repositories/snapshotHeadRepository.js'
import {
  MemorySnapshotRepository,
  MongoSnapshotRepository,
  type SnapshotRepository,
} from '../repositories/snapshotRepository.js'
import { RecordService } from './recordService.js'
import { ConfigService } from './configService.js'
import { ProfileService } from './profileService.js'
import { SnapshotService } from './snapshot/snapshotService.js'
import { AgentDraftService } from './agent/agentDraftService.js'
import { AgentResponseService } from './agent/agentResponseService.js'
import {
  MemoryAgentDraftRepository,
  MongoAgentDraftRepository,
  type AgentDraftRepository,
} from '../repositories/agentDraftRepository.js'
import {
  MemoryAgentResponseRepository,
  MongoAgentResponseRepository,
  type AgentResponseRepository,
} from '../repositories/agentResponseRepository.js'

export interface ApiServices {
  configService: ConfigService
  profileService: ProfileService
  recordService: RecordService
  snapshotService: SnapshotService
  agentDraftService: AgentDraftService
  agentResponseService: AgentResponseService
  recordRepository: RecordRepository
  snapshotHeadRepository: SnapshotHeadRepository
  snapshotRepository: SnapshotRepository
}

export async function createApiServices(env: ApiEnv): Promise<ApiServices> {
  const boardConfigState = await loadBoardConfigState(env)
  const boardConfig = boardConfigState.config
  const agentRuntimeConfig = loadAgentRuntimeConfig(process.env)
  const recordsCollection = env.mongodbUri
    ? ((await getRecordsCollection<Document>(
        env.mongodbUri,
        env.mongodbDb
      )) as Collection<Document>)
    : undefined
  const recordRepository: RecordRepository = recordsCollection
    ? new MongoRecordRepository(recordsCollection)
    : new MemoryRecordRepository()
  const snapshotHeadRepository: SnapshotHeadRepository =
    env.mongodbUri && recordsCollection
      ? new MongoSnapshotHeadRepository(
          await getMongoClient(env.mongodbUri),
          recordsCollection,
          (await getSnapshotsCollection<Document>(
            env.mongodbUri,
            env.mongodbDb
          )) as Collection<Document>
        )
      : new MemorySnapshotHeadRepository(recordRepository)
  const snapshotRepository: SnapshotRepository =
    env.mongodbUri
      ? new MongoSnapshotRepository(
          (await getSnapshotsCollection<Document>(
            env.mongodbUri,
            env.mongodbDb
          )) as Collection<Document>
        )
      : new MemorySnapshotRepository()
  const profileRepository: ProfileRepository = env.mongodbUri
    ? new MongoProfileRepository(
        await getProfilesCollection(env.mongodbUri, env.mongodbDb)
      )
    : new MemoryProfileRepository()

  const recordService = new RecordService(
    recordRepository,
    snapshotHeadRepository,
    boardConfig,
    boardConfigState.writable
      ? createBoardConfigPidWriter(boardConfigState.configPath)
      : undefined
  )
  await recordService.reconcilePidState()
  const snapshotService = new SnapshotService(
    recordRepository,
    snapshotHeadRepository,
    snapshotRepository
  )

  // Shared AgentDraftRepository – both services use the same instance
  const agentDraftRepository: AgentDraftRepository = env.mongodbUri
    ? new MongoAgentDraftRepository(
        (await getAgentDraftsCollection<Document>(
          env.mongodbUri,
          env.mongodbDb
        )) as Collection<Document>
      )
    : new MemoryAgentDraftRepository()

  const agentResponseRepository: AgentResponseRepository = env.mongodbUri
    ? new MongoAgentResponseRepository(
        (await getAgentResponsesCollection<Document>(
          env.mongodbUri,
          env.mongodbDb
        )) as Collection<Document>
      )
    : new MemoryAgentResponseRepository()

  return {
    configService: new ConfigService(boardConfig, agentRuntimeConfig),
    profileService: new ProfileService(profileRepository),
    recordService,
    snapshotService,
    agentDraftService: new AgentDraftService(
      agentDraftRepository,
      recordRepository,
      snapshotHeadRepository,
      snapshotRepository
    ),
    agentResponseService: new AgentResponseService(
      agentResponseRepository,
      agentDraftRepository
    ),
    recordRepository,
    snapshotHeadRepository,
    snapshotRepository,
  }
}
