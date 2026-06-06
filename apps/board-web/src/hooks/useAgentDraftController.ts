import { useCallback, useEffect, useRef, useState } from 'react'
import axios from 'axios'
import type { AgentDraftDetail, AgentDraftSummary } from '@labour-board/shared'
import type { ExportContextPackOptions } from './useBoardExportController'
import { createAgentDraft, fetchAgentDraft, fetchAgentDrafts } from '../api/agentDrafts'

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
    setIsDrawerOpen(false)
    setSelectedDraft(null)
    setCreateError(null)
  }, [])

  const loadDraftDetail = useCallback((draftId: string) => {
    const requestId = detailRequestIdRef.current + 1
    detailRequestIdRef.current = requestId
    detailAbortRef.current?.abort()

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
    (options: ExportContextPackOptions & { title: string; source: 'current-board' | 'snapshot'; snapshotId?: string }) => {
      const requestId = createRequestIdRef.current + 1
      createRequestIdRef.current = requestId
      createAbortRef.current?.abort()

      const controller = new AbortController()
      createAbortRef.current = controller
      setIsCreating(true)
      setCreateError(null)

      void createAgentDraft(
        {
          title: options.title,
          profile: options.profile,
          source: options.source,
          contextGoal: options.contextGoal,
          recordId: options.recordId,
          sprintTag: options.sprintTag,
          snapshotId: options.snapshotId,
          includeContent: options.includeContent,
          includeAssets: options.includeAssets,
          includeRelations: options.includeRelations,
          includeDiagnostics: options.includeDiagnostics,
        },
        controller.signal,
      )
        .then((data) => {
          if (createRequestIdRef.current !== requestId || controller.signal.aborted) return
          setDrafts((prev) => [data.draft, ...prev])
          setSelectedDraft(data.draft)
        })
        .catch((err: unknown) => {
          if (createRequestIdRef.current !== requestId || controller.signal.aborted || axios.isCancel(err)) return
          setCreateError(err instanceof Error ? err.message : String(err))
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
    isDrawerOpen,
    drafts,
    selectedDraft,
    isListLoading,
    isDetailLoading,
    isCreating,
    listError,
    detailError,
    createError,
    openDrawer,
    closeDrawer,
    loadDraftList,
    loadDraftDetail,
    saveDraft,
  }
}
