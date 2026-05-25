import type { PublicKey } from './record.js'

export interface Profile {
  pk: PublicKey
  name: string
  extra?: Record<string, unknown>
}

export type ProfileMap = Record<PublicKey, Profile>
