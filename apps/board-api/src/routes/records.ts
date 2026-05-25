import { Hono } from 'hono'
import type {
  ApiResponse,
  CreatePatchInput,
  CreateRecordInput,
  DeepPartial,
  RecordBody,
  RecordItem,
  RecordQuery,
  Tag,
} from '@labour-board/shared'
import { error, ok } from '../http/responses.js'
import {
  RecordValidationError,
  type RecordService,
} from '../services/recordService.js'

type BoardRecord = RecordItem<RecordBody>

function parseQuery(searchParams: URLSearchParams): RecordQuery {
  const tag = searchParams.get('tag')
  const tags = searchParams.getAll('tags') as Tag[]
  const tagMatch = searchParams.get('tagMatch')
  return {
    tags: tag ? [tag as Tag] : tags.length ? tags : undefined,
    tagMatch: tagMatch === 'any' ? 'any' : 'all',
    id: searchParams.get('id') ?? undefined,
    pid: searchParams.get('pid') ?? undefined,
    schema: searchParams.get('schema') ?? undefined,
    assignee: searchParams.get('assignee') ?? undefined,
    assetId: searchParams.get('assetId') ?? undefined,
    relationTarget: searchParams.get('relationTarget') ?? undefined,
    q: searchParams.get('q') ?? undefined,
    limit: parseLimit(searchParams.get('limit')),
    includeArchived:
      searchParams.get('includeArchived') === 'true' ||
      searchParams.get('includeDeleted') === 'true',
  }
}

function parseLimit(value: string | null): number | undefined {
  if (!value) {
    return undefined
  }

  const limit = Number(value)
  return Number.isInteger(limit) && limit > 0 ? limit : undefined
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
    const input = await c.req.json<CreateRecordInput<RecordBody>>()
    try {
      const record = await recordService.create(input)
      return c.json<ApiResponse<BoardRecord>>(ok(record), 201)
    } catch (caught) {
      if (caught instanceof RecordValidationError) {
        return c.json(error('INVALID_RECORD', caught.message), 400)
      }

      throw caught
    }
  })

  records.patch('/:id', async (c) => {
    const input = await c.req.json<CreatePatchInput<DeepPartial<RecordBody>>>()
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
