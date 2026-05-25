export interface ApiEnv {
  boardConfigOptional: boolean
  boardConfigPath?: string
  mongodbUri?: string
  mongodbDb: string
  port: number
}

export function loadApiEnv(env: NodeJS.ProcessEnv = process.env): ApiEnv {
  return {
    boardConfigOptional: env.BOARD_CONFIG_OPTIONAL === 'true',
    boardConfigPath: env.BOARD_CONFIG_PATH,
    mongodbUri: env.MONGODB_URI,
    mongodbDb: env.MONGODB_DB ?? 'labour_board',
    port: Number(env.PORT ?? 8787),
  }
}
