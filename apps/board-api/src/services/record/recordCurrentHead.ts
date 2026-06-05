import type { RecordCurrentHeadResponse, RecordId } from '@labour-board/shared'
import type { RecordRepository } from '../../repositories/recordRepository.js'
import { reconstructPatchChain } from './recordHistory.js'
import { CurrentHeadConflictError } from './recordResponses.js'

export interface GetRecordCurrentHeadParams {
  recordId: string
  repository: RecordRepository
}

export async function getRecordCurrentHead(
  params: GetRecordCurrentHeadParams
): Promise<RecordCurrentHeadResponse | null> {
  const { recordId, repository } = params
  const record = await repository.findById(recordId)
  if (!record) return null

  const [baseRecords, patches] = await Promise.all([
    repository.list({ includeArchived: true, excludeTags: [] }),
    repository.listPatches(),
  ])
  const targetPatches = patches.filter((patch) => patch.targetId === recordId)
  const chain = reconstructPatchChain(targetPatches, recordId as RecordId)

  if (chain.status !== 'empty' && chain.status !== 'complete') {
    throw new CurrentHeadConflictError(
      `Current head for record ${recordId} cannot be resolved: patch chain is ${chain.status}`
    )
  }

  const lastPatchId =
    chain.orderedPatches.length > 0
      ? chain.orderedPatches[chain.orderedPatches.length - 1].id
      : null

  return {
    recordId,
    exists: true,
    currentVersion: baseRecords.length + patches.length,
    lastPatchId,
  }
}
