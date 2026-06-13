import type {
  BoardConfig,
  CreateRecordPatchInput,
  DeepPartial,
  PatchItem,
  RecordBody,
  RecordId,
  Tag,
  TagChanges,
} from '@labour-board/shared'
import { applyRecordPatch, tagNamespace } from '@labour-board/shared'
import { getConfiguredTags } from '../../config/boardConfigTools.js'
import type { RecordRepository } from '../../repositories/recordRepository.js'
import type { StoredPatchDoc } from '../../repositories/snapshotHeadRepository.js'
import { getRecordCurrentHead } from './recordCurrentHead.js'
import { reconstructPatchChain, replayRecordHistory } from './recordHistory.js'
import {
  CurrentHeadConflictError,
  type PatchResult,
  RecordValidationError,
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

  const rawInput = input as unknown as Record<string, unknown>
  if (!('currentVersion' in input) && !('snapshotVersion' in rawInput)) {
    throw new RecordValidationError('currentVersion is required (number)')
  }
  const observedVersion = getRawObservedVersion(input)
  if (typeof observedVersion !== 'number') {
    throw new RecordValidationError('currentVersion must be a number')
  }

  if ('targetId' in (input as unknown as Record<string, unknown>)) {
    throw new RecordValidationError(
      'targetId must not be provided in the body; it is the URL path parameter'
    )
  }

  if ('tags' in rawInput) {
    throw new RecordValidationError(
      'tags must not be provided in patch records; use tagChanges instead'
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
  const hasTagChanges = 'tagChanges' in input
  const hasAssets = 'assets' in input
  const hasRelations = 'relations' in input
  const hasDescription =
    input.description !== undefined && input.description !== ''
  const hasAssignee = 'assignee' in input

  if (
    !hasBody &&
    !hasTagChanges &&
    !hasAssignee &&
    !hasAssets &&
    !hasRelations &&
    !hasDescription
  ) {
    throw new RecordValidationError(
      'Patch must contain at least one change: body, tagChanges, assignee, assets, relations, or description'
    )
  }
}

export function assertRecordPatchInput(
  input: CreateRecordPatchInput<DeepPartial<RecordBody>>,
  boardConfig: BoardConfig
): void {
  const configuredTags = getConfiguredTags(boardConfig)
  assertTagChangesInput(input.tagChanges, configuredTags)

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
  boardConfig: BoardConfig
}

export async function submitRecordPatch(
  params: SubmitRecordPatchParams
): Promise<PatchResult | null> {
  const { targetId, input, createdBy, repository, boardConfig } = params

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

  const head = await getRecordCurrentHead({ recordId: targetId, repository })
  if (!head) {
    return null
  }
  const observedCurrentVersion = await getObservedCurrentVersion(
    input,
    repository
  )
  if (observedCurrentVersion !== head.currentVersion) {
    throw new CurrentHeadConflictError(
      `Current version mismatch: client has ${observedCurrentVersion}, server has ${head.currentVersion}`
    )
  }
  if (input.parentId !== head.lastPatchId) {
    throw new CurrentHeadConflictError(
      `Parent patch mismatch: client has ${input.parentId}, server has ${head.lastPatchId}`
    )
  }

  await assertRecordIsNotArchivedInCurrentState({
    targetId,
    repository,
    target,
  })

  if (input.parentId !== null) {
    const parentPatch = await repository.findPatchById(input.parentId)
    if (!parentPatch) {
      throw new RecordValidationError(
        `Parent patch ${input.parentId} does not exist`
      )
    }
    if (parentPatch.targetId !== targetId) {
      throw new RecordValidationError(
        `Parent patch ${input.parentId} does not belong to record ${targetId}`
      )
    }
  }

  if (input.tagChanges) {
    await assertTagChangesAgainstCurrentState({
      targetId,
      input,
      repository,
      target,
    })
  }

  const now = new Date().toISOString()
  const actor = resolveActor(createdBy)

  const patchBody: PatchItem<DeepPartial<RecordBody>> = {
    id: crypto.randomUUID() as RecordId,
    pid: target.pid,
    schema: target.schema,
    targetId,
    parentId: input.parentId,
    ...('tagChanges' in input ? { tagChanges: input.tagChanges } : {}),
    ...('assignee' in input ? { assignee: input.assignee } : {}),
    ...('body' in input ? { body: input.body } : {}),
    ...('assets' in input ? { assets: input.assets } : {}),
    ...('relations' in input ? { relations: input.relations } : {}),
    ...(input.description !== undefined
      ? { description: input.description }
      : {}),
  }

  const patch: StoredPatchDoc = {
    ...patchBody,
    createdBy: actor,
    createdAt: now,
  }

  await repository.appendPatch(patch)
  const patchCount = (await repository.listPatches()).length

  return {
    patch: toPatchResponse(patch),
    newCurrentVersion: head.currentVersion + 1,
    newSnapshotVersion: patchCount,
  }
}

async function assertRecordIsNotArchivedInCurrentState(params: {
  targetId: string
  repository: RecordRepository
  target: Awaited<ReturnType<RecordRepository['findById']>>
}): Promise<void> {
  const { targetId, repository, target } = params
  if (!target) return

  const chain = reconstructPatchChain(
    await repository.findPatchesByTargetId(targetId),
    targetId as RecordId
  )
  if (chain.status === 'broken' || chain.status === 'conflicted') {
    throw new RecordValidationError(
      `Cannot apply patch because patch chain is ${chain.status}`
    )
  }
  const current = replayRecordHistory(target, chain.orderedPatches).finalState
  if (current.tags.includes('status:archived')) {
    throw new RecordValidationError(
      `Cannot patch archived record ${targetId}`
    )
  }
}

function assertTagChangesInput(
  tagChanges: TagChanges | undefined,
  configuredTags: Set<string>
): void {
  if (!tagChanges) return

  const add = tagChanges.add ?? []
  const remove = tagChanges.remove ?? []
  const changes = tagChanges.change ?? []
  const addSet = new Set(add)
  const removeSet = new Set(remove)

  for (const tag of [...add, ...remove]) {
    assertConfiguredTag(tag, configuredTags)
  }

  for (const tag of addSet) {
    if (removeSet.has(tag)) {
      throw new RecordValidationError(
        `Tag change conflict: ${tag} appears in both add and remove`
      )
    }
  }

  const seenChangeNamespaces = new Set<string>()
  for (const change of changes) {
    if (!change.namespace) {
      throw new RecordValidationError('Tag change namespace is required')
    }
    if (seenChangeNamespaces.has(change.namespace)) {
      throw new RecordValidationError(
        `Tag change conflict: namespace ${change.namespace} appears more than once`
      )
    }
    seenChangeNamespaces.add(change.namespace)

    if (change.from !== null) {
      assertConfiguredTag(change.from, configuredTags)
      assertTagNamespace(change.from, change.namespace)
    }
    if (change.to !== null) {
      assertConfiguredTag(change.to, configuredTags)
      assertTagNamespace(change.to, change.namespace)
    }
    if (change.namespace === 'status' && change.to === null) {
      throw new RecordValidationError('status tag cannot be removed')
    }
  }
}

function assertConfiguredTag(tag: Tag, configuredTags: Set<string>): void {
  if (!isTag(tag)) {
    throw new RecordValidationError(`Invalid tag: ${tag}`)
  }
  if (!configuredTags.has(tag)) {
    throw new RecordValidationError(`Unsupported tag: ${tag}`)
  }
}

function assertTagNamespace(tag: Tag, namespace: string): void {
  if (tagNamespace(tag) !== namespace) {
    throw new RecordValidationError(
      `Tag change namespace mismatch: ${tag} is not in ${namespace}`
    )
  }
}

async function assertTagChangesAgainstCurrentState(params: {
  targetId: string
  input: CreateRecordPatchInput<DeepPartial<RecordBody>>
  repository: RecordRepository
  target: Awaited<ReturnType<RecordRepository['findById']>>
}): Promise<void> {
  const { targetId, input, repository, target } = params
  if (!target || !input.tagChanges) return

  const chain = reconstructPatchChain(
    await repository.findPatchesByTargetId(targetId),
    targetId as RecordId
  )
  if (chain.status === 'broken' || chain.status === 'conflicted') {
    throw new RecordValidationError(
      `Cannot apply patch because patch chain is ${chain.status}`
    )
  }

  const current = replayRecordHistory(target, chain.orderedPatches).finalState
  for (const change of input.tagChanges.change ?? []) {
    if (change.from !== null && !current.tags.includes(change.from)) {
      throw new RecordValidationError(
        `Tag change conflict: current tags do not contain ${change.from}`
      )
    }
  }

  const result = applyRecordPatch(current, {
    id: 'validation' as RecordId,
    pid: current.pid,
    schema: current.schema,
    targetId: targetId as RecordId,
    parentId: input.parentId,
    tagChanges: input.tagChanges,
  })

  if (!result.tags.some((tag) => tagNamespace(tag) === 'status')) {
    throw new RecordValidationError('status tag is required')
  }
}

function isTag(value: string): value is Tag {
  const separator = value.indexOf(':')
  return separator > 0 && separator < value.length - 1
}

async function getObservedCurrentVersion(
  input: CreateRecordPatchInput<DeepPartial<RecordBody>>,
  repository: RecordRepository
): Promise<number> {
  const rawInput = input as unknown as Record<string, unknown>
  if (typeof rawInput.currentVersion === 'number') {
    return rawInput.currentVersion
  }

  const baseRecords = await repository.list({
    includeArchived: true,
    excludeTags: [],
  })
  return baseRecords.length + (rawInput.snapshotVersion as number)
}

function getRawObservedVersion(
  input: CreateRecordPatchInput<DeepPartial<RecordBody>>
): unknown {
  const rawInput = input as unknown as Record<string, unknown>
  return typeof rawInput.currentVersion === 'number'
    ? rawInput.currentVersion
    : rawInput.snapshotVersion
}
