import { useCallback, useEffect, useRef, useState } from 'react'
import axios from 'axios'
import type { AgentContextProfile } from '@labour-board/shared'
import {
  getAgentContextProfileDefinition,
  validateAgentContextProfileOptions,
} from '@labour-board/shared'
import { exportCurrentBoard } from '../api/exports'
import type { BoardCurrentFilters } from '../utils/boardFilterUrl'
import { hasEffectiveFilters } from '../utils/board'
import { downloadTextFile } from '../utils/download'
import { toastError, toastSuccess, toastWarning } from '../utils/toasts'

interface UseBoardExportControllerParams {
  appliedFilters: BoardCurrentFilters
}

export interface ExportContextPackOptions {
  profile: AgentContextProfile
  language?: string
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
        toastSuccess(`Exported ${data.filename}`)
      })
      .catch((unknownError: unknown) => {
        if (
          currentExportRequestIdRef.current !== requestId ||
          controller.signal.aborted ||
          axios.isCancel(unknownError)
        ) {
          return
        }
        const message = errorMessage(unknownError)
        setCurrentExportError(message)
        toastError(`Export failed: ${message}`)
      })
      .finally(() => {
        if (currentExportRequestIdRef.current !== requestId) return
        setIsCurrentExporting(false)
        currentExportAbortRef.current = null
      })
  }, [appliedFilters])

  const exportContextPack = useCallback(
    (options: ExportContextPackOptions): boolean => {
      const profileDefinition = getAgentContextProfileDefinition(options.profile)
      const validationError = validateContextPackOptions(
        options,
        profileDefinition.usesCurrentFilters ? appliedFilters : undefined,
      )
      if (validationError) {
        setContextExportError(validationError)
        toastWarning(validationError)
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
          language: options.language,
          contextGoal: options.contextGoal?.trim() || undefined,
          recordId: options.recordId,
          sprintTag: options.sprintTag,
          filters: profileDefinition.usesCurrentFilters ? appliedFilters : undefined,
          includeDiagnostics:
            options.includeDiagnostics ?? profileDefinition.defaultIncludeDiagnostics,
          includeRelations:
            options.includeRelations ?? profileDefinition.defaultIncludeRelations,
          includeAssets:
            options.includeAssets ?? profileDefinition.defaultIncludeAssets,
          includeContent:
            options.includeContent ?? profileDefinition.defaultIncludeContent,
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
          toastSuccess(`Exported ${data.filename}`)
        })
        .catch((unknownError: unknown) => {
          if (
            contextExportRequestIdRef.current !== requestId ||
            controller.signal.aborted ||
            axios.isCancel(unknownError)
          ) {
            return
          }
          const message = errorMessage(unknownError)
          setContextExportError(message)
          toastError(`Context export failed: ${message}`)
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
  filters?: BoardCurrentFilters,
): string | null {
  return (
    validateAgentContextProfileOptions({
      source: 'current-board',
      profile: options.profile,
      recordId: options.recordId,
      sprintTag: options.sprintTag,
      filters,
    }) ??
    null
  )
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
