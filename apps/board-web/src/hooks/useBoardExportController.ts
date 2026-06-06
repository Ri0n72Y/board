import { useCallback, useEffect, useRef, useState } from 'react'
import axios from 'axios'
import type { AgentContextProfile } from '@labour-board/shared'
import { exportCurrentBoard } from '../api/exports'
import type { BoardCurrentFilters } from '../api/boardCurrent'
import { hasEffectiveFilters } from '../utils/board'
import { downloadTextFile } from '../utils/download'

interface UseBoardExportControllerParams {
  appliedFilters: BoardCurrentFilters
}

export interface ExportContextPackOptions {
  profile: AgentContextProfile
  contextGoal?: string
  recordId?: string
  sprintTag?: string
  includeDiagnostics?: boolean
  includeRelations?: boolean
  includeAssets?: boolean
  includeContent?: boolean
}

export function useBoardExportController({
  appliedFilters,
}: UseBoardExportControllerParams) {
  const [isCurrentExporting, setIsCurrentExporting] = useState(false)
  const [currentExportError, setCurrentExportError] = useState<string | null>(
    null,
  )
  const [isContextExporting, setIsContextExporting] = useState(false)
  const [contextExportError, setContextExportError] = useState<string | null>(
    null,
  )
  const currentExportRequestIdRef = useRef(0)
  const contextExportRequestIdRef = useRef(0)
  const currentExportAbortRef = useRef<AbortController | null>(null)
  const contextExportAbortRef = useRef<AbortController | null>(null)

  const abortCurrentExport = useCallback(() => {
    currentExportRequestIdRef.current += 1
    contextExportRequestIdRef.current += 1
    currentExportAbortRef.current?.abort()
    contextExportAbortRef.current?.abort()
    currentExportAbortRef.current = null
    contextExportAbortRef.current = null
  }, [])

  useEffect(() => abortCurrentExport, [abortCurrentExport])

  const exportCurrentMarkdown = useCallback(() => {
    const requestId = currentExportRequestIdRef.current + 1
    currentExportRequestIdRef.current = requestId
    currentExportAbortRef.current?.abort()

    const controller = new AbortController()
    currentExportAbortRef.current = controller
    setIsCurrentExporting(true)
    setCurrentExportError(null)

    const hasFilters = hasEffectiveFilters(appliedFilters)
    void exportCurrentBoard(
      {
        level: hasFilters ? 'filtered' : 'full',
        filters: hasFilters ? appliedFilters : undefined,
      },
      controller.signal,
    )
      .then((data) => {
        if (
          currentExportRequestIdRef.current !== requestId ||
          controller.signal.aborted
        ) {
          return
        }
        downloadTextFile(data.filename, data.content)
      })
      .catch((unknownError: unknown) => {
        if (
          currentExportRequestIdRef.current !== requestId ||
          controller.signal.aborted ||
          axios.isCancel(unknownError)
        ) {
          return
        }
        setCurrentExportError(errorMessage(unknownError))
      })
      .finally(() => {
        if (currentExportRequestIdRef.current !== requestId) return
        setIsCurrentExporting(false)
        currentExportAbortRef.current = null
      })
  }, [appliedFilters])

  const exportContextPack = useCallback(
    (options: ExportContextPackOptions): boolean => {
      const validationError = validateContextPackOptions(options)
      if (validationError) {
        setContextExportError(validationError)
        return false
      }

      const requestId = contextExportRequestIdRef.current + 1
      contextExportRequestIdRef.current = requestId
      contextExportAbortRef.current?.abort()

      const controller = new AbortController()
      contextExportAbortRef.current = controller
      setIsContextExporting(true)
      setContextExportError(null)

      void exportCurrentBoard(
        {
          profile: options.profile,
          contextGoal: options.contextGoal?.trim() || undefined,
          recordId: options.recordId,
          sprintTag: options.sprintTag,
          filters:
            options.profile === 'agent-filtered' ? appliedFilters : undefined,
          includeDiagnostics: options.includeDiagnostics,
          includeRelations: options.includeRelations,
          includeAssets: options.includeAssets,
          includeContent: options.includeContent,
        },
        controller.signal,
      )
        .then((data) => {
          if (
            contextExportRequestIdRef.current !== requestId ||
            controller.signal.aborted
          ) {
            return
          }
          downloadTextFile(data.filename, data.content)
        })
        .catch((unknownError: unknown) => {
          if (
            contextExportRequestIdRef.current !== requestId ||
            controller.signal.aborted ||
            axios.isCancel(unknownError)
          ) {
            return
          }
          setContextExportError(errorMessage(unknownError))
        })
        .finally(() => {
          if (contextExportRequestIdRef.current !== requestId) return
          setIsContextExporting(false)
          contextExportAbortRef.current = null
        })

      return true
    },
    [appliedFilters],
  )

  return {
    isCurrentExporting,
    currentExportError,
    isContextExporting,
    contextExportError,
    exportCurrentMarkdown,
    exportContextPack,
  }
}

function validateContextPackOptions(
  options: ExportContextPackOptions,
): string | null {
  if (options.profile === 'agent-card' && !options.recordId) {
    return 'Select a record for Agent Card Context.'
  }
  if (options.profile === 'agent-sprint' && !options.sprintTag) {
    return 'Enter a sprint tag for Agent Sprint Context.'
  }
  return null
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
