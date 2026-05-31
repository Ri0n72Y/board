import type {
  BoardConfig,
  CreateRecordPatchInput,
  DeepPartial,
  PatchItem,
  RecordBody,
  RecordId,
} from '@labour-board/shared'
import { getConfiguredTags } from '../../config/boardConfigTools.js'
import type { RecordRepository } from '../../repositories/recordRepository.js'
import type {
  SnapshotHeadRepository,
  StoredPatchDoc,
} from '../../repositories/snapshotHeadRepository.js'
import {
  type PatchResult,
  RecordValidationError,
  assertAppendPatchResult,
  resolveActor,
  toPatchResponse,
} from './recordResponses.js'

// ─── Input shape validation ───

export function assertRecordPatchInputShape(
  input: CreateRecordPatchInput<DeepPartial<RecordBody>>
): void {
  if (!('parentId' in input)) {
    throw new RecordValidationError('parentId is required (string or null)')
  }
  const pid = (input as unknown as Record<string, unknown>).parentId
  if (pid !== null && typeof pid !== 'string') {
    throw new RecordValidationError('parentId must be a string or null')
  }

  if (!('snapshotVersion' in input)) {
    throw new RecordValidationError('snapshotVersion is required (number)')
  }
  if (
    typeof (input as unknown as Record<string, unknown>).snapshotVersion !==
    'number'
  ) {
    throw new RecordValidationError('snapshotVersion must be a number')
  }

  if ('targetId' in (input as unknown as Record<string, unknown>)) {
    throw new RecordValidationError(
      'targetId must not be provided in the body; it is the URL path parameter'
    )
  }
}

// ─── Content validation ───

export function assertRecordPatchNonEmpty(
  input: CreateRecordPatchInput<DeepPartial<RecordBody>>
): void {
  if ('body' in input && input.body === null) {
    throw new RecordValidationError(
      'body must not be null: use a partial body object to clear fields instead'
    )
  }

  const hasBody = 'body' in input
  const hasTags = 'tags' in input
  const hasAssets = 'assets' in input
  const hasRelations = 'relations' in input
  const hasDescription =
    input.description !== undefined && input.description !== ''
  const hasAssignee = 'assignee' in input

  if (
    !hasBody &&
    !hasTags &&
    !hasAssignee &&
    !hasAssets &&
    !hasRelations &&
    !hasDescription
  ) {
    throw new RecordValidationError(
      'Patch must contain at least one change: body, tags, assignee, assets, relations, or description'
    )
  }
}

export function assertRecordPatchInput(
  input: CreateRecordPatchInput<DeepPartial<RecordBody>>,
  boardConfig: BoardConfig
): void {
  const configuredTags = getConfiguredTags(boardConfig)
  for (const tag of input.tags ?? []) {
    if (!configuredTags.has(tag)) {
      throw new RecordValidationError(`Unsupported tag: ${tag}`)
    }
  }

  for (const relation of input.relations ?? []) {
    if (!boardConfig.relations.constraints.includes(relation.constraint)) {
      throw new RecordValidationError(
        `Unsupported relation constraint: ${relation.constraint}`
      )
    }
  }
}

// ─── Main patch submission ───

export interface SubmitRecordPatchParams {
  targetId: string
  input: CreateRecordPatchInput<DeepPartial<RecordBody>>
  createdBy?: string
  repository: RecordRepository
  snapshotHeadRepository: SnapshotHeadRepository
  boardConfig: BoardConfig
}

export async function submitRecordPatch(
  params: SubmitRecordPatchParams
): Promise<PatchResult | null> {
  const { targetId, input, createdBy, repository, snapshotHeadRepository, boardConfig } = params

  // ── Runtime input validation ──
  assertRecordPatchInputShape(input)

  const target = await repository.findById(targetId)
  if (!target) {
    return null
  }

  if (target.tags.includes('status:archived')) {
    throw new RecordValidationError(
      `Cannot patch archived record ${targetId}`
    )
  }

  assertRecordPatchNonEmpty(input)
  assertRecordPatchInput(input, boardConfig)

  const now = new Date().toISOString()
  const actor = resolveActor(createdBy)

  const patchBody: PatchItem<DeepPartial<RecordBody>> = {
    id: crypto.randomUUID() as RecordId,
    pid: target.pid,
    schema: target.schema,
    targetId,
    parentId: input.parentId,
    tags: input.tags,
    assignee: input.assignee,
    body: input.body,
    assets: input.assets,
    relations: input.relations,
    description: input.description,
  }

  const patch: StoredPatchDoc = {
    ...patchBody,
    createdBy: actor,
    createdAt: now,
  }

  const append = await snapshotHeadRepository.appendPatchAndAdvanceHead({
    targetId: targetId as RecordId,
    patch,
    expectedSnapshotVersion: input.snapshotVersion,
    expectedParentId: input.parentId,
  })
  assertAppendPatchResult(append, input.snapshotVersion, input.parentId)

  return {
    patch: toPatchResponse(patch),
    newSnapshotVersion: append.newSnapshotVersion,
  }
}
