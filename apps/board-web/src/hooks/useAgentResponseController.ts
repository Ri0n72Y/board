import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  AgentResponseDetail,
  AgentResponseSummary,
} from '@labour-board/shared'
import {
  createAgentResponse,
  fetchAgentResponse,
  fetchAgentResponses,
} from '../api/agentResponses'
import { extractApiErrorMessage } from '../api/apiError'
import { toastError, toastSuccess } from '../utils/toasts'

export function useAgentResponseController() {
  const [responses, setResponses] = useState<AgentResponseSummary[]>([])
  const [selectedResponse, setSelectedResponse] =
    useState<AgentResponseDetail | null>(null)
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
        if (listRequestIdRef.current !== requestId) return
        setResponses(data.responses)
      })
      .catch((error: unknown) => {
        if (listRequestIdRef.current !== requestId) return
        setListError(extractApiErrorMessage(error))
      })
      .finally(() => {
        if (listRequestIdRef.current === requestId) {
          setIsListLoading(false)
        }
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

    void fetchAgentResponse(responseId, controller.signal)
      .then((data) => {
        if (detailRequestIdRef.current !== requestId) return
        setSelectedResponse(data.response)
      })
      .catch((error: unknown) => {
        if (detailRequestIdRef.current !== requestId) return
        setDetailError(extractApiErrorMessage(error))
      })
      .finally(() => {
        if (detailRequestIdRef.current === requestId) {
          setIsDetailLoading(false)
        }
      })
  }, [])

  const saveResponse = useCallback(
    async (
      draftId: string,
      responseMarkdown: string,
      externalAgentName?: string,
      responseNote?: string
    ): Promise<AgentResponseDetail> => {
      const requestId = createRequestIdRef.current + 1
      createRequestIdRef.current = requestId
      setIsCreating(true)
      setCreateError(null)

      try {
        const data = await createAgentResponse(draftId, {
          draftId,
          source: 'manual-paste',
          responseMarkdown,
          externalAgentName,
          responseNote,
        })
        if (createRequestIdRef.current !== requestId) {
          return data.response
        }
        toastSuccess('agent.response.saved')
        await loadResponseList(draftId)
        return data.response
      } catch (error: unknown) {
        if (createRequestIdRef.current !== requestId) {
          throw error
        }
        const message = extractApiErrorMessage(error)
        setCreateError(message)
        toastError(message)
        throw error
      } finally {
        if (createRequestIdRef.current === requestId) {
          setIsCreating(false)
        }
      }
    },
    [loadResponseList]
  )

  return {
    responses,
    selectedResponse,
    isListLoading: isListLoading,
    isDetailLoading: isDetailLoading,
    isCreating: isCreating,
    listError,
    detailError,
    createError,
    loadResponseList,
    loadResponseDetail,
    saveResponse,
    clearResponses,
  }
}
