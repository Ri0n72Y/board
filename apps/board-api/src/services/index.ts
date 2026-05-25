import type { ApiEnv } from '../config/env.js'
import { loadBoardConfig } from '../config/boardConfig.js'
import { getRecordsCollection } from '../db/mongo.js'
import {
  MemoryRecordRepository,
  MongoRecordRepository,
  type BoardRecord,
} from '../repositories/recordRepository.js'
import { RecordService } from './recordService.js'
import { ConfigService } from './configService.js'

export interface ApiServices {
  configService: ConfigService
  recordService: RecordService
}

export async function createApiServices(env: ApiEnv): Promise<ApiServices> {
  const boardConfig = await loadBoardConfig(env)
  const repository = env.mongodbUri
    ? new MongoRecordRepository(
        await getRecordsCollection<BoardRecord>(env.mongodbUri, env.mongodbDb)
      )
    : new MemoryRecordRepository()

  return {
    configService: new ConfigService(boardConfig),
    recordService: new RecordService(repository),
  }
}
