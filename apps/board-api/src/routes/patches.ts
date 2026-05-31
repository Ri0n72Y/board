import { Hono } from 'hono'
import type { ApiResponse } from '@labour-board/shared'
import { error, ok } from '../http/responses.js'
import {
  type BoardPatchResponse,
  type RecordService,
} from '../services/recordService.js'

export function createPatchesRoute(recordService: RecordService): Hono {
  const patches = new Hono()

  // GET /api/v0/patches?targetId=xxx – list patches for a target record
  patches.get('/', async (c) => {
    const targetId = c.req.query('targetId')
    if (!targetId) {
      return c.json(
        error('INVALID_QUERY', 'targetId query parameter is required'),
        400
      )
    }

    const list = await recordService.listPatchesByTargetId(targetId)
    return c.json<ApiResponse<BoardPatchResponse[]>>(ok(list))
  })

  // GET /api/v0/patches/:id – read a single patch by id
  patches.get('/:id', async (c) => {
    const patch = await recordService.findPatchById(c.req.param('id'))
    if (!patch) {
      return c.json(error('NOT_FOUND', 'Patch not found'), 404)
    }

    return c.json<ApiResponse<BoardPatchResponse>>(ok(patch))
  })

  return patches
}
