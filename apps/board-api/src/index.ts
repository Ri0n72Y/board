import 'dotenv/config'
import { serve } from '@hono/node-server'
import { createApp } from './app.js'

const port = Number(process.env.PORT ?? 8787)
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
