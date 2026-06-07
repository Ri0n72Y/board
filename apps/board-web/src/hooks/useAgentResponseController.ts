import { useCallback, useEffect, useRef, useState } from 'react'
import axios from 'axios'
import type { AgentResponseDetail, AgentResponseSummary } from '@labour-board/shared'
import {
  createAgentResponse,
  fetchAgentResponse,
  fetchAgentResponses,
} from '../api/agentResponses'

export function useAgentResponseController() {
  const [responses, setResponses] = useState<AgentResponseSummary[]>([])
  const [selectedResponse, setSelectedResponse] = useState<AgentResponseDetail | null>(null)
  const [isListLoading, setIsListLoading] = useState(false)
  const [isDetailLoading, setIsDetailLoading] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [listError, setListError] = useState<string | null>(null)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [createError, setCreateError] = useState<string | null>(null)

  const listRequestIdRef = useRef(0)
  const detailRequestIdRef = useRef(0)
  const createRequestIdRef = useRef(0)
  const listAbortRef = useRef<AbortController | null>(null)
  const detailAbortRef = useRef<AbortController | null>(null)
  const createAbortRef = useRef<AbortController | null>(null)

  const abortAll = useCallback(() => {
    listRequestIdRef.current += 1
    detailRequestIdRef.current += 1
    createRequestIdRef.current += 1
    listAbortRef.current?.abort()
    detailAbortRef.current?.abort()
    createAbortRef.current?.abort()
    listAbortRef.current = null
    detailAbortRef.current = null
    createAbortRef.current = null
  }, [])

  useEffect(() => abortAll, [abortAll])

  const clearResponses = useCallback(() => {
    setResponses([])
    setSelectedResponse(null)
    setListError(null)
    setDetailError(null)
    setCreateError(null)
    setIsListLoading(false)
    setIsDetailLoading(false)
    setIsCreating(false)
  }, [])

  const loadResponseList = useCallback((draftId: string) => {
    const requestId = listRequestIdRef.current + 1
    listRequestIdRef.current = requestId
    listAbortRef.current?.abort()

    const controller = new AbortController()
    listAbortRef.current = controller
    setIsListLoading(true)
    setListError(null)

    void fetchAgentResponses(draftId, controller.signal)
      .then((data) => {
        if (listRequestIdRef.current !== requestId || controller.signal.aborted) return
        setResponses(data.responses)
      })
      .catch((err: unknown) => {
        if (listRequestIdRef.current !== requestId || controller.signal.aborted || axios.isCancel(err)) return
        setListError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        if (listRequestIdRef.current !== requestId) return
        setIsListLoading(false)
        listAbortRef.current = null
      })
  }, [])

  const loadResponseDetail = useCallback((responseId: string) => {
    const requestId = detailRequestIdRef.current + 1
    detailRequestIdRef.current = requestId
    detailAbortRef.current?.abort()

    const controller = new AbortController()
    detailAbortRef.current = controller
    setIsDetailLoading(true)
    setDetailError(null)
    setSelectedResponse(null)

    void fetchAgentResponse(responseId, controller.signal)
      .then((data) => {
        if (detailRequestIdRef.current !== requestId || controller.signal.aborted) return
        setSelectedResponse(data.response)
      })
      .catch((err: unknown) => {
        if (detailRequestIdRef.current !== requestId || controller.signal.aborted || axios.isCancel(err)) return
        setDetailError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        if (detailRequestIdRef.current !== requestId) return
        setIsDetailLoading(false)
        detailAbortRef.current = null
      })
  }, [])

  const saveResponse = useCallback(
    (
      draftId: string,
      responseMarkdown: string,
      externalAgentName?: string,
      responseNote?: string,
    ): Promise<AgentResponseDetail> => {
      const requestId = createRequestIdRef.current + 1
      createRequestIdRef.current = requestId
      createAbortRef.current?.abort()

      const controller = new AbortController()
      createAbortRef.current = controller
      setIsCreating(true)
      setCreateError(null)

      return createAgentResponse(
        draftId,
        {
          source: 'manual-paste',
          responseMarkdown,
          ...(externalAgentName?.trim() ? { externalAgentName: externalAgentName.trim() } : {}),
          ...(responseNote?.trim() ? { responseNote: responseNote.trim() } : {}),
        },
        controller.signal,
      )
        .then((data) => {
          if (createRequestIdRef.current !== requestId || controller.signal.aborted) {
            throw new Error('aborted')
          }
          // Insert into response list
          setResponses((prev) => [data.response, ...prev])
          setSelectedResponse(data.response)
          return data.response
        })
        .catch((err: unknown) => {
          if (createRequestIdRef.current !== requestId || controller.signal.aborted || axios.isCancel(err)) {
            throw err
          }
          const message = err instanceof Error ? err.message : String(err)
          setCreateError(message)
          throw err
        })
        .finally(() => {
          if (createRequestIdRef.current !== requestId) return
          setIsCreating(false)
          createAbortRef.current = null
        })
    },
    [],
  )

  return {
    responses,
    selectedResponse,
    isListLoading,
    isDetailLoading,
    isCreating,
    listError,
    detailError,
    createError,
    loadResponseList,
    loadResponseDetail,
    saveResponse,
    clearResponses,
    abortAll,
    setSelectedResponse,
  }
}
