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

export interface ApiServices {
  configService: ConfigService
  profileService: ProfileService
  recordService: RecordService
  snapshotService: SnapshotService
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

  return {
    configService: new ConfigService(boardConfig, agentRuntimeConfig),
    profileService: new ProfileService(profileRepository),
    recordService,
    snapshotService,
    recordRepository,
    snapshotHeadRepository,
    snapshotRepository,
  }
}
