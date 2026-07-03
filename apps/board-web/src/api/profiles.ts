import axios from 'axios'
import type {
  ApiResponse,
  CreateProfileInput,
  Profile,
  UpdateProfileInput,
} from '@labour-board/shared'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api/v0'

export async function fetchProfiles(signal?: AbortSignal): Promise<Profile[]> {
  const url = `${apiBaseUrl}/profiles`
  const response = await axios.get<ApiResponse<Profile[]>>(url, { signal })

  if (!response.data.ok) {
    throw new Error(response.data.error.message)
  }

  return response.data.data
}

export async function createProfile(
  input: CreateProfileInput,
  signal?: AbortSignal
): Promise<Profile> {
  const url = `${apiBaseUrl}/profiles`
  const response = await axios.post<ApiResponse<Profile>>(url, input, {
    signal,
  })

  if (!response.data.ok) {
    throw new Error(response.data.error.message)
  }

  return response.data.data
}

export async function updateProfile(
  pk: string,
  input: UpdateProfileInput,
  signal?: AbortSignal
): Promise<Profile> {
  const url = `${apiBaseUrl}/profiles/${encodeURIComponent(pk)}`
  const response = await axios.patch<ApiResponse<Profile>>(url, input, {
    signal,
  })

  if (!response.data.ok) {
    throw new Error(response.data.error.message)
  }

  return response.data.data
}
