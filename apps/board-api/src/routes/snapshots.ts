import { Hono } from 'hono'
import type {
  ApiResponse,
  BoardExportResult,
  CreateSnapshotInput,
  CreateSnapshotResponse,
  GetSnapshotResponse,
  ListSnapshotsResponse,
} from '@labour-board/shared'
import {
  buildBoardContextPack,
  buildBoardMarkdownExport,
} from '@labour-board/shared'
import { ok, error } from '../http/responses.js'
import type { SnapshotService } from '../services/snapshot/snapshotService.js'
import {
  applyExportFilters,
  BoardExportQueryError,
  parseBoardExportOptions,
} from './boardExportQuery.js'

export function createSnapshotsRoute(snapshotService: SnapshotService): Hono {
  const snapshots = new Hono()

  snapshots.post('/', async (c) => {
    const input = await parseCreateSnapshotInput(c.req.raw)
    const actor = c.req.header('x-actor-id') ?? undefined
    const snapshot = await snapshotService.createManualSnapshot(input, actor)
    return c.json<ApiResponse<CreateSnapshotResponse>>(
      ok({ snapshot }),
      201
    )
  })

  snapshots.get('/', async (c) => {
    const list = await snapshotService.listSnapshots()
    return c.json<ApiResponse<ListSnapshotsResponse>>(
      ok({ snapshots: list })
    )
  })

  snapshots.get('/:id', async (c) => {
    const snapshot = await snapshotService.getSnapshot(c.req.param('id'))
    if (!snapshot) {
      return c.json(
        error('NOT_FOUND', `Snapshot ${c.req.param('id')} not found`),
        404
      )
    }

    return c.json<ApiResponse<GetSnapshotResponse>>(ok({ snapshot }))
  })

  snapshots.get('/:id/export', async (c) => {
    const snapshot = await snapshotService.getSnapshot(c.req.param('id'))
    if (!snapshot) {
      return c.json(
        error('NOT_FOUND', `Snapshot ${c.req.param('id')} not found`),
        404
      )
    }

    try {
      const searchParams = new URL(c.req.url).searchParams
      const options = parseBoardExportOptions(searchParams, 'snapshot', {
        id: snapshot.id,
        createdAt: snapshot.createdAt,
        reason: snapshot.reason,
      })
      const projection = applyExportFilters(snapshot.projection, options.filters ?? {})
      const exported =
        'profile' in options
          ? buildBoardContextPack(projection, options)
          : buildBoardMarkdownExport(projection, options)
      return c.json<ApiResponse<BoardExportResult>>(ok(exported))
    } catch (caught) {
      if (caught instanceof BoardExportQueryError) {
        return c.json(error('INVALID_EXPORT', caught.message), 400)
      }
      throw caught
    }
  })

  return snapshots
}

async function parseCreateSnapshotInput(
  request: Request
): Promise<CreateSnapshotInput> {
  if (!request.headers.get('content-type')?.includes('application/json')) {
    return {}
  }

  const raw = (await request.json()) as unknown
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {}
  }

  const reason = (raw as Record<string, unknown>).reason
  return typeof reason === 'string' ? { reason } : {}
}
