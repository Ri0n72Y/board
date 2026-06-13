import type {
  RecordHistoryReplay,
  RecordHistoryReplayStep,
  RecordHistoryResponse,
  RecordId,
  RecordItem,
  RecordBody,
} from '@labour-board/shared'
import type {
  RecordRepository,
} from '../../repositories/recordRepository.js'
import type { StoredPatchDoc } from '../../repositories/snapshotHeadRepository.js'
import { reconstructPatchChain, replayRecordHistory } from './recordHistory.js'
import { toRecordResponse, toPatchResponse } from './recordResponses.js'

export interface GetRecordHistoryParams {
  recordId: string
  repository: RecordRepository
}

/**
 * Assembles a {@link RecordHistoryResponse} for the given record.
 *
 * Returns `null` when the record does not exist.
 *
 * The response includes a replay projection only for `empty` or `complete`
 * chains — broken / conflicted chains do not produce reliable replay results
 * and therefore omit it.
 *
 * This function does **not** write to any repository, does **not** read the
 * snapshot head, and does **not** advance any state.
 */
export async function getRecordHistory(
  params: GetRecordHistoryParams
): Promise<RecordHistoryResponse | null> {
  const { recordId, repository } = params

  const record = await repository.findById(recordId)
  if (!record) {
    return null
  }

  const patches = await repository.findPatchesByTargetId(recordId)
  const { orderedPatches, status, diagnostics } = reconstructPatchChain(
    patches,
    recordId as RecordId
  )

  const response: RecordHistoryResponse = {
    record: toRecordResponse(record),
    status,
    patches: orderedPatches.map(toPatchResponse),
  }
  if (diagnostics.length > 0) {
    response.diagnostics = diagnostics
  }

  if (status === 'empty' || status === 'complete') {
    const { createdBy: _cb, createdAt: _ca, ...baseItem } = record
    const { finalState, states } = replayRecordHistory(
      baseItem,
      orderedPatches
    )
    const patchEnvelopes = orderedPatches.map(toPatchResponse)
    const steps: RecordHistoryReplayStep[] = states.map((state, i) => ({
      patch: patchEnvelopes[i],
      state,
    }))
    response.replay = { finalState, steps } as RecordHistoryReplay
  }

  const references = await buildHistoryReferences({
    repository,
    base: record,
    patches: orderedPatches,
    replay: response.replay,
  })
  if (Object.keys(references).length > 0) {
    response.references = references
  }

  return response
}

async function buildHistoryReferences({
  repository,
  base,
  patches,
  replay,
}: {
  repository: RecordRepository
  base: RecordItem<RecordBody>
  patches: StoredPatchDoc[]
  replay?: RecordHistoryReplay
}): Promise<NonNullable<RecordHistoryResponse['references']>> {
  const targetIds = new Set<string>()
  collectRelationTargets(base, targetIds)
  for (const patch of patches) {
    for (const relation of patch.relations ?? []) {
      targetIds.add(relation.target)
    }
  }
  if (replay) {
    collectRelationTargets(replay.finalState, targetIds)
    for (const step of replay.steps) {
      collectRelationTargets(step.state, targetIds)
    }
  }
  targetIds.delete(base.id)
  if (targetIds.size === 0) return {}

  const records = await repository.findByIds([...targetIds])
  return Object.fromEntries(
    records.map((record) => [
      record.id,
      {
        pid: record.pid,
        title: titleFromBody(record.body) ?? record.pid,
        schema: record.schema,
      },
    ])
  )
}

function collectRelationTargets(
  record: Pick<RecordItem<RecordBody>, 'relations'>,
  targetIds: Set<string>
): void {
  for (const relation of record.relations ?? []) {
    targetIds.add(relation.target)
  }
}

function titleFromBody(body: RecordBody): string | undefined {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return undefined
  const value = (body as Record<string, unknown>).title
  return typeof value === 'string' && value.trim() ? value : undefined
}
