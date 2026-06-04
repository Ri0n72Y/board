import { Hono } from 'hono'
import type { ApiResponse, BoardCurrentProjection } from '@labour-board/shared'
import { ok } from '../http/responses.js'
import type { RecordRepository } from '../repositories/recordRepository.js'
import type { SnapshotHeadRepository } from '../repositories/snapshotHeadRepository.js'
import { getBoardCurrentProjection } from '../services/boardCurrent/boardCurrentService.js'
import { parseBoardCurrentQuery } from './boardCurrentQuery.js'

export function createBoardCurrentRoute(
  repository: RecordRepository,
  snapshotHeadRepository: SnapshotHeadRepository
): Hono {
  const boardCurrent = new Hono()

  boardCurrent.get('/current', async (c) => {
    const query = parseBoardCurrentQuery(new URL(c.req.url).searchParams)

    const projection = await getBoardCurrentProjection({
      repository,
      snapshotHeadRepository,
      query,
    })

    return c.json<ApiResponse<BoardCurrentProjection>>(ok(projection))
  })

  return boardCurrent
}
