import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { parseDocument } from 'yaml'
import { DEFAULT_BOARD_CONFIG, type BoardConfig } from '@labour-board/shared'
import type { ApiEnv } from './env.js'

const DEFAULT_CONFIG_PATH = fileURLToPath(
  new URL('../../config/board.yaml', import.meta.url)
)

interface LoadBoardConfigOptions {
  defaultConfigPath?: string
}

export class BoardConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BoardConfigError'
  }
}

export async function loadBoardConfig(
  env: ApiEnv,
  options: LoadBoardConfigOptions = {}
): Promise<BoardConfig> {
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

    const config = document.toJS() as unknown
    assertBoardConfig(config, configPath)
    return config
  } catch (error) {
    if (
      isFileMissingError(error) &&
      env.boardConfigOptional &&
      !env.boardConfigPath
    ) {
      return DEFAULT_BOARD_CONFIG
    }

    if (isFileMissingError(error)) {
      throw new BoardConfigError(
        `Board config file not found at ${configPath}. Create apps/board-api/config/board.yaml, set BOARD_CONFIG_PATH, or explicitly set BOARD_CONFIG_OPTIONAL=true for default development config.`
      )
    }

    throw error
  }
}

function assertBoardConfig(
  value: unknown,
  configPath: string
): asserts value is BoardConfig {
  if (!isRecord(value)) {
    throw invalidConfig(configPath, 'root must be a mapping')
  }

  assertStringArray(value.records, 'schemas', configPath, 'records.schemas')
  assertStringArray(value.pid, 'prefixes', configPath, 'pid.prefixes')
  assertNumber(value.pid, 'nextNumber', configPath, 'pid.nextNumber')
  assertArray(value.tags, 'namespaces', configPath, 'tags.namespaces')
  assertTagGroup(value.tags, 'status', ['required', 'custom'], configPath)
  assertTagGroup(value.tags, 'priority', ['defaults', 'custom'], configPath)
  assertTagGroup(value.tags, 'asset', ['defaults', 'custom'], configPath)
  assertTagGroup(value.tags, 'transaction', ['defaults', 'custom'], configPath)
  assertArray(value.tags, 'custom', configPath, 'tags.custom')
  assertStringArray(
    value.relations,
    'constraints',
    configPath,
    'relations.constraints'
  )
  assertStringArray(
    value.snapshot,
    'excludeTags',
    configPath,
    'snapshot.excludeTags'
  )
}

function assertTagGroup(
  parent: unknown,
  key: string,
  fields: string[],
  configPath: string
): void {
  if (!isRecord(parent)) {
    throw invalidConfig(configPath, 'tags must be a mapping')
  }

  const group = parent[key]
  if (!isRecord(group)) {
    throw invalidConfig(configPath, `tags.${key} must be a mapping`)
  }

  for (const field of fields) {
    assertArray(group, field, configPath, `tags.${key}.${field}`)
  }
}

function assertStringArray(
  parent: unknown,
  key: string,
  configPath: string,
  label: string
): void {
  assertArray(parent, key, configPath, label)
  const items = (parent as Record<string, unknown>)[key]
  if (!Array.isArray(items) || !items.every((item) => typeof item === 'string')) {
    throw invalidConfig(configPath, `${label} must contain only strings`)
  }
}

function assertArray(
  parent: unknown,
  key: string,
  configPath: string,
  label: string
): void {
  if (!isRecord(parent) || !Array.isArray(parent[key])) {
    throw invalidConfig(configPath, `${label} must be an array`)
  }
}

function assertNumber(
  parent: unknown,
  key: string,
  configPath: string,
  label: string
): void {
  if (!isRecord(parent) || typeof parent[key] !== 'number') {
    throw invalidConfig(configPath, `${label} must be a number`)
  }
}

function invalidConfig(configPath: string, reason: string): BoardConfigError {
  return new BoardConfigError(`Invalid board config at ${configPath}: ${reason}`)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isFileMissingError(error: unknown): boolean {
  return (
    isRecord(error) &&
    error.code === 'ENOENT' &&
    typeof error.message === 'string'
  )
}
