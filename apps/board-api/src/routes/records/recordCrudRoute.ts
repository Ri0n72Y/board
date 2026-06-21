import { Hono } from 'hono'
import type {
  ApiResponse,
  CreateRecordInput,
  RecordBody,
} from '@labour-board/shared'
import { error, ok } from '../../http/responses.js'
import {
  RecordValidationError,
  type BoardRecordResponse,
  type RecordService,
} from '../../services/recordService.js'
import { parseQuery } from './queryParser.js'

export function createRecordCrudRoute(recordService: RecordService): Hono {
  const records = new Hono()

  records.get('/', async (c) => {
    const data = await recordService.list(
      parseQuery(new URL(c.req.url).searchParams)
    )
    return c.json<ApiResponse<BoardRecordResponse[]>>(ok(data))
  })

  records.get('/:id', async (c) => {
    const record = await recordService.findById(c.req.param('id'))
    if (!record) {
      return c.json(error('NOT_FOUND', 'Record not found'), 404)
    }

    return c.json<ApiResponse<BoardRecordResponse>>(ok(record))
  })

  records.post('/', async (c) => {
    const input = await c.req.json<CreateRecordInput<RecordBody>>()
    try {
      const createdBy = c.req.header('x-actor-id')?.trim()
      const record = await recordService.create(input, createdBy)
      return c.json<ApiResponse<BoardRecordResponse>>(ok(record), 201)
    } catch (caught) {
      if (caught instanceof RecordValidationError) {
        return c.json(error('INVALID_RECORD', caught.message), 400)
      }

      throw caught
    }
  })

  return records
}
