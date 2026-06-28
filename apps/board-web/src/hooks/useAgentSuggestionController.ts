import { useCallback, useEffect, useRef, useState } from 'react'
import axios from 'axios'
import type {
  AgentSuggestionDetail,
  AgentSuggestionStatus,
  AgentSuggestionSummary,
} from '@labour-board/shared'
import {
  createAgentSuggestion,
  fetchAgentSuggestionDetail,
  fetchAgentSuggestions,
  updateAgentSuggestionReview,
} from '../api/agentSuggestions'
import { extractApiErrorMessage } from '../api/apiError'
import { toastError, toastSuccess } from '../utils/toasts'

export function useAgentSuggestionController() {
  const [suggestions, setSuggestions] = useState<AgentSuggestionSummary[]>([])
  const [selectedSuggestion, setSelectedSuggestion] =
    useState<AgentSuggestionDetail | null>(null)
  const [isListLoading, setIsListLoading] = useState(false)
  const [isDetailLoading, setIsDetailLoading] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isReviewing, setIsReviewing] = useState(false)
  const [listError, setListError] = useState<string | null>(null)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [reviewError, setReviewError] = useState<string | null>(null)

  const listRequestIdRef = useRef(0)
  const detailRequestIdRef = useRef(0)
  const generateRequestIdRef = useRef(0)
  const reviewRequestIdRef = useRef(0)
  const listAbortRef = useRef<AbortController | null>(null)
  const detailAbortRef = useRef<AbortController | null>(null)
  const generateAbortRef = useRef<AbortController | null>(null)
  const reviewAbortRef = useRef<AbortController | null>(null)

  const abortAll = useCallback(() => {
    listRequestIdRef.current += 1
    detailRequestIdRef.current += 1
    generateRequestIdRef.current += 1
    reviewRequestIdRef.current += 1
    listAbortRef.current?.abort()
    detailAbortRef.current?.abort()
    generateAbortRef.current?.abort()
    reviewAbortRef.current?.abort()
    listAbortRef.current = null
    detailAbortRef.current = null
    generateAbortRef.current = null
    reviewAbortRef.current = null
  }, [])

  useEffect(() => abortAll, [abortAll])

  const clearSuggestions = useCallback(() => {
    setSuggestions([])
    setSelectedSuggestion(null)
    setListError(null)
    setDetailError(null)
    setGenerateError(null)
    setReviewError(null)
    setIsListLoading(false)
    setIsDetailLoading(false)
    setIsGenerating(false)
    setIsReviewing(false)
  }, [])

  const loadSuggestionList = useCallback((draftId: string) => {
    const requestId = listRequestIdRef.current + 1
    listRequestIdRef.current = requestId
    listAbortRef.current?.abort()

    const controller = new AbortController()
    listAbortRef.current = controller
    setIsListLoading(true)
    setListError(null)

    void fetchAgentSuggestions(draftId, controller.signal)
      .then((data) => {
        if (
          listRequestIdRef.current !== requestId ||
          controller.signal.aborted
        )
          return
        setSuggestions(data.suggestions)
      })
      .catch((err: unknown) => {
        if (
          listRequestIdRef.current !== requestId ||
          controller.signal.aborted ||
          axios.isCancel(err)
        )
          return
        setListError(extractApiErrorMessage(err))
      })
      .finally(() => {
        if (listRequestIdRef.current !== requestId) return
        setIsListLoading(false)
        listAbortRef.current = null
      })
  }, [])

  const loadSuggestionDetail = useCallback((suggestionId: string) => {
    const requestId = detailRequestIdRef.current + 1
    detailRequestIdRef.current = requestId
    detailAbortRef.current?.abort()

    const controller = new AbortController()
    detailAbortRef.current = controller
    setIsDetailLoading(true)
    setDetailError(null)
    setSelectedSuggestion(null)

    void fetchAgentSuggestionDetail(suggestionId, controller.signal)
      .then((data) => {
        if (
          detailRequestIdRef.current !== requestId ||
          controller.signal.aborted
        )
          return
        setSelectedSuggestion(data.suggestion)
      })
      .catch((err: unknown) => {
        if (
          detailRequestIdRef.current !== requestId ||
          controller.signal.aborted ||
          axios.isCancel(err)
        )
          return
        setDetailError(extractApiErrorMessage(err))
      })
      .finally(() => {
        if (detailRequestIdRef.current !== requestId) return
        setIsDetailLoading(false)
        detailAbortRef.current = null
      })
  }, [])

  const generateSuggestion = useCallback(
    (draftId: string, instruction?: string): Promise<AgentSuggestionDetail> => {
      const requestId = generateRequestIdRef.current + 1
      generateRequestIdRef.current = requestId
      generateAbortRef.current?.abort()

      const controller = new AbortController()
      generateAbortRef.current = controller
      setIsGenerating(true)
      setGenerateError(null)

      return createAgentSuggestion(
        draftId,
        { instruction: instruction?.trim() || undefined },
        controller.signal,
      )
        .then((data) => {
          if (
            generateRequestIdRef.current !== requestId ||
            controller.signal.aborted
          ) {
            throw new Error('aborted')
          }
          setSuggestions((prev) => [data.suggestion, ...prev])
          setSelectedSuggestion(data.suggestion)
          toastSuccess('AI suggestion generated')
          return data.suggestion
        })
        .catch((err: unknown) => {
          if (
            generateRequestIdRef.current !== requestId ||
            controller.signal.aborted ||
            axios.isCancel(err)
          ) {
            throw err
          }
          const message = extractApiErrorMessage(err)
          setGenerateError(message)
          toastError(`AI suggestion failed: ${message}`)
          throw err
        })
        .finally(() => {
          if (generateRequestIdRef.current !== requestId) return
          setIsGenerating(false)
          generateAbortRef.current = null
        })
    },
    [],
  )

  const reviewSuggestion = useCallback(
    (suggestionId: string, status: AgentSuggestionStatus) => {
      const requestId = reviewRequestIdRef.current + 1
      reviewRequestIdRef.current = requestId
      reviewAbortRef.current?.abort()

      const controller = new AbortController()
      reviewAbortRef.current = controller
      setIsReviewing(true)
      setReviewError(null)

      void updateAgentSuggestionReview(
        suggestionId,
        { status },
        controller.signal,
      )
        .then((data) => {
          if (
            reviewRequestIdRef.current !== requestId ||
            controller.signal.aborted
          )
            return
          setSelectedSuggestion(data.suggestion)
          setSuggestions((prev) =>
            prev.map((s) =>
              s.id === data.suggestion.id ? data.suggestion : s,
            ),
          )
          toastSuccess('Suggestion review updated')
        })
        .catch((err: unknown) => {
          if (
            reviewRequestIdRef.current !== requestId ||
            controller.signal.aborted ||
            axios.isCancel(err)
          )
            return
          const message = extractApiErrorMessage(err)
          setReviewError(message)
          toastError(`Review update failed: ${message}`)
        })
        .finally(() => {
          if (reviewRequestIdRef.current !== requestId) return
          setIsReviewing(false)
          reviewAbortRef.current = null
        })
    },
    [],
  )

  return {
    suggestions,
    selectedSuggestion,
    isListLoading,
    isDetailLoading,
    isGenerating,
    isReviewing,
    listError,
    detailError,
    generateError,
    reviewError,
    loadSuggestionList,
    loadSuggestionDetail,
    generateSuggestion,
    reviewSuggestion,
    clearSuggestions,
    abortAll,
    setSelectedSuggestion,
  }
}
