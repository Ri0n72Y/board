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
  const [editingSections, setEditingSections] = useState<TSection[]>([])
  const [draft, setDraft] = useState<TDraft>(() => initialDraft())
  const [pendingExit, setPendingExit] = useState(false)

  const dirty = useMemo(() => isDirty(draft), [draft, isDirty])
  const editingSection = editingSections.at(-1) ?? null

  const isEditing = useCallback(
    (section: TSection) => editingSections.includes(section),
    [editingSections]
  )

  const beginEdit = useCallback((section: TSection) => {
    setSelectedSection(section)
    setEditingSections((current) =>
      current.includes(section) ? current : [...current, section]
    )
  }, [])

  const requestSection = useCallback((section: TSection) => {
    setSelectedSection(section)
    setEditingSections((current) =>
      current.includes(section) ? current : [...current, section]
    )
    return true
  }, [])

  const requestClose = useCallback(() => {
    if (editingSections.length > 0 && dirty) {
      setPendingExit(true)
      return false
    }
    return true
  }, [dirty, editingSections.length])

  const cancelPendingExit = useCallback(() => {
    setPendingExit(false)
  }, [])

  const discardPendingExit = useCallback(() => {
    setDraft(initialDraft())
    setEditingSections([])
    setSelectedSection(null)
    setPendingExit(false)
  }, [initialDraft])

  const finishSave = useCallback(
    (section?: TSection | null) => {
      setDraft(initialDraft())
      setEditingSections([])
      setSelectedSection(section ?? selectedSection)
      setPendingExit(false)
    },
    [initialDraft, selectedSection]
  )

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
    requestClose,
    cancelPendingExit,
    discardPendingExit,
    finishSave,
  }
}
