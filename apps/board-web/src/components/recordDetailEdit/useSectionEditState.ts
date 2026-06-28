import { useCallback, useMemo, useState } from 'react'

interface SectionEditStateOptions<TSection extends string, TDraft> {
  initialDraft: () => TDraft
  isDirty: (draft: TDraft) => boolean
}

interface PendingSectionExit<TSection extends string> {
  nextSection: TSection | null
}

export function useSectionEditState<TSection extends string, TDraft>({
  initialDraft,
  isDirty,
}: SectionEditStateOptions<TSection, TDraft>) {
  const [selectedSection, setSelectedSection] = useState<TSection | null>(null)
  const [editingSection, setEditingSection] = useState<TSection | null>(null)
  const [draft, setDraft] = useState<TDraft>(() => initialDraft())
  const [pendingExit, setPendingExit] = useState<PendingSectionExit<TSection> | null>(null)

  const dirty = useMemo(() => isDirty(draft), [draft, isDirty])

  const beginEdit = useCallback((section: TSection) => {
    setSelectedSection(section)
    setDraft(initialDraft())
    setEditingSection(section)
  }, [initialDraft])

  const requestSection = useCallback((section: TSection) => {
    if (editingSection && editingSection !== section && dirty) {
      setPendingExit({ nextSection: section })
      return false
    }
    setSelectedSection(section)
    return true
  }, [dirty, editingSection])

  const requestClose = useCallback(() => {
    if (editingSection && dirty) {
      setPendingExit({ nextSection: null })
      return false
    }
    return true
  }, [dirty, editingSection])

  const cancelPendingExit = useCallback(() => {
    setPendingExit(null)
  }, [])

  const discardPendingExit = useCallback(() => {
    const nextSection = pendingExit?.nextSection ?? null
    setDraft(initialDraft())
    setEditingSection(null)
    setSelectedSection(nextSection)
    setPendingExit(null)
    return nextSection
  }, [initialDraft, pendingExit])

  const finishSave = useCallback((section?: TSection | null) => {
    setDraft(initialDraft())
    setEditingSection(null)
    setSelectedSection(section ?? selectedSection)
    setPendingExit(null)
  }, [initialDraft, selectedSection])

  return {
    selectedSection,
    editingSection,
    draft,
    dirty,
    pendingExit,
    setDraft,
    setSelectedSection,
    setEditingSection,
    beginEdit,
    requestSection,
    requestClose,
    cancelPendingExit,
    discardPendingExit,
    finishSave,
  }
}
