import { useCallback, useEffect, useRef, useState } from 'react'
import axios from 'axios'
import { exportCurrentBoard } from '../api/exports'
import type { BoardCurrentFilters } from '../api/boardCurrent'
import { hasEffectiveFilters } from '../utils/board'
import { downloadTextFile } from '../utils/download'

interface UseBoardExportControllerParams {
  appliedFilters: BoardCurrentFilters
}

export function useBoardExportController({
  appliedFilters,
}: UseBoardExportControllerParams) {
  const [isCurrentExporting, setIsCurrentExporting] = useState(false)
  const [currentExportError, setCurrentExportError] = useState<string | null>(
    null,
  )
  const currentExportRequestIdRef = useRef(0)
  const currentExportAbortRef = useRef<AbortController | null>(null)

  const abortCurrentExport = useCallback(() => {
    currentExportRequestIdRef.current += 1
    currentExportAbortRef.current?.abort()
    currentExportAbortRef.current = null
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

  return {
    isCurrentExporting,
    currentExportError,
    exportCurrentMarkdown,
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
