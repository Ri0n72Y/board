import { Hono } from 'hono'
import type { ApiResponse, BoardConfig } from '@labour-board/shared'
import { ok } from '../http/responses.js'
import type { ConfigService } from '../services/configService.js'

export function createConfigRoute(configService: ConfigService): Hono {
  const config = new Hono()

  config.get('/', (c) => {
    return c.json<ApiResponse<BoardConfig>>(ok(configService.getConfig()))
  })

  config.post('/', async (c) => {
    const body = await c.req.json<Partial<BoardConfig>>().catch(() => null)
    if (!body) {
      return c.json<ApiResponse<never>>(
        { ok: false, error: { code: 'INVALID_BODY', message: 'Invalid JSON body' } },
        400
      )
    }
    const next = await configService.updateConfig({
      ...configService.getConfig(),
      ...body,
      pid: {
        // Preserve the live runtime pid state (nextNumber/latest) regardless
        // of what the client sends; those live in Redis and are managed by
        // the PidAllocator. prefixes/schemaPrefixes come from the client or
        // fall back to the current config.
        prefixes: body.pid?.prefixes ?? configService.getConfig().pid.prefixes,
        schemaPrefixes:
          body.pid?.schemaPrefixes ?? configService.getConfig().pid.schemaPrefixes,
        nextNumber: configService.getConfig().pid.nextNumber,
        latest: configService.getConfig().pid.latest,
      },
    })
    return c.json<ApiResponse<BoardConfig>>(ok(next))
  })

  // GET /api/v0/config/yaml — export static config as YAML
  config.get('/yaml', (c) => {
    const yamlText = configService.exportYaml()
    c.header('content-type', 'text/yaml; charset=utf-8')
    c.header(
      'content-disposition',
      'attachment; filename="board.config.yaml"'
    )
    return c.body(yamlText)
  })

  // POST /api/v0/config/yaml — import static config from YAML
  config.post('/yaml', async (c) => {
    const yamlText = await c.req.text().catch(() => '')
    if (!yamlText.trim()) {
      return c.json<ApiResponse<never>>(
        { ok: false, error: { code: 'EMPTY_YAML', message: 'Empty YAML body' } },
        400
      )
    }
    try {
      const next = await configService.importYaml(yamlText)
      return c.json<ApiResponse<BoardConfig>>(ok(next))
    } catch (error) {
      return c.json<ApiResponse<never>>(
        {
          ok: false,
          error: {
            code: 'INVALID_YAML',
            message: error instanceof Error ? error.message : String(error),
          },
        },
        400
      )
    }
  })

  return config
}
