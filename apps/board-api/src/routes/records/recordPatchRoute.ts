import { Hono } from 'hono'
import type {
  ApiResponse,
  CreateRecordPatchInput,
  DeepPartial,
  RecordBody,
} from '@labour-board/shared'
import { error, ok } from '../../http/responses.js'
import {
  CurrentHeadConflictError,
  RecordValidationError,
  SnapshotConflictError,
  type PatchResult,
  type RecordService,
} from '../../services/recordService.js'

export function createRecordPatchRoute(recordService: RecordService): Hono {
  const records = new Hono()

  // POST /api/v0/records/:id/patches – append a patch to the record's patch chain
  records.post('/:id/patches', async (c) => {
    const input = await c.req.json<
      CreateRecordPatchInput<DeepPartial<RecordBody>> & {
        targetId?: unknown
      }
    >()

    // targetId must not be in body – it comes from the URL path parameter
    if ('targetId' in input && input.targetId !== undefined) {
      return c.json(
        error(
          'INVALID_PATCH',
          'targetId must not be provided; it is derived from the URL path parameter'
        ),
        400
      )
    }

    try {
      const createdBy = c.req.header('x-actor-id')?.trim()
      const result = await recordService.createRecordPatch(
        c.req.param('id'),
        input as CreateRecordPatchInput<DeepPartial<RecordBody>>,
        createdBy
      )
      if (!result) {
        return c.json(
          error('NOT_FOUND', `Target record ${c.req.param('id')} not found`),
          404
        )
      }

      return c.json<ApiResponse<PatchResult>>(ok(result), 201)
    } catch (caught) {
      if (caught instanceof RecordValidationError) {
        return c.json(error('INVALID_PATCH', caught.message), 400)
      }

      if (
        caught instanceof CurrentHeadConflictError ||
        caught instanceof SnapshotConflictError
      ) {
        return c.json(error('CONFLICT', caught.message), 409)
      }

      throw caught
    }
  })

  return records
}
