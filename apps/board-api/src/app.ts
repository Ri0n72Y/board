import { Hono } from 'hono'
import { loadApiEnv } from './config/env.js'
import { ok } from './http/responses.js'
import { mountApiRoutes } from './routes/index.js'
import { createApiServices } from './services/index.js'

export async function createApp(): Promise<Hono> {
  const app = new Hono()
  const env = loadApiEnv()
  const services = await createApiServices(env)

  app.get('/health', (c) => c.json(ok({ status: 'ok' })))
  mountApiRoutes(app, services)

  return app
}
