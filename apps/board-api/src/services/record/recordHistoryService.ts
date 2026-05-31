import type {
  RecordHistoryReplay,
  RecordHistoryReplayStep,
  RecordHistoryResponse,
  RecordId,
} from '@labour-board/shared'
import type { RecordRepository } from '../../repositories/recordRepository.js'
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

  return response
}
