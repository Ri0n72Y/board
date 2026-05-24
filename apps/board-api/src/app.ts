import { Hono } from 'hono'
import { getRecordsCollection } from './db/mongo.js'
import {
  MemoryRecordRepository,
  MongoRecordRepository,
  type BoardRecord,
} from './repositories/recordRepository.js'
import { createRecordsRoute } from './routes/records.js'
import { RecordService } from './services/recordService.js'

export async function createApp(): Promise<Hono> {
  const app = new Hono()
  const mongodbUri = process.env.MONGODB_URI
  const repository = mongodbUri
    ? new MongoRecordRepository(
        await getRecordsCollection<BoardRecord>(mongodbUri)
      )
    : new MemoryRecordRepository()
  const recordService = new RecordService(repository)

  app.get('/health', (c) => c.json({ ok: true, data: { status: 'ok' } }))
  app.route('/api/v0/records', createRecordsRoute(recordService))

  return app
}
