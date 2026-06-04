import axios from 'axios'
import type { ApiResponse, Profile } from '@labour-board/shared'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api/v0'

export async function fetchProfiles(signal?: AbortSignal): Promise<Profile[]> {
  const url = `${apiBaseUrl}/profiles`
  const response = await axios.get<ApiResponse<Profile[]>>(url, { signal })

  if (!response.data.ok) {
    throw new Error(response.data.error.message)
  }

  return response.data.data
}
