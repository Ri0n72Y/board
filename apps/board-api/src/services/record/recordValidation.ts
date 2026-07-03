import { getConfiguredTags } from '../../config/boardConfigTools.js'
import type {
  BoardConfig,
  CreateRecordInput,
  RecordBody,
} from '@labour-board/shared'
import { RecordValidationError } from '../recordService.js'

export function assertCreateInput(
  input: CreateRecordInput<RecordBody>,
  config: BoardConfig
): void {
  if (!config.records.schemas.includes(input.schema)) {
    throw new RecordValidationError(
      `Unsupported record schema: ${input.schema}`
    )
  }

  if (input.pidPrefix && !config.pid.prefixes.includes(input.pidPrefix)) {
    throw new RecordValidationError(
      `Unsupported pid prefix: ${input.pidPrefix}`
    )
  }

  const configuredTags = getConfiguredTags(config)
  for (const tag of input.tags ?? []) {
    if (!configuredTags.has(tag)) {
      throw new RecordValidationError(`Unsupported tag: ${tag}`)
    }
  }

  for (const relation of input.relations ?? []) {
    if (!config.relations.constraints.includes(relation.constraint)) {
      throw new RecordValidationError(
        `Unsupported relation constraint: ${relation.constraint}`
      )
    }
  }
}
