import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import axios from 'axios'
import type {
  AgentDraftDetail,
  AgentDraftStatus,
  AgentDraftSummary,
  BoardCurrentQuery,
} from '@labour-board/shared'
import type { ExportContextPackOptions } from './useBoardExportController'
import {
  createAgentDraft,
  fetchAgentDraft,
  fetchAgentDraftHandoff,
  fetchAgentDrafts,
  updateAgentDraftReview,
} from '../api/agentDrafts'
import { useAgentSuggestionController } from './useAgentSuggestionController'
import { useAgentResponseController } from './useAgentResponseController'
import { downloadTextFile } from '../utils/download'
import { toastError } from '../utils/toasts'

export function useAgentDraftController() {
  const { t } = useTranslation()
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [drafts, setDrafts] = useState<AgentDraftSummary[]>([])
  const [selectedDraft, setSelectedDraft] = useState<AgentDraftDetail | null>(
    null
  )
  const [isListLoading, setIsListLoading] = useState(false)
  const [isDetailLoading, setIsDetailLoading] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [listError, setListError] = useState<string | null>(null)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [createError, setCreateError] = useState<string | null>(null)

  // Review state
  const [isReviewing, setIsReviewing] = useState(false)
  const [reviewError, setReviewError] = useState<string | null>(null)

  const listRequestIdRef = useRef(0)
  const detailRequestIdRef = useRef(0)
  const createRequestIdRef = useRef(0)
  const reviewRequestIdRef = useRef(0)
  const listAbortRef = useRef<AbortController | null>(null)
  const detailAbortRef = useRef<AbortController | null>(null)
  const createAbortRef = useRef<AbortController | null>(null)
  const reviewAbortRef = useRef<AbortController | null>(null)

  // Agent Suggestion controller
  const {
    suggestions,
    selectedSuggestion,
    isListLoading: isSuggestionListLoading,
    isDetailLoading: isSuggestionDetailLoading,
    isGenerating: isSuggestionGenerating,
    isReviewing: isSuggestionReviewing,
    listError: suggestionListError,
    detailError: suggestionDetailError,
    generateError: suggestionGenerateError,
    reviewError: suggestionReviewError,
    abortAll: abortAllSuggestions,
    clearSuggestions,
    loadSuggestionList,
    loadSuggestionDetail,
    generateSuggestion,
    reviewSuggestion,
    setSelectedSuggestion,
  } = useAgentSuggestionController()
  const {
    responses,
    selectedResponse,
    isListLoading: isResponseListLoading,
    isDetailLoading: isResponseDetailLoading,
    isCreating: isResponseCreating,
    listError: responseListError,
    detailError: responseDetailError,
    createError: responseCreateError,
    loadResponseList,
    loadResponseDetail,
    saveResponse,
    clearResponses,
  } = useAgentResponseController()

  const abortAll = useCallback(() => {
    listRequestIdRef.current += 1
    detailRequestIdRef.current += 1
    createRequestIdRef.current += 1
    reviewRequestIdRef.current += 1
    listAbortRef.current?.abort()
    detailAbortRef.current?.abort()
    createAbortRef.current?.abort()
    reviewAbortRef.current?.abort()
    listAbortRef.current = null
    detailAbortRef.current = null
    createAbortRef.current = null
    reviewAbortRef.current = null
    abortAllSuggestions()
  }, [abortAllSuggestions])

  useEffect(() => abortAll, [abortAll])

  const loadDraftList = useCallback(() => {
    const requestId = listRequestIdRef.current + 1
    listRequestIdRef.current = requestId
    listAbortRef.current?.abort()

    const controller = new AbortController()
    listAbortRef.current = controller
    setIsListLoading(true)
    setListError(null)

    void fetchAgentDrafts(controller.signal)
      .then((data) => {
        if (listRequestIdRef.current !== requestId || controller.signal.aborted)
          return
        setDrafts(data.drafts)
      })
      .catch((err: unknown) => {
        if (
          listRequestIdRef.current !== requestId ||
          controller.signal.aborted ||
          axios.isCancel(err)
        )
          return
        setListError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        if (listRequestIdRef.current !== requestId) return
        setIsListLoading(false)
        listAbortRef.current = null
      })
  }, [])

  const openDrawer = useCallback(() => {
    setIsDrawerOpen(true)
    loadDraftList()
  }, [loadDraftList])

  const closeDrawer = useCallback(() => {
    abortAll()
    setIsDrawerOpen(false)
    setSelectedDraft(null)
    setListError(null)
    setDetailError(null)
    setCreateError(null)
    setReviewError(null)
    setIsListLoading(false)
    setIsDetailLoading(false)
    setIsCreating(false)
    setIsReviewing(false)
    clearSuggestions()
  }, [abortAll, clearSuggestions])

  const loadDraftDetail = useCallback(
    (draftId: string) => {
      const requestId = detailRequestIdRef.current + 1
      detailRequestIdRef.current = requestId
      detailAbortRef.current?.abort()

      // Clear suggestion state for new draft
      clearSuggestions()
      clearResponses()

      const controller = new AbortController()
      detailAbortRef.current = controller
      setIsDetailLoading(true)
      setDetailError(null)
      setSelectedDraft(null)

      void fetchAgentDraft(draftId, controller.signal)
        .then((data) => {
          if (
            detailRequestIdRef.current !== requestId ||
            controller.signal.aborted
          )
            return
          setSelectedDraft(data.draft)
          loadSuggestionList(draftId)
          loadResponseList(draftId)
        })
        .catch((err: unknown) => {
          if (
            detailRequestIdRef.current !== requestId ||
            controller.signal.aborted ||
            axios.isCancel(err)
          )
            return
          setDetailError(err instanceof Error ? err.message : String(err))
        })
        .finally(() => {
          if (detailRequestIdRef.current !== requestId) return
          setIsDetailLoading(false)
          detailAbortRef.current = null
        })
    },
    [clearSuggestions, clearResponses, loadSuggestionList, loadResponseList]
  )

  const saveDraft = useCallback(
    (
      options: ExportContextPackOptions & {
        title: string
        source: 'current-board' | 'snapshot'
        snapshotId?: string
        filters?: BoardCurrentQuery
      }
    ): Promise<AgentDraftDetail> => {
      const requestId = createRequestIdRef.current + 1
      createRequestIdRef.current = requestId
      createAbortRef.current?.abort()

      const controller = new AbortController()
      createAbortRef.current = controller
      setIsCreating(true)
      setCreateError(null)

      return createAgentDraft(
        {
          title: options.title,
          profile: options.profile,
          source: options.source,
          contextGoal: options.contextGoal,
          recordId: options.recordId,
          sprintTag: options.sprintTag,
          snapshotId: options.snapshotId,
          filters: options.filters,
          includeContent: options.includeContent,
          includeAssets: options.includeAssets,
          includeRelations: options.includeRelations,
          includeDiagnostics: options.includeDiagnostics,
        },
        controller.signal
      )
        .then((data) => {
          if (
            createRequestIdRef.current !== requestId ||
            controller.signal.aborted
          ) {
            throw new Error('aborted')
          }
          clearSuggestions()
          setIsDrawerOpen(true)
          setDrafts((prev) => {
            const deduped = prev.filter((d) => d.id !== data.draft.id)
            return [data.draft, ...deduped]
          })
          setSelectedDraft(data.draft)
          return data.draft
        })
        .catch((err: unknown) => {
          if (
            createRequestIdRef.current !== requestId ||
            controller.signal.aborted ||
            axios.isCancel(err)
          ) {
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
    [clearSuggestions]
  )

  const [isHandoffLoading, setIsHandoffLoading] = useState(false)
  const [handoffError, setHandoffError] = useState<string | null>(null)
  const [handoffFeedback, setHandoffFeedback] = useState<string | null>(null)

  const copyHandoff = useCallback(
    async (draftId: string) => {
      setIsHandoffLoading(true)
      setHandoffError(null)
      try {
        const data = await fetchAgentDraftHandoff(draftId)
        await navigator.clipboard.writeText(data.handoff.content)
        setHandoffFeedback(t('agent.handoff.copied'))
        setTimeout(() => setHandoffFeedback(null), 2000)
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'copy handoff failed'
        setHandoffError(message)
        toastError(message)
      } finally {
        setIsHandoffLoading(false)
      }
    },
    [t]
  )

  const downloadHandoff = useCallback(async (draftId: string) => {
    setIsHandoffLoading(true)
    setHandoffError(null)
    try {
      const data = await fetchAgentDraftHandoff(draftId)
      downloadTextFile(data.handoff.filename, data.handoff.content)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'download handoff failed'
      setHandoffError(message)
      toastError(message)
    } finally {
      setIsHandoffLoading(false)
    }
  }, [])

  const updateDraftReview = useCallback(
    (draftId: string, status: AgentDraftStatus, reviewNote?: string) => {
      const requestId = reviewRequestIdRef.current + 1
      reviewRequestIdRef.current = requestId
      reviewAbortRef.current?.abort()

      const controller = new AbortController()
      reviewAbortRef.current = controller
      setIsReviewing(true)
      setReviewError(null)

      void updateAgentDraftReview(
        draftId,
        { status, ...(reviewNote !== undefined ? { reviewNote } : {}) },
        controller.signal
      )
        .then((data) => {
          if (
            reviewRequestIdRef.current !== requestId ||
            controller.signal.aborted
          )
            return
          setSelectedDraft(data.draft)
          setDrafts((prev) =>
            prev.map((d) => (d.id === data.draft.id ? data.draft : d))
          )
        })
        .catch((err: unknown) => {
          if (
            reviewRequestIdRef.current !== requestId ||
            controller.signal.aborted ||
            axios.isCancel(err)
          )
            return
          setReviewError(err instanceof Error ? err.message : String(err))
        })
        .finally(() => {
          if (reviewRequestIdRef.current !== requestId) return
          setIsReviewing(false)
          reviewAbortRef.current = null
        })
    },
    []
  )

  return {
    isDrawerOpen,
    drafts,
    selectedDraft,
    isListLoading,
    isDetailLoading,
    isCreating,
    listError,
    detailError,
    createError,
    isReviewing,
    reviewError,
    openDrawer,
    closeDrawer,
    loadDraftList,
    loadDraftDetail,
    saveDraft,
    updateDraftReview,
    // Agent Suggestion — returned directly from destructured stable values
    suggestions,
    selectedSuggestion,
    isSuggestionListLoading,
    isSuggestionDetailLoading,
    isSuggestionGenerating,
    isSuggestionReviewing,
    suggestionListError,
    suggestionDetailError,
    suggestionGenerateError,
    suggestionReviewError,
    loadSuggestionDetail,
    generateSuggestion,
    reviewSuggestion,
    setSelectedSuggestion,
    isHandoffLoading,
    handoffError,
    handoffFeedback,
    copyHandoff,
    downloadHandoff,
    responses,
    selectedResponse,
    isResponseListLoading,
    isResponseDetailLoading,
    isResponseCreating,
    responseListError,
    responseDetailError,
    responseCreateError,
    loadResponseDetail,
    saveResponse,
    clearResponses,
  }
}
