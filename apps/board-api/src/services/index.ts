import type { ApiEnv } from '../config/env.js'
import { loadBoardConfig } from '../config/boardConfig.js'
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
  const boardConfig = await loadBoardConfig(env)
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

  return {
    configService: new ConfigService(boardConfig),
    profileService: new ProfileService(profileRepository),
    recordService: new RecordService(recordRepository, boardConfig),
  }
}
