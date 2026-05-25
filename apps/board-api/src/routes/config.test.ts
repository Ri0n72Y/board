import { Hono } from 'hono'
import { DEFAULT_BOARD_CONFIG } from '@labour-board/shared'
import { describe, expect, it } from 'vitest'
import { ConfigService } from '../services/configService.js'
import { createConfigRoute } from './config.js'

describe('createConfigRoute', () => {
  it('returns the current board config', async () => {
    const app = new Hono()
    app.route(
      '/api/v0/config',
      createConfigRoute(new ConfigService(DEFAULT_BOARD_CONFIG))
    )

    const response = await app.request('/api/v0/config')
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toEqual({
      ok: true,
      data: DEFAULT_BOARD_CONFIG,
    })
  })
})
