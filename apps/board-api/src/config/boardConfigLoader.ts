import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { parseDocument } from 'yaml'
import { DEFAULT_BOARD_CONFIG, type BoardConfig } from '@labour-board/shared'
import { isRecord } from '../utils/object.js'
import type { ApiEnv } from './env.js'
import { normalizeBoardConfig } from './boardConfigNormalize.js'
import { createRedisConfigStore } from './redisConfigStore.js'
import {
  collectBoardConfigWarnings,
  needsPidReconciliation,
} from './boardConfigWarnings.js'
import {
  BoardConfigError,
  type LoadedBoardConfig,
  type LoadBoardConfigOptions,
} from './boardConfigTypes.js'

const DEFAULT_CONFIG_PATH = fileURLToPath(
  new URL('../../config/board.yaml', import.meta.url)
)

export async function loadBoardConfig(
  env: ApiEnv,
  options: LoadBoardConfigOptions = {}
): Promise<BoardConfig> {
  return (await loadBoardConfigState(env, options)).config
}

export async function loadBoardConfigState(
  env: ApiEnv,
  options: LoadBoardConfigOptions = {}
): Promise<LoadedBoardConfig> {
  const configPath =
    env.boardConfigPath ?? options.defaultConfigPath ?? DEFAULT_CONFIG_PATH
  const redis = options.redis

  // Redis is the runtime source of truth when available and already seeded.
  if (redis) {
    const store = createRedisConfigStore(redis)
    const cached = await store.loadConfig()
    if (cached) {
      return {
        config: cached,
        configPath,
        needsPidReconciliation: true,
        warnings: [],
        writable: false,
        configStore: store,
      }
    }
  }

  try {
    const source = await readFile(configPath, 'utf8')
    const document = parseDocument(source)
    if (document.errors.length > 0) {
      throw new BoardConfigError(
        `Invalid board config YAML at ${configPath}: ${document.errors
          .map((yamlError) => yamlError.message)
          .join('; ')}`
      )
    }

    const rawConfig = document.toJS() as unknown
    const config = normalizeBoardConfig(rawConfig, configPath)

    // Seed Redis with the YAML config when Redis is enabled.
    if (redis) {
      const store = createRedisConfigStore(redis)
      await store.saveConfig(config)
      return {
        config,
        configPath,
        needsPidReconciliation: needsPidReconciliation(rawConfig),
        warnings: collectBoardConfigWarnings(rawConfig, configPath),
        writable: false,
        configStore: store,
      }
    }

    return {
      config,
      configPath,
      needsPidReconciliation: needsPidReconciliation(rawConfig),
      warnings: collectBoardConfigWarnings(rawConfig, configPath),
      writable: true,
    }
  } catch (error) {
    if (
      isFileMissingError(error) &&
      env.boardConfigOptional &&
      !env.boardConfigPath
    ) {
      const store = redis ? createRedisConfigStore(redis) : undefined
      if (store) {
        // Seed Redis with the default config so the runtime source of truth
        // is established on first boot without a board.yaml file.
        await store.saveConfig(DEFAULT_BOARD_CONFIG)
      }
      return {
        config: DEFAULT_BOARD_CONFIG,
        configPath,
        needsPidReconciliation: true,
        warnings: [
          `Board config file not found at ${configPath}; using default development config.`,
        ],
        writable: false,
        configStore: store,
      }
    }

    if (isFileMissingError(error)) {
      throw new BoardConfigError(
        `Board config file not found at ${configPath}. Copy apps/board-api/config/board.example.yaml to board.yaml, set BOARD_CONFIG_PATH, or explicitly set BOARD_CONFIG_OPTIONAL=true for default development config.`
      )
    }

    throw error
  }
}

function isFileMissingError(error: unknown): boolean {
  return (
    isRecord(error) &&
    error.code === 'ENOENT' &&
    typeof error.message === 'string'
  )
}
