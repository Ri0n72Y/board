import { create } from 'zustand'
import type {
  BoardCurrentProjection,
  BoardCurrentTagMatch,
  Tag,
} from '@labour-board/shared'
import {
  fetchBoardCurrent,
  type BoardCurrentFilters,
} from '../api/boardCurrent'

interface BoardCurrentState {
  filters: BoardCurrentFilters
  projection: BoardCurrentProjection | null
  isLoading: boolean
  error: string | null
  setQ: (q: string) => void
  addTag: (tag: string) => void
  removeTag: (tag: Tag) => void
  setTagMatch: (tagMatch: BoardCurrentTagMatch) => void
  setIncludeArchived: (includeArchived: boolean) => void
  setAssignee: (assignee: string) => void
  setAssetId: (assetId: string) => void
  setRelationTarget: (relationTarget: string) => void
  loadCurrentBoard: (signal?: AbortSignal) => Promise<void>
}

const initialFilters: BoardCurrentFilters = {
  q: '',
  tags: [],
  tagMatch: 'all',
  includeArchived: false,
  assignee: '',
  assetId: '',
  relationTarget: '',
}

export const useBoardCurrentStore = create<BoardCurrentState>((set, get) => ({
  filters: initialFilters,
  projection: null,
  isLoading: true,
  error: null,

  setQ: (q) =>
    set((state) => ({
      filters: { ...state.filters, q },
    })),

  addTag: (rawTag) => {
    const tag = rawTag.trim() as Tag
    if (!tag) return

    set((state) =>
      state.filters.tags.includes(tag)
        ? state
        : {
            filters: {
              ...state.filters,
              tags: [...state.filters.tags, tag],
            },
          }
    )
  },

  removeTag: (tag) =>
    set((state) => ({
      filters: {
        ...state.filters,
        tags: state.filters.tags.filter((value) => value !== tag),
      },
    })),

  setTagMatch: (tagMatch) =>
    set((state) => ({
      filters: { ...state.filters, tagMatch },
    })),

  setIncludeArchived: (includeArchived) =>
    set((state) => ({
      filters: { ...state.filters, includeArchived },
    })),

  setAssignee: (assignee) =>
    set((state) => ({
      filters: { ...state.filters, assignee },
    })),

  setAssetId: (assetId) =>
    set((state) => ({
      filters: { ...state.filters, assetId },
    })),

  setRelationTarget: (relationTarget) =>
    set((state) => ({
      filters: { ...state.filters, relationTarget },
    })),

  loadCurrentBoard: async (signal) => {
    set({ isLoading: true, error: null })

    try {
      const projection = await fetchBoardCurrent(get().filters, signal)
      set({ projection, isLoading: false })
    } catch (caught) {
      if (signal?.aborted) return
      set({
        error: caught instanceof Error ? caught.message : 'Request failed',
        isLoading: false,
      })
    }
  },
}))
