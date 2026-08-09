import { useCallback, useEffect, useMemo, useRef } from 'react'
import type { Ref } from 'react'
import { useDraggable, useDroppable } from '@dnd-kit/react'
import type {
  RecordBody,
  RecordItem,
  RecordResponse,
  Tag,
} from '@labour-board/shared'

const BOARD_RECORD_DND_TYPE = 'board-record-status-card'
const RECORD_DRAG_ID_PREFIX = 'record:'
const STATUS_DROP_ID_PREFIX = 'status-column:'

interface BoardDragEndEvent {
  canceled?: boolean
  operation: {
    source?: { id?: string | number | null } | null
    target?: { id?: string | number | null } | null
    position: { current: { x: number; y: number } }
  }
}

interface UseBoardStatusDndArgs {
  records: RecordResponse<RecordItem<RecordBody>>[]
  visibleStatusTags: ReadonlySet<Tag>
  isMovePending: boolean
  onMoveStatus?: (
    record: RecordResponse<RecordItem<RecordBody>>,
    targetStatusTag: Tag
  ) => void
  onReorderRecord?: (
    record: RecordResponse<RecordItem<RecordBody>>,
    fromStatus: Tag | null,
    toStatus: Tag | null,
    insertIndex: number
  ) => void
}

export function useBoardStatusDnd({
  records,
  visibleStatusTags,
  isMovePending,
  onMoveStatus,
  onReorderRecord,
}: UseBoardStatusDndArgs) {
  const statusDropTargetsRef = useRef(new Map<Tag, HTMLElement>())
  const columnCardTargetsRef = useRef(new Map<Tag, Map<string, HTMLElement>>())
  const lastPointerPositionRef = useRef<{ x: number; y: number } | null>(null)

  const recordsById = useMemo(() => {
    const byId = new Map<string, RecordResponse<RecordItem<RecordBody>>>()
    for (const record of records) byId.set(record.body.id, record)
    return byId
  }, [records])

  const registerStatusDropTarget = useCallback(
    (tag: Tag, element: HTMLElement | null) => {
      if (element) {
        statusDropTargetsRef.current.set(tag, element)
      } else {
        statusDropTargetsRef.current.delete(tag)
      }
    },
    []
  )

  const registerCardTarget = useCallback(
    (tag: Tag | null, recordId: string, element: HTMLElement | null) => {
      if (!tag) return
      if (!element) {
        columnCardTargetsRef.current.get(tag)?.delete(recordId)
        return
      }
      let cards = columnCardTargetsRef.current.get(tag)
      if (!cards) {
        cards = new Map()
        columnCardTargetsRef.current.set(tag, cards)
      }
      cards.set(recordId, element)
    },
    []
  )

  const computeInsertIndex = useCallback(
    (tag: Tag, point: { x: number; y: number } | null): number => {
      const cards = columnCardTargetsRef.current.get(tag)
      if (!cards) return 0
      const elements = [...cards.values()]
      if (elements.length === 0 || !point) return 0

      let index = elements.length
      for (let i = 0; i < elements.length; i += 1) {
        const rect = elements[i].getBoundingClientRect()
        if (point.y < rect.top + rect.height / 2) {
          index = i
          break
        }
      }
      return index
    },
    []
  )

  useEffect(() => {
    const updatePointerPosition = (event: PointerEvent) => {
      lastPointerPositionRef.current = {
        x: event.clientX,
        y: event.clientY,
      }
    }

    window.addEventListener('pointermove', updatePointerPosition, true)
    window.addEventListener('pointerup', updatePointerPosition, true)
    return () => {
      window.removeEventListener('pointermove', updatePointerPosition, true)
      window.removeEventListener('pointerup', updatePointerPosition, true)
    }
  }, [])

  const handleDragStart = useCallback(() => {
    lastPointerPositionRef.current = null
  }, [])

  const handleDragEnd = useCallback(
    (event: BoardDragEndEvent) => {
      if (event.canceled || isMovePending || !onMoveStatus) return

      const recordId = parseRecordDragId(event.operation.source?.id)
      const targetStatusTag = parseStatusDropId(event.operation.target?.id)
      if (!recordId || !targetStatusTag) return
      if (!visibleStatusTags.has(targetStatusTag)) return
      if (
        !isPointInsideStatusDropTarget(
          targetStatusTag,
          lastPointerPositionRef.current ?? event.operation.position.current,
          statusDropTargetsRef.current
        )
      ) {
        return
      }

      const record = recordsById.get(recordId)
      if (!record) return
      const currentStatus =
        record.body.tags.find((tag) => tag.startsWith('status:')) ?? null
      const point =
        lastPointerPositionRef.current ?? event.operation.position.current

      let insertIndex = computeInsertIndex(targetStatusTag, point)
      if (currentStatus === targetStatusTag) {
        // Same-column reorder: the dragged card's own rect is part of the
        // index math, so the insertion index shifts by one when it sat above
        // the drop point.
        const columnCards = [
          ...(columnCardTargetsRef.current.get(targetStatusTag)?.keys() ?? []),
        ]
        const draggedIndex = columnCards.indexOf(recordId)
        if (draggedIndex >= 0 && draggedIndex < insertIndex) {
          insertIndex -= 1
        }
      }

      onReorderRecord?.(record, currentStatus, targetStatusTag, insertIndex)

      if (currentStatus === targetStatusTag) return

      onMoveStatus(record, targetStatusTag)
    },
    [
      computeInsertIndex,
      isMovePending,
      onMoveStatus,
      onReorderRecord,
      recordsById,
      visibleStatusTags,
    ]
  )

  return {
    handleDragEnd,
    handleDragStart,
    registerStatusDropTarget,
    registerCardTarget,
  }
}

