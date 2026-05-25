import 'dotenv/config'
import { serve } from '@hono/node-server'
import { createApp } from './app.js'
import { loadApiEnv } from './config/env.js'

const { port } = loadApiEnv()
const app = await createApp()

serve(
  {
    fetch: app.fetch,
    port,
  },
  (info) => {
    console.log(`board-api listening on http://localhost:${info.port}`)
  }
)
