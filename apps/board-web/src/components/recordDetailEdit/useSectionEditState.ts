import { useCallback, useMemo, useState } from 'react'

interface SectionEditStateOptions<TDraft> {
  initialDraft: () => TDraft
  isDirty: (draft: TDraft) => boolean
}

export function useSectionEditState<TSection extends string, TDraft>({
  initialDraft,
  isDirty,
}: SectionEditStateOptions<TDraft>) {
  const [editingSection, setEditingSection] = useState<TSection | null>(null)
  const [draft, setDraft] = useState<TDraft>(() => initialDraft())
  const [pendingExit, setPendingExit] = useState(false)

  const dirty = useMemo(() => isDirty(draft), [draft, isDirty])

  const isEditing = useCallback(
    (section: TSection) => editingSection === section,
    [editingSection]
  )

  const beginEdit = useCallback(
    (section: TSection) => {
      setDraft((currentDraft) =>
        isDirty(currentDraft) ? currentDraft : initialDraft()
      )
      setEditingSection(section)
    },
    [initialDraft, isDirty]
  )

  const deactivateEditingSection = useCallback(() => {
    setEditingSection(null)
    setDraft((currentDraft) =>
      isDirty(currentDraft) ? currentDraft : initialDraft()
    )
  }, [initialDraft, isDirty])

  const clearEditState = useCallback(() => {
    setDraft(initialDraft())
    setEditingSection(null)
    setPendingExit(false)
  }, [initialDraft])

  const requestClose = useCallback(() => {
    if (dirty) {
      setEditingSection(null)
      setPendingExit(true)
      return false
    }
    clearEditState()
    return true
  }, [clearEditState, dirty])

  const cancelPendingExit = useCallback(() => {
    setPendingExit(false)
  }, [])

  const discardPendingExit = useCallback(() => {
    clearEditState()
  }, [clearEditState])

  const finishSave = useCallback(
    (nextDraft?: TDraft) => {
      setDraft(nextDraft ?? initialDraft())
      setEditingSection(null)
      setPendingExit(false)
    },
    [initialDraft]
  )

  return {
    editingSection,
    draft,
    dirty,
    pendingExit,
    isEditing,
    setDraft,
    beginEdit,
    deactivateEditingSection,
    requestClose,
    cancelPendingExit,
    discardPendingExit,
    clearEditState,
    finishSave,
  }
}
