import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { parseDocument } from 'yaml'
import { DEFAULT_BOARD_CONFIG, type BoardConfig } from '@labour-board/shared'
import { isRecord } from '../utils/object.js'
import type { ApiEnv } from './env.js'
import { normalizeBoardConfig } from './boardConfigNormalize.js'
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
    return {
      config: normalizeBoardConfig(rawConfig, configPath),
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
      return {
        config: DEFAULT_BOARD_CONFIG,
        configPath,
        needsPidReconciliation: true,
        warnings: [
          `Board config file not found at ${configPath}; using default development config.`,
        ],
        writable: false,
      }
    }

    if (isFileMissingError(error)) {
      throw new BoardConfigError(
        `Board config file not found at ${configPath}. Create apps/board-api/config/board.yaml, set BOARD_CONFIG_PATH, or explicitly set BOARD_CONFIG_OPTIONAL=true for default development config.`
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
