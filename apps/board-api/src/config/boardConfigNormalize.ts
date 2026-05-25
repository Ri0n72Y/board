import { DEFAULT_BOARD_CONFIG, type BoardConfig } from '@labour-board/shared'
import { getPath, isRecord } from '../utils/object.js'
import { BoardConfigError } from './boardConfigTypes.js'

export function normalizeBoardConfig(
  value: unknown,
  configPath: string
): BoardConfig {
  const fallback: BoardConfig = DEFAULT_BOARD_CONFIG
  if (!isRecord(value)) {
    throw invalidConfig(configPath, 'root must be a mapping')
  }

  return {
    records: {
      schemas: stringArrayOrDefault(
        getPath(value, ['records', 'schemas']),
        fallback.records.schemas
      ),
    },
    pid: {
      prefixes: stringArrayOrDefault(
        getPath(value, ['pid', 'prefixes']),
        fallback.pid.prefixes
      ),
      schemaPrefixes: schemaPrefixesOrDefault(
        getPath(value, ['pid', 'schemaPrefixes']),
        fallback.pid.schemaPrefixes
      ),
      nextNumber: positiveIntegerOrDefault(
        getPath(value, ['pid', 'nextNumber']),
        fallback.pid.nextNumber
      ),
      latest: normalizePidLatest(getPath(value, ['pid', 'latest'])),
    },
    tags: {
      namespaces: arrayOrDefault(
        getPath(value, ['tags', 'namespaces']),
        fallback.tags.namespaces
      ),
      status: {
        required: arrayOrDefault(
          getPath(value, ['tags', 'status', 'required']),
          fallback.tags.status.required
        ),
        custom: arrayOrDefault(
          getPath(value, ['tags', 'status', 'custom']),
          fallback.tags.status.custom
        ),
      },
      priority: {
        defaults: arrayOrDefault(
          getPath(value, ['tags', 'priority', 'defaults']),
          fallback.tags.priority.defaults
        ),
        custom: arrayOrDefault(
          getPath(value, ['tags', 'priority', 'custom']),
          fallback.tags.priority.custom
        ),
      },
      asset: {
        defaults: arrayOrDefault(
          getPath(value, ['tags', 'asset', 'defaults']),
          fallback.tags.asset.defaults
        ),
        custom: arrayOrDefault(
          getPath(value, ['tags', 'asset', 'custom']),
          fallback.tags.asset.custom
        ),
      },
      transaction: {
        defaults: arrayOrDefault(
          getPath(value, ['tags', 'transaction', 'defaults']),
          fallback.tags.transaction.defaults
        ),
        custom: arrayOrDefault(
          getPath(value, ['tags', 'transaction', 'custom']),
          fallback.tags.transaction.custom
        ),
      },
      custom: arrayOrDefault(
        getPath(value, ['tags', 'custom']),
        fallback.tags.custom
      ),
    },
    relations: {
      constraints: stringArrayOrDefault(
        getPath(value, ['relations', 'constraints']),
        fallback.relations.constraints
      ),
    },
    snapshot: {
      excludeTags: stringArrayOrDefault(
        getPath(value, ['snapshot', 'excludeTags']),
        fallback.snapshot.excludeTags
      ) as BoardConfig['snapshot']['excludeTags'],
    },
  }
}

export function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
}

function stringArrayOrDefault<T extends readonly string[]>(
  value: unknown,
  fallback: T
): string[] {
  return Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => typeof item === 'string')
    ? [...value]
    : [...fallback]
}

function arrayOrDefault<T>(value: unknown, fallback: readonly T[]): T[] {
  return Array.isArray(value) ? (value as T[]) : [...fallback]
}

function positiveIntegerOrDefault(value: unknown, fallback: number): number {
  return isPositiveInteger(value) ? value : fallback
}

function schemaPrefixesOrDefault(
  value: unknown,
  fallback: BoardConfig['pid']['schemaPrefixes']
): BoardConfig['pid']['schemaPrefixes'] {
  if (!isRecord(value)) {
    return { ...fallback }
  }

  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string'
    )
  )
}

function normalizePidLatest(value: unknown): BoardConfig['pid']['latest'] {
  if (!isRecord(value)) {
    return undefined
  }

  const latest: NonNullable<BoardConfig['pid']['latest']> = {}
  for (const [prefix, entry] of Object.entries(value)) {
    if (
      isRecord(entry) &&
      typeof entry.recordId === 'string' &&
      typeof entry.pid === 'string' &&
      isPositiveInteger(entry.number)
    ) {
      latest[prefix] = {
        recordId: entry.recordId,
        pid: entry.pid,
        number: entry.number,
      }
    }
  }

  return Object.keys(latest).length ? latest : undefined
}

function invalidConfig(configPath: string, reason: string): BoardConfigError {
  return new BoardConfigError(`Invalid board config at ${configPath}: ${reason}`)
}
