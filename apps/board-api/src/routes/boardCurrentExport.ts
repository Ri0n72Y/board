import { Hono } from 'hono'
import type { ApiResponse, BoardExportResult } from '@labour-board/shared'
import {
  buildBoardContextPack,
  buildBoardMarkdownExport,
} from '@labour-board/shared'
import { ok, error } from '../http/responses.js'
import type { RecordRepository } from '../repositories/recordRepository.js'
import type { SnapshotHeadRepository } from '../repositories/snapshotHeadRepository.js'
import { getBoardCurrentProjection } from '../services/boardCurrent/boardCurrentService.js'
import {
  BoardExportQueryError,
  parseBoardExportOptions,
} from './boardExportQuery.js'

export function createBoardCurrentExportRoute(
  repository: RecordRepository,
  snapshotHeadRepository: SnapshotHeadRepository
): Hono {
  const route = new Hono()

  route.get('/current/export', async (c) => {
    const searchParams = new URL(c.req.url).searchParams
    try {
      const options = parseBoardExportOptions(searchParams, 'current-board')
      const projection = await getBoardCurrentProjection({
        repository,
        snapshotHeadRepository,
        query: { includeArchived: options.filters?.includeArchived },
      })
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

  return route
}
