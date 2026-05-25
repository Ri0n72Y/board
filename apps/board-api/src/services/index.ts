import type { ApiEnv } from '../config/env.js'
import {
  createBoardConfigPidWriter,
  loadBoardConfigState,
} from '../config/boardConfig.js'
import { getProfilesCollection, getRecordsCollection } from '../db/mongo.js'
import {
  MemoryProfileRepository,
  MongoProfileRepository,
  type ProfileRepository,
} from '../repositories/profileRepository.js'
import {
  MemoryRecordRepository,
  MongoRecordRepository,
  type BoardRecord,
  type RecordRepository,
} from '../repositories/recordRepository.js'
import { RecordService } from './recordService.js'
import { ConfigService } from './configService.js'
import { ProfileService } from './profileService.js'

export interface ApiServices {
  configService: ConfigService
  profileService: ProfileService
  recordService: RecordService
}

export async function createApiServices(env: ApiEnv): Promise<ApiServices> {
  const boardConfigState = await loadBoardConfigState(env)
  const boardConfig = boardConfigState.config
  const recordRepository: RecordRepository = env.mongodbUri
    ? new MongoRecordRepository(
        await getRecordsCollection<BoardRecord>(env.mongodbUri, env.mongodbDb)
      )
    : new MemoryRecordRepository()
  const profileRepository: ProfileRepository = env.mongodbUri
    ? new MongoProfileRepository(
        await getProfilesCollection(env.mongodbUri, env.mongodbDb)
      )
    : new MemoryProfileRepository()

  const recordService = new RecordService(
    recordRepository,
    boardConfig,
    boardConfigState.writable
      ? createBoardConfigPidWriter(boardConfigState.configPath)
      : undefined
  )
  await recordService.reconcilePidState()

  return {
    configService: new ConfigService(boardConfig),
    profileService: new ProfileService(profileRepository),
    recordService,
  }
}
