import { useCallback, useEffect, useRef, useState } from 'react'
import axios from 'axios'
import type {
  RecordBody,
  RecordHistoryResponse,
  RecordItem,
  RecordResponse,
} from '@labour-board/shared'
import { fetchRecordHistory } from '../api/history'

export interface HistorySelection {
  recordId: string
  title?: string
  pid?: string
}

export function useRecordHistoryController() {
  const [historySelection, setHistorySelection] =
    useState<HistorySelection | null>(null)
  const [history, setHistory] = useState<RecordHistoryResponse | null>(null)
  const [isHistoryLoading, setIsHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const historyRequestIdRef = useRef(0)
  const historyAbortRef = useRef<AbortController | null>(null)

  const abortHistory = useCallback(() => {
    historyRequestIdRef.current += 1
    historyAbortRef.current?.abort()
    historyAbortRef.current = null
  }, [])

  useEffect(() => abortHistory, [abortHistory])

  const loadHistory = useCallback((selection: HistorySelection) => {
    const requestId = historyRequestIdRef.current + 1
    historyRequestIdRef.current = requestId
    historyAbortRef.current?.abort()

    const controller = new AbortController()
    historyAbortRef.current = controller

    setHistorySelection(selection)
    setHistory(null)
    setHistoryError(null)
    setIsHistoryLoading(true)

    void fetchRecordHistory(selection.recordId, controller.signal)
      .then((data) => {
        if (
          historyRequestIdRef.current !== requestId ||
          controller.signal.aborted
        ) {
          return
        }
        setHistory(data)
        setHistoryError(null)
      })
      .catch((unknownError: unknown) => {
        if (
          historyRequestIdRef.current !== requestId ||
          controller.signal.aborted ||
          axios.isCancel(unknownError)
        ) {
          return
        }
        setHistoryError(errorMessage(unknownError))
        setHistory(null)
      })
      .finally(() => {
        if (historyRequestIdRef.current !== requestId) return
        setIsHistoryLoading(false)
      })
  }, [])

  const openHistory = useCallback(
    (record: RecordResponse<RecordItem<RecordBody>>) => {
      loadHistory({
        recordId: record.body.id,
        title: getRecordTitle(record.body.body),
        pid: record.body.pid,
      })
    },
    [loadHistory],
  )

  const closeHistory = useCallback(() => {
    abortHistory()
    setHistorySelection(null)
    setHistory(null)
    setHistoryError(null)
    setIsHistoryLoading(false)
  }, [abortHistory])

  return {
    historySelection,
    history,
    isHistoryLoading,
    historyError,
    loadHistory,
    openHistory,
    closeHistory,
  }
}

function getRecordTitle(body: RecordBody): string | undefined {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return undefined
  const value = (body as Record<string, unknown>).title
  return typeof value === 'string' && value.trim() ? value : undefined
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
