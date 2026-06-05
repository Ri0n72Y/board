import { useCallback, useEffect, useRef, useState } from 'react'
import axios from 'axios'
import type {
  RecordBody,
  RecordItem,
  RecordResponse,
  Tag,
} from '@labour-board/shared'
import { RecordPatchConflictError, submitRecordPatch } from '../api/patches'
import { fetchRecordHead } from '../api/recordHead'
import {
  buildMovedStatusTags,
  isStatusMoveNoop,
} from '../utils/statusMove'

interface UseStatusMoveControllerParams {
  onMoved: (recordId: string) => Promise<void> | void
}

export function useStatusMoveController({
  onMoved,
}: UseStatusMoveControllerParams) {
  const [movingRecordId, setMovingRecordId] = useState<string | null>(null)
  const [moveErrors, setMoveErrors] = useState<Record<string, string>>({})
  const statusMoveRequestIdRef = useRef(0)
  const statusMoveAbortRef = useRef<AbortController | null>(null)

  const abortStatusMove = useCallback(() => {
    statusMoveRequestIdRef.current += 1
    statusMoveAbortRef.current?.abort()
    statusMoveAbortRef.current = null
  }, [])

  useEffect(() => abortStatusMove, [abortStatusMove])

  const moveRecordStatus = useCallback(
    (
      record: RecordResponse<RecordItem<RecordBody>>,
      targetStatusTag: Tag,
    ) => {
      const recordId = record.body.id
      if (isStatusMoveNoop(record.body.tags, targetStatusTag)) return

      const requestId = statusMoveRequestIdRef.current + 1
      statusMoveRequestIdRef.current = requestId
      statusMoveAbortRef.current?.abort()

      const controller = new AbortController()
      statusMoveAbortRef.current = controller

      setMovingRecordId(recordId)
      setMoveErrors((current) => {
        const next = { ...current }
        delete next[recordId]
        return next
      })

      void (async () => {
        const head = await fetchRecordHead(recordId, controller.signal)
        if (
          statusMoveRequestIdRef.current !== requestId ||
          controller.signal.aborted
        ) {
          return
        }

        const nextTags = buildMovedStatusTags(record.body.tags, targetStatusTag)
        await submitRecordPatch(
          recordId,
          {
            parentId: head.lastPatchId,
            currentVersion: head.currentVersion,
            tags: nextTags,
            description: `Move status to ${targetStatusTag}`,
          },
          controller.signal,
        )
        if (
          statusMoveRequestIdRef.current !== requestId ||
          controller.signal.aborted
        ) {
          return
        }
        await onMoved(recordId)
      })()
        .catch((unknownError: unknown) => {
          if (
            statusMoveRequestIdRef.current !== requestId ||
            controller.signal.aborted ||
            axios.isCancel(unknownError)
          ) {
            return
          }

          const message =
            unknownError instanceof RecordPatchConflictError
              ? `${unknownError.message} Refresh current board and try again.`
              : errorMessage(unknownError)
          setMoveErrors((current) => ({ ...current, [recordId]: message }))
        })
        .finally(() => {
          if (statusMoveRequestIdRef.current !== requestId) return
          setMovingRecordId(null)
          statusMoveAbortRef.current = null
        })
    },
    [onMoved],
  )

  return {
    movingRecordId,
    moveErrors,
    moveRecordStatus,
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
