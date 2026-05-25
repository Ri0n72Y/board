import { getPath, isRecord } from '../utils/object.js'
import { isPositiveInteger } from './boardConfigNormalize.js'

export function collectBoardConfigWarnings(
  value: unknown,
  configPath: string
): string[] {
  const warnings: string[] = []
  if (!isRecord(value)) {
    return warnings
  }

  warnIfDefaultedArray(warnings, value, ['records', 'schemas'], configPath)
  warnIfDefaultedArray(warnings, value, ['pid', 'prefixes'], configPath)
  warnIfDefaultedObject(warnings, value, ['pid', 'schemaPrefixes'], configPath)
  warnIfDefaultedPositiveInteger(
    warnings,
    value,
    ['pid', 'nextNumber'],
    configPath
  )
  warnIfDefaultedArray(warnings, value, ['tags', 'namespaces'], configPath)
  warnIfDefaultedArray(warnings, value, ['tags', 'status', 'required'], configPath)
  warnIfDefaultedArray(warnings, value, ['tags', 'status', 'custom'], configPath)
  warnIfDefaultedArray(warnings, value, ['tags', 'priority', 'defaults'], configPath)
  warnIfDefaultedArray(warnings, value, ['tags', 'priority', 'custom'], configPath)
  warnIfDefaultedArray(warnings, value, ['tags', 'asset', 'defaults'], configPath)
  warnIfDefaultedArray(warnings, value, ['tags', 'asset', 'custom'], configPath)
  warnIfDefaultedArray(warnings, value, ['tags', 'transaction', 'defaults'], configPath)
  warnIfDefaultedArray(warnings, value, ['tags', 'transaction', 'custom'], configPath)
  warnIfDefaultedArray(warnings, value, ['tags', 'custom'], configPath)
  warnIfDefaultedArray(warnings, value, ['relations', 'constraints'], configPath)
  warnIfDefaultedArray(warnings, value, ['snapshot', 'excludeTags'], configPath)

  for (const tag of getTagDefinitions(value)) {
    if (!isRecord(tag) || typeof tag.id !== 'string') continue
    if (!/^[^:\s]+:[^:\s]+$/.test(tag.id)) {
      warnings.push(
        `Invalid tag id format at ${configPath}: ${tag.id}; keeping original value.`
      )
    }
  }

  return warnings
}

export function needsPidReconciliation(value: unknown): boolean {
  return !isPositiveInteger(getPath(value, ['pid', 'nextNumber']))
}

function warnIfDefaultedArray(
  warnings: string[],
  value: unknown,
  path: string[],
  configPath: string
): void {
  const current = getPath(value, path)
  if (!Array.isArray(current) || current.length === 0) {
    warnings.push(
      `${path.join('.')} is empty or invalid at ${configPath}; using default value.`
    )
  }
}

function warnIfDefaultedObject(
  warnings: string[],
  value: unknown,
  path: string[],
  configPath: string
): void {
  if (!isRecord(getPath(value, path))) {
    warnings.push(
      `${path.join('.')} is empty or invalid at ${configPath}; using default value.`
    )
  }
}

function warnIfDefaultedPositiveInteger(
  warnings: string[],
  value: unknown,
  path: string[],
  configPath: string
): void {
  if (!isPositiveInteger(getPath(value, path))) {
    warnings.push(
      `${path.join('.')} is invalid at ${configPath}; using default value.`
    )
  }
}

function getTagDefinitions(value: Record<string, unknown>): unknown[] {
  return [
    getPath(value, ['tags', 'status', 'required']),
    getPath(value, ['tags', 'status', 'custom']),
    getPath(value, ['tags', 'priority', 'defaults']),
    getPath(value, ['tags', 'priority', 'custom']),
    getPath(value, ['tags', 'asset', 'defaults']),
    getPath(value, ['tags', 'asset', 'custom']),
    getPath(value, ['tags', 'transaction', 'defaults']),
    getPath(value, ['tags', 'transaction', 'custom']),
    getPath(value, ['tags', 'custom']),
  ].flatMap((items) => (Array.isArray(items) ? items : []))
}
