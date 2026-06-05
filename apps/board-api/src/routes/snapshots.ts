import { Hono } from 'hono'
import type {
  ApiResponse,
  CreateSnapshotInput,
  CreateSnapshotResponse,
  GetSnapshotResponse,
  ListSnapshotsResponse,
} from '@labour-board/shared'
import { ok, error } from '../http/responses.js'
import type { SnapshotService } from '../services/snapshot/snapshotService.js'

export function createSnapshotsRoute(snapshotService: SnapshotService): Hono {
  const snapshots = new Hono()

  snapshots.post('/', async (c) => {
    const input = await parseCreateSnapshotInput(c.req.raw)
    const actor = c.req.header('x-actor-id')
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
