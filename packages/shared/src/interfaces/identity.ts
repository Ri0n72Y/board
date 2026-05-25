export type Base58String = string

export interface Identity {
  publicKey: Base58String
  algorithm: 'ed25519'
}
