import type { PublicKey } from './record.js'

export interface Profile {
  pk: PublicKey
  name: string
  avatarUrl?: string | null
  createdAt?: string
  updatedAt?: string
}

export type ProfileMap = Record<PublicKey, Profile>
