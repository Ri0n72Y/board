import { useCallback, useMemo, useState } from 'react'

interface SectionEditStateOptions<TDraft> {
  initialDraft: () => TDraft
  isDirty: (draft: TDraft) => boolean
}

export function useSectionEditState<TSection extends string, TDraft>({
  initialDraft,
  isDirty,
}: SectionEditStateOptions<TDraft>) {
  const [selectedSection, setSelectedSection] = useState<TSection | null>(null)
  const [editingSection, setEditingSection] = useState<TSection | null>(null)
  const [draft, setDraft] = useState<TDraft>(() => initialDraft())
  const [pendingExit, setPendingExit] = useState(false)

  const dirty = useMemo(() => isDirty(draft), [draft, isDirty])
  const editingSections = useMemo(
    () => (editingSection ? [editingSection] : []),
    [editingSection]
  )

  const isEditing = useCallback(
    (section: TSection) => editingSection === section,
    [editingSection]
  )

  const beginEdit = useCallback(
    (section: TSection) => {
      setSelectedSection(section)
      setDraft((currentDraft) => (isDirty(currentDraft) ? currentDraft : initialDraft()))
      setEditingSection(section)
    },
    [initialDraft, isDirty]
  )

  const requestSection = useCallback(
    (section: TSection) => {
      beginEdit(section)
      return true
    },
    [beginEdit]
  )

  const deactivateEditingSection = useCallback(() => {
    setEditingSection(null)
    setDraft((currentDraft) => (isDirty(currentDraft) ? currentDraft : initialDraft()))
  }, [initialDraft, isDirty])

  const clearEditState = useCallback(() => {
    setDraft(initialDraft())
    setEditingSection(null)
    setSelectedSection(null)
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
    (section?: TSection | null, nextDraft?: TDraft) => {
      setDraft(nextDraft ?? initialDraft())
      setEditingSection(null)
      setSelectedSection(section ?? selectedSection)
      setPendingExit(false)
    },
    [initialDraft, selectedSection]
  )

  const setEditingSections = useCallback((sections: TSection[]) => {
    setEditingSection(sections.at(-1) ?? null)
  }, [])

  return {
    selectedSection,
    editingSection,
    editingSections,
    draft,
    dirty,
    pendingExit,
    isEditing,
    setDraft,
    setSelectedSection,
    setEditingSections,
    beginEdit,
    requestSection,
    deactivateEditingSection,
    requestClose,
    cancelPendingExit,
    discardPendingExit,
    clearEditState,
    finishSave,
  }
}
