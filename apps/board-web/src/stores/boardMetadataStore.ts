import { create } from 'zustand'
import type {
  BoardConfig,
  CreateProfileInput,
  Profile,
  UpdateProfileInput,
} from '@labour-board/shared'
import { fetchConfig } from '../api/config'
import {
  createProfile as createProfileApi,
  fetchProfiles,
  updateProfile as updateProfileApi,
} from '../api/profiles'

interface MetadataError {
  config: string | null
  profiles: string | null
}

interface BoardMetadataState {
  config: BoardConfig | null
  profiles: Profile[] | null
  isLoading: boolean
  error: MetadataError
  loadMetadata: (signal?: AbortSignal) => Promise<void>
  createProfile: (input: CreateProfileInput) => Promise<Profile>
  updateProfile: (pk: string, input: UpdateProfileInput) => Promise<Profile>
}

let activeMetadataRequestId = 0

export const useBoardMetadataStore = create<BoardMetadataState>((set) => ({
  config: null,
  profiles: null,
  isLoading: true,
  error: { config: null, profiles: null },

  loadMetadata: async (signal) => {
    const requestId = ++activeMetadataRequestId
    set({ isLoading: true, error: { config: null, profiles: null } })

    const results = await Promise.allSettled([
      fetchConfig(signal),
      fetchProfiles(signal),
    ])

    // Drop results from a superseded request — do not touch loading state
    if (requestId !== activeMetadataRequestId) return

    // This is still the latest request, but it was aborted
    if (signal?.aborted) {
      set({ isLoading: false })
      return
    }

    const configResult = results[0]
    const profilesResult = results[1]

    const configError =
      configResult.status === 'rejected'
        ? configResult.reason instanceof Error
          ? configResult.reason.message
          : 'Config request failed'
        : null

    const profilesError =
      profilesResult.status === 'rejected'
        ? profilesResult.reason instanceof Error
          ? profilesResult.reason.message
          : 'Profiles request failed'
        : null

    set({
      config:
        configResult.status === 'fulfilled' ? configResult.value : null,
      profiles:
        profilesResult.status === 'fulfilled' ? profilesResult.value : null,
      isLoading: false,
      error: { config: configError, profiles: profilesError },
    })
  },

  createProfile: async (input: CreateProfileInput): Promise<Profile> => {
    const created = await createProfileApi(input)
    set((state) => ({
      profiles: state.profiles
        ? [...state.profiles, created].sort(profileSort)
        : [created],
    }))
    return created
  },

  updateProfile: async (
    pk: string,
    input: UpdateProfileInput,
  ): Promise<Profile> => {
    const updated = await updateProfileApi(pk, input)
    set((state) => ({
      profiles: state.profiles
        ? state.profiles.map((p) => (p.pk === pk ? updated : p)).sort(profileSort)
        : null,
    }))
    return updated
  },
}))

function profileSort(a: Profile, b: Profile): number {
  const nameCompare = a.name.localeCompare(b.name)
  if (nameCompare !== 0) return nameCompare
  return a.pk.localeCompare(b.pk)
}
