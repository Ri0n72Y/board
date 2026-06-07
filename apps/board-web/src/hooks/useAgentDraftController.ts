import { useCallback, useEffect, useRef, useState } from 'react'
import axios from 'axios'
import type { AgentDraftDetail, AgentDraftStatus, AgentDraftSummary, BoardCurrentQuery } from '@labour-board/shared'
import type { ExportContextPackOptions } from './useBoardExportController'
import { createAgentDraft, fetchAgentDraft, fetchAgentDrafts, fetchAgentDraftHandoff, updateAgentDraftReview } from '../api/agentDrafts'
import { downloadTextFile } from '../utils/download'

function isIgnoredHandoffAbort(err: unknown): boolean {
  if (axios.isCancel(err)) return true
  if (err instanceof Error && err.message === 'aborted') return true
  return false
}

export function useAgentDraftController() {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [drafts, setDrafts] = useState<AgentDraftSummary[]>([])
  const [selectedDraft, setSelectedDraft] = useState<AgentDraftDetail | null>(null)
  const [isListLoading, setIsListLoading] = useState(false)
  const [isDetailLoading, setIsDetailLoading] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [listError, setListError] = useState<string | null>(null)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [createError, setCreateError] = useState<string | null>(null)

  // Review state
  const [isReviewing, setIsReviewing] = useState(false)
  const [reviewError, setReviewError] = useState<string | null>(null)

  // Handoff state
  const [isHandoffLoading, setIsHandoffLoading] = useState(false)
  const [handoffError, setHandoffError] = useState<string | null>(null)
  const [handoffFeedback, setHandoffFeedback] = useState<string | null>(null)

  const listRequestIdRef = useRef(0)
  const detailRequestIdRef = useRef(0)
  const createRequestIdRef = useRef(0)
  const reviewRequestIdRef = useRef(0)
  const handoffRequestIdRef = useRef(0)
  const listAbortRef = useRef<AbortController | null>(null)
  const detailAbortRef = useRef<AbortController | null>(null)
  const createAbortRef = useRef<AbortController | null>(null)
  const reviewAbortRef = useRef<AbortController | null>(null)
  const handoffAbortRef = useRef<AbortController | null>(null)

  const abortAll = useCallback(() => {
    listRequestIdRef.current += 1
    detailRequestIdRef.current += 1
    createRequestIdRef.current += 1
    reviewRequestIdRef.current += 1
    handoffRequestIdRef.current += 1
    listAbortRef.current?.abort()
    detailAbortRef.current?.abort()
    createAbortRef.current?.abort()
    reviewAbortRef.current?.abort()
    handoffAbortRef.current?.abort()
    listAbortRef.current = null
    detailAbortRef.current = null
    createAbortRef.current = null
    reviewAbortRef.current = null
    handoffAbortRef.current = null
  }, [])

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
        if (listRequestIdRef.current !== requestId || controller.signal.aborted) return
        setDrafts(data.drafts)
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
    setHandoffError(null)
    setHandoffFeedback(null)
    setIsListLoading(false)
    setIsDetailLoading(false)
    setIsCreating(false)
    setIsReviewing(false)
    setIsHandoffLoading(false)
  }, [abortAll])

  const loadDraftDetail = useCallback((draftId: string) => {
    const requestId = detailRequestIdRef.current + 1
    detailRequestIdRef.current = requestId
    detailAbortRef.current?.abort()

    // Abort in-flight handoff request and clear handoff state for new draft
    handoffRequestIdRef.current += 1
    handoffAbortRef.current?.abort()
    handoffAbortRef.current = null
    setHandoffError(null)
    setHandoffFeedback(null)
    setIsHandoffLoading(false)

    const controller = new AbortController()
    detailAbortRef.current = controller
    setIsDetailLoading(true)
    setDetailError(null)
    setSelectedDraft(null)

    void fetchAgentDraft(draftId, controller.signal)
      .then((data) => {
        if (detailRequestIdRef.current !== requestId || controller.signal.aborted) return
        setSelectedDraft(data.draft)
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

  const saveDraft = useCallback(
    (options: ExportContextPackOptions & {
      title: string
      source: 'current-board' | 'snapshot'
      snapshotId?: string
      filters?: BoardCurrentQuery
    }): Promise<AgentDraftDetail> => {
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
        controller.signal,
      )
        .then((data) => {
          if (createRequestIdRef.current !== requestId || controller.signal.aborted) {
            throw new Error('aborted')
          }
          setIsDrawerOpen(true)
          setDrafts((prev) => {
            const deduped = prev.filter((d) => d.id !== data.draft.id)
            return [data.draft, ...deduped]
          })
          setSelectedDraft(data.draft)
          return data.draft
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
        controller.signal,
      )
        .then((data) => {
          if (reviewRequestIdRef.current !== requestId || controller.signal.aborted) return
          setSelectedDraft(data.draft)
          setDrafts((prev) =>
            prev.map((d) => (d.id === data.draft.id ? data.draft : d)),
          )
        })
        .catch((err: unknown) => {
          if (reviewRequestIdRef.current !== requestId || controller.signal.aborted || axios.isCancel(err)) return
          setReviewError(err instanceof Error ? err.message : String(err))
        })
        .finally(() => {
          if (reviewRequestIdRef.current !== requestId) return
          setIsReviewing(false)
          reviewAbortRef.current = null
        })
    },
    [],
  )

  const fetchHandoff = useCallback(
    (draftId: string): Promise<{ content: string; filename: string }> => {
      const requestId = handoffRequestIdRef.current + 1
      handoffRequestIdRef.current = requestId
      handoffAbortRef.current?.abort()

      const controller = new AbortController()
      handoffAbortRef.current = controller
      setIsHandoffLoading(true)
      setHandoffError(null)
      setHandoffFeedback(null)

      return fetchAgentDraftHandoff(draftId, controller.signal)
        .then((data) => {
          if (handoffRequestIdRef.current !== requestId || controller.signal.aborted) {
            throw new Error('aborted')
          }
          return { content: data.handoff.content, filename: data.handoff.filename }
        })
        .catch((err: unknown) => {
          if (handoffRequestIdRef.current !== requestId || controller.signal.aborted || axios.isCancel(err)) {
            throw err
          }
          const message = err instanceof Error ? err.message : String(err)
          setHandoffError(message)
          throw err
        })
        .finally(() => {
          if (handoffRequestIdRef.current !== requestId) return
          setIsHandoffLoading(false)
          handoffAbortRef.current = null
        })
    },
    [],
  )

  const copyHandoff = useCallback(
    (draftId: string) => {
      fetchHandoff(draftId)
        .then(({ content }) => navigator.clipboard.writeText(content))
        .then(() => {
          setHandoffError(null)
          setHandoffFeedback('Handoff copied!')
          setTimeout(() => setHandoffFeedback(null), 2000)
        })
        .catch((err: unknown) => {
          if (isIgnoredHandoffAbort(err)) return
          setHandoffFeedback(null)
          setHandoffError(err instanceof Error ? err.message : 'Copy handoff failed')
        })
    },
    [fetchHandoff],
  )

  const downloadHandoff = useCallback(
    (draftId: string) => {
      fetchHandoff(draftId)
        .then(({ content, filename }) => {
          downloadTextFile(filename, content)
          setHandoffError(null)
        })
        .catch((err: unknown) => {
          if (isIgnoredHandoffAbort(err)) return
          setHandoffError(err instanceof Error ? err.message : 'Download handoff failed')
        })
    },
    [fetchHandoff],
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
    isHandoffLoading,
    handoffError,
    handoffFeedback,
    openDrawer,
    closeDrawer,
    loadDraftList,
    loadDraftDetail,
    saveDraft,
    updateDraftReview,
    copyHandoff,
    downloadHandoff,
  }
}
