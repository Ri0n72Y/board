import { create } from 'zustand'
import type {
  BoardCurrentProjection,
  BoardCurrentTagMatch,
  Tag,
} from '@labour-board/shared'
import { fetchBoardCurrent } from '../api/boardCurrent'
import {
  areBoardFiltersEqual,
  DEFAULT_BOARD_CURRENT_FILTERS,
  normalizeBoardFilterUrl,
  parseBoardFilterUrl,
  type BoardCurrentFilters,
} from '../utils/boardFilterUrl'

interface BoardCurrentState {
  /** Draft filters: always reflect user input immediately (raw q). */
  filters: BoardCurrentFilters
  /** Effective filters drive URL, board current loading, export, and drafts. */
  effectiveFilters: BoardCurrentFilters
  /** The effective filters that produced the current projection. */
  lastAppliedFilters: BoardCurrentFilters | null
  filterUrlApplyVersion: number
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
  setFilters: (filters: BoardCurrentFilters) => void
  setEffectiveFilters: (filters: BoardCurrentFilters) => void
  loadCurrentBoard: (
    filters: BoardCurrentFilters,
    signal?: AbortSignal
  ) => Promise<void>
}

const initialFilters = getInitialFilters()

let activeRequestId = 0

export const useBoardCurrentStore = create<BoardCurrentState>((set) => ({
  filters: initialFilters,
  effectiveFilters: cloneFilters(initialFilters),
  lastAppliedFilters: null,
  filterUrlApplyVersion: 0,
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
              tagMatch: 'any',
            },
            effectiveFilters: {
              ...state.effectiveFilters,
              tags: [...state.effectiveFilters.tags, tag],
              tagMatch: 'any',
            },
          }
    )
  },

  removeTag: (tag) =>
    set((state) => ({
      filters: {
        ...state.filters,
        tags: state.filters.tags.filter((value) => value !== tag),
        tagMatch: 'any',
      },
      effectiveFilters: {
        ...state.effectiveFilters,
        tags: state.effectiveFilters.tags.filter((value) => value !== tag),
        tagMatch: 'any',
      },
    })),

  setTagMatch: () =>
    set((state) => ({
      filters: { ...state.filters, tagMatch: 'any' },
      effectiveFilters: { ...state.effectiveFilters, tagMatch: 'any' },
    })),

  setIncludeArchived: (includeArchived) =>
    set((state) => ({
      filters: { ...state.filters, includeArchived },
      effectiveFilters: { ...state.effectiveFilters, includeArchived },
    })),

  setAssignee: (assignee) =>
    set((state) => ({
      filters: { ...state.filters, assignee },
      effectiveFilters: { ...state.effectiveFilters, assignee },
    })),

  setAssetId: (assetId) =>
    set((state) => ({
      filters: { ...state.filters, assetId },
      effectiveFilters: { ...state.effectiveFilters, assetId },
    })),

  setRelationTarget: (relationTarget) =>
    set((state) => ({
      filters: { ...state.filters, relationTarget },
      effectiveFilters: { ...state.effectiveFilters, relationTarget },
    })),

  setFilters: (filters) =>
    set((state) => {
      const normalized = cloneFilters(normalizeBoardFilterUrl(filters))
      return {
        filters: normalized,
        effectiveFilters: cloneFilters(normalized),
        filterUrlApplyVersion: state.filterUrlApplyVersion + 1,
      }
    }),

  setEffectiveFilters: (filters) =>
    set((state) => {
      const normalized = cloneFilters(normalizeBoardFilterUrl(filters))
      return areBoardFiltersEqual(state.effectiveFilters, normalized)
        ? state
        : { effectiveFilters: normalized }
    }),

  loadCurrentBoard: async (filters, signal) => {
    const requestId = ++activeRequestId
    set({ isLoading: true, error: null })

    try {
      const projection = await fetchBoardCurrent(filters, signal)
      if (requestId !== activeRequestId) return
      set({
        projection,
        isLoading: false,
        lastAppliedFilters: { ...filters, tags: [...filters.tags] },
      })
    } catch (caught) {
      if (requestId !== activeRequestId) return
      if (signal?.aborted) {
        set({ isLoading: false })
        return
      }
      set({
        error: caught instanceof Error ? caught.message : 'Request failed',
        isLoading: false,
      })
    }
  },
}))

function getInitialFilters(): BoardCurrentFilters {
  if (typeof window === 'undefined')
    return cloneFilters(DEFAULT_BOARD_CURRENT_FILTERS)
  return parseBoardFilterUrl(window.location.search)
}

function cloneFilters(filters: BoardCurrentFilters): BoardCurrentFilters {
  return {
    ...filters,
    tagMatch: 'any',
    tags: [...filters.tags],
  }
}
