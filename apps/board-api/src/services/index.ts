import type { ApiEnv } from '../config/env.js'
import { getRecordsCollection } from '../db/mongo.js'
import {
  MemoryRecordRepository,
  MongoRecordRepository,
  type BoardRecord,
} from '../repositories/recordRepository.js'
import { RecordService } from './recordService.js'

export interface ApiServices {
  recordService: RecordService
}

export async function createApiServices(env: ApiEnv): Promise<ApiServices> {
  const repository = env.mongodbUri
    ? new MongoRecordRepository(
        await getRecordsCollection<BoardRecord>(env.mongodbUri, env.mongodbDb)
      )
    : new MemoryRecordRepository()

  return {
    recordService: new RecordService(repository),
  }
}