export function useStatusColumnDropTarget({
  columnId,
  tag,
  dragDisabled,
  registerStatusDropTarget,
}: {
  columnId: string
  tag: Tag | null
  dragDisabled: boolean
  registerStatusDropTarget: (tag: Tag, element: HTMLElement | null) => void
}) {
  const isStatusDropTarget = tag?.startsWith('status:') ?? false
  const { ref, isDropTarget } = useDroppable({
    id: tag ? `${STATUS_DROP_ID_PREFIX}${tag}` : columnId,
    accept: BOARD_RECORD_DND_TYPE,
    disabled: !isStatusDropTarget || dragDisabled,
  })

  const setDropRef = useCallback(
    (element: HTMLElement | null) => {
      ref(element)
      if (tag?.startsWith('status:')) {
        registerStatusDropTarget(tag, element)
      }
    },
    [ref, registerStatusDropTarget, tag]
  )

  return {
    isDropTarget,
    setDropRef,
  }
}

export function useRecordStatusDraggable({
  recordId,
  dragDisabled,
}: {
  recordId: string
  dragDisabled: boolean
}) {
  const { ref, handleRef, isDragging } = useDraggable({
    id: `${RECORD_DRAG_ID_PREFIX}${recordId}`,
    type: BOARD_RECORD_DND_TYPE,
    disabled: dragDisabled,
  })

  return {
    cardRef: ref as unknown as Ref<HTMLElement>,
    dragHandleRef: handleRef as unknown as Ref<HTMLButtonElement>,
    isDragging,
  }
}

function parseRecordDragId(
  id: string | number | null | undefined
): string | null {
  if (typeof id !== 'string') return null
  if (!id.startsWith(RECORD_DRAG_ID_PREFIX)) return null
  return id.slice(RECORD_DRAG_ID_PREFIX.length) || null
}

function parseStatusDropId(id: string | number | null | undefined): Tag | null {
  if (typeof id !== 'string') return null
  if (!id.startsWith(STATUS_DROP_ID_PREFIX)) return null
  const tag = id.slice(STATUS_DROP_ID_PREFIX.length)
  return tag.startsWith('status:') ? (tag as Tag) : null
}

function isPointInsideStatusDropTarget(
  tag: Tag,
  point: { x: number; y: number },
  targets: ReadonlyMap<Tag, HTMLElement>
): boolean {
  const element = targets.get(tag)
  if (!element) return false

  const rect = element.getBoundingClientRect()
  return (
    point.x >= rect.left &&
    point.x <= rect.right &&
    point.y >= rect.top &&
    point.y <= rect.bottom
  )
}
