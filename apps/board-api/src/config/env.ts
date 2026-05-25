export interface ApiEnv {
  mongodbUri?: string
  mongodbDb: string
  port: number
}

export function loadApiEnv(env: NodeJS.ProcessEnv = process.env): ApiEnv {
  return {
    mongodbUri: env.MONGODB_URI,
    mongodbDb: env.MONGODB_DB ?? 'labour_board',
    port: Number(env.PORT ?? 8787),
  }
}
