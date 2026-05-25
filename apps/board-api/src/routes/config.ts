import { Hono } from 'hono'
import type { ApiResponse, BoardConfig } from '@labour-board/shared'
import { ok } from '../http/responses.js'
import type { ConfigService } from '../services/configService.js'

export function createConfigRoute(configService: ConfigService): Hono {
  const config = new Hono()

  config.get('/', (c) => {
    return c.json<ApiResponse<BoardConfig>>(ok(configService.getConfig()))
  })

  return config
}
