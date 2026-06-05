import { useCallback, useEffect, useRef, useState } from 'react'
import axios from 'axios'
import type { SnapshotDetail, SnapshotSummary } from '@labour-board/shared'
import { exportSnapshot } from '../api/exports'
import {
  createSnapshot,
  fetchSnapshot,
  fetchSnapshots,
} from '../api/snapshots'
import { downloadTextFile } from '../utils/download'

export function useSnapshotController() {
  const [isSnapshotOpen, setIsSnapshotOpen] = useState(false)
  const [snapshots, setSnapshots] = useState<SnapshotSummary[]>([])
  const [selectedSnapshot, setSelectedSnapshot] =
    useState<SnapshotDetail | null>(null)
  const [snapshotReason, setSnapshotReason] = useState('')
  const [isSnapshotsLoading, setIsSnapshotsLoading] = useState(false)
  const [isSnapshotDetailLoading, setIsSnapshotDetailLoading] = useState(false)
  const [isSnapshotCreating, setIsSnapshotCreating] = useState(false)
  const [isSnapshotExporting, setIsSnapshotExporting] = useState(false)
  const [snapshotListError, setSnapshotListError] = useState<string | null>(null)
  const [snapshotDetailError, setSnapshotDetailError] = useState<string | null>(
    null,
  )
  const [snapshotCreateError, setSnapshotCreateError] = useState<string | null>(
    null,
  )
  const [snapshotExportError, setSnapshotExportError] = useState<string | null>(
    null,
  )

  const snapshotListRequestIdRef = useRef(0)
  const snapshotDetailRequestIdRef = useRef(0)
  const snapshotCreateRequestIdRef = useRef(0)
  const snapshotExportRequestIdRef = useRef(0)
  const snapshotListAbortRef = useRef<AbortController | null>(null)
  const snapshotDetailAbortRef = useRef<AbortController | null>(null)
  const snapshotCreateAbortRef = useRef<AbortController | null>(null)
  const snapshotExportAbortRef = useRef<AbortController | null>(null)

  const abortSnapshotRequests = useCallback(() => {
    snapshotListRequestIdRef.current += 1
    snapshotDetailRequestIdRef.current += 1
    snapshotCreateRequestIdRef.current += 1
    snapshotExportRequestIdRef.current += 1
    snapshotListAbortRef.current?.abort()
    snapshotDetailAbortRef.current?.abort()
    snapshotCreateAbortRef.current?.abort()
    snapshotExportAbortRef.current?.abort()
    snapshotListAbortRef.current = null
    snapshotDetailAbortRef.current = null
    snapshotCreateAbortRef.current = null
    snapshotExportAbortRef.current = null
  }, [])

  useEffect(() => abortSnapshotRequests, [abortSnapshotRequests])

  const loadSnapshots = useCallback(() => {
    const requestId = snapshotListRequestIdRef.current + 1
    snapshotListRequestIdRef.current = requestId
    snapshotListAbortRef.current?.abort()

    const controller = new AbortController()
    snapshotListAbortRef.current = controller
    setIsSnapshotsLoading(true)
    setSnapshotListError(null)

    void fetchSnapshots(controller.signal)
      .then((data) => {
        if (
          snapshotListRequestIdRef.current !== requestId ||
          controller.signal.aborted
        ) {
          return
        }
        setSnapshots(data.snapshots)
      })
      .catch((unknownError: unknown) => {
        if (
          snapshotListRequestIdRef.current !== requestId ||
          controller.signal.aborted ||
          axios.isCancel(unknownError)
        ) {
          return
        }
        setSnapshotListError(errorMessage(unknownError))
      })
      .finally(() => {
        if (snapshotListRequestIdRef.current !== requestId) return
        setIsSnapshotsLoading(false)
        snapshotListAbortRef.current = null
      })
  }, [])

  const loadSnapshotDetail = useCallback((snapshotId: string) => {
    const requestId = snapshotDetailRequestIdRef.current + 1
    snapshotDetailRequestIdRef.current = requestId
    snapshotDetailAbortRef.current?.abort()

    const controller = new AbortController()
    snapshotDetailAbortRef.current = controller
    setIsSnapshotDetailLoading(true)
    setSnapshotDetailError(null)

    void fetchSnapshot(snapshotId, controller.signal)
      .then((data) => {
        if (
          snapshotDetailRequestIdRef.current !== requestId ||
          controller.signal.aborted
        ) {
          return
        }
        setSelectedSnapshot(data.snapshot)
      })
      .catch((unknownError: unknown) => {
        if (
          snapshotDetailRequestIdRef.current !== requestId ||
          controller.signal.aborted ||
          axios.isCancel(unknownError)
        ) {
          return
        }
        setSnapshotDetailError(errorMessage(unknownError))
      })
      .finally(() => {
        if (snapshotDetailRequestIdRef.current !== requestId) return
        setIsSnapshotDetailLoading(false)
        snapshotDetailAbortRef.current = null
      })
  }, [])

  const openSnapshots = useCallback(() => {
    setIsSnapshotOpen(true)
    loadSnapshots()
  }, [loadSnapshots])

  const closeSnapshots = useCallback(() => {
    abortSnapshotRequests()
    setIsSnapshotOpen(false)
    setSnapshotListError(null)
    setSnapshotDetailError(null)
    setSnapshotCreateError(null)
    setSnapshotExportError(null)
    setIsSnapshotsLoading(false)
    setIsSnapshotDetailLoading(false)
    setIsSnapshotCreating(false)
    setIsSnapshotExporting(false)
  }, [abortSnapshotRequests])

  const submitSnapshot = useCallback(() => {
    const requestId = snapshotCreateRequestIdRef.current + 1
    snapshotCreateRequestIdRef.current = requestId
    snapshotCreateAbortRef.current?.abort()

    const controller = new AbortController()
    snapshotCreateAbortRef.current = controller
    setIsSnapshotCreating(true)
    setSnapshotCreateError(null)

    void createSnapshot({ reason: snapshotReason }, controller.signal)
      .then((data) => {
        if (
          snapshotCreateRequestIdRef.current !== requestId ||
          controller.signal.aborted
        ) {
          return
        }
        setSelectedSnapshot(data.snapshot)
        setSnapshotReason('')
        loadSnapshots()
      })
      .catch((unknownError: unknown) => {
        if (
          snapshotCreateRequestIdRef.current !== requestId ||
          controller.signal.aborted ||
          axios.isCancel(unknownError)
        ) {
          return
        }
        setSnapshotCreateError(errorMessage(unknownError))
      })
      .finally(() => {
        if (snapshotCreateRequestIdRef.current !== requestId) return
        setIsSnapshotCreating(false)
        snapshotCreateAbortRef.current = null
      })
  }, [loadSnapshots, snapshotReason])

  const exportSelectedSnapshotMarkdown = useCallback(() => {
    if (!selectedSnapshot) return

    const requestId = snapshotExportRequestIdRef.current + 1
    snapshotExportRequestIdRef.current = requestId
    snapshotExportAbortRef.current?.abort()

    const controller = new AbortController()
    snapshotExportAbortRef.current = controller
    setIsSnapshotExporting(true)
    setSnapshotExportError(null)

    void exportSnapshot(selectedSnapshot.id, { level: 'full' }, controller.signal)
      .then((data) => {
        if (
          snapshotExportRequestIdRef.current !== requestId ||
          controller.signal.aborted
        ) {
          return
        }
        downloadTextFile(data.filename, data.content)
      })
      .catch((unknownError: unknown) => {
        if (
          snapshotExportRequestIdRef.current !== requestId ||
          controller.signal.aborted ||
          axios.isCancel(unknownError)
        ) {
          return
        }
        setSnapshotExportError(errorMessage(unknownError))
      })
      .finally(() => {
        if (snapshotExportRequestIdRef.current !== requestId) return
        setIsSnapshotExporting(false)
        snapshotExportAbortRef.current = null
      })
  }, [selectedSnapshot])

  return {
    isSnapshotOpen,
    snapshots,
    selectedSnapshot,
    snapshotReason,
    isSnapshotsLoading,
    isSnapshotDetailLoading,
    isSnapshotCreating,
    isSnapshotExporting,
    snapshotListError,
    snapshotDetailError,
    snapshotCreateError,
    snapshotExportError,
    setSnapshotReason,
    loadSnapshots,
    loadSnapshotDetail,
    openSnapshots,
    closeSnapshots,
    submitSnapshot,
    exportSelectedSnapshotMarkdown,
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
