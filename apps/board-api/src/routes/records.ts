import { Hono } from 'hono'
import type {
  ApiResponse,
  BoardStatus,
  CreateRecordInput,
  RecordBody,
  RecordEnvelope,
  RecordQuery,
  UpdateRecordInput,
} from '@labour-board/shared'
import type { RecordService } from '../services/recordService.js'

type BoardRecord = RecordEnvelope<RecordBody>

function ok<T>(data: T): ApiResponse<T> {
  return { ok: true, data }
}

function error(
  code: string,
  message: string,
  details?: unknown
): ApiResponse<never> {
  return {
    ok: false,
    error: {
      code,
      message,
      details,
    },
  }
}

function parseQuery(searchParams: URLSearchParams): RecordQuery {
  return {
    tag: searchParams.get('tag') ?? undefined,
    status: (searchParams.get('status') as BoardStatus | null) ?? undefined,
    parentId: searchParams.get('parentId') ?? undefined,
    projectId: searchParams.get('projectId') ?? undefined,
    includeDeleted: searchParams.get('includeDeleted') === 'true',
  }
}

export function createRecordsRoute(recordService: RecordService): Hono {
  const records = new Hono()

  records.get('/', async (c) => {
    const data = await recordService.list(
      parseQuery(new URL(c.req.url).searchParams)
    )
    return c.json<ApiResponse<BoardRecord[]>>(ok(data))
  })

  records.get('/:id', async (c) => {
    const record = await recordService.findById(c.req.param('id'))
    if (!record) {
      return c.json(error('NOT_FOUND', 'Record not found'), 404)
    }

    return c.json<ApiResponse<BoardRecord>>(ok(record))
  })

  records.post('/', async (c) => {
    const input = await c.req.json<CreateRecordInput>()
    const record = await recordService.create(input)
    return c.json<ApiResponse<BoardRecord>>(ok(record), 201)
  })

  records.patch('/:id', async (c) => {
    const input = await c.req.json<UpdateRecordInput>()
    const record = await recordService.update(c.req.param('id'), input)
    if (!record) {
      return c.json(error('NOT_FOUND', 'Record not found'), 404)
    }

    return c.json<ApiResponse<BoardRecord>>(ok(record))
  })

  records.delete('/:id', async (c) => {
    const record = await recordService.delete(c.req.param('id'))
    if (!record) {
      return c.json(error('NOT_FOUND', 'Record not found'), 404)
    }

    return c.json<ApiResponse<BoardRecord>>(ok(record))
  })

  return records
}
