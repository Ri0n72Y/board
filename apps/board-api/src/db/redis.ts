import { Redis } from 'ioredis'

let client: Redis | undefined

export function getRedisClient(uri: string): Redis {
  if (!client) {
    client = new Redis(uri, {
      maxRetriesPerRequest: 2,
      enableReadyCheck: true,
    })
  }
  return client
}

export function closeRedisClient(): Promise<'OK'> | undefined {
  if (!client) return undefined
  const closing = client.quit()
  client = undefined
  return closing
}

export const BOARD_CONFIG_REDIS_KEY = 'board:config'
export const BOARD_CONFIG_VERSION_KEY = 'board:config:version'
export const BOARD_PID_NEXT_KEY = 'board:pid:next'
export const BOARD_PID_LATEST_KEY = 'board:pid:latest'
