import type { Base58String } from './identity.js'
import type { PatchItem } from './patch.js'
import type { RecordItem } from './record.js'

export type HexSha256String = string
export type ProtocolName = 'sys.record'
export type SemVerString = '0.1.0'
export type UTCSecondString = string

export interface SysRecord<TBody = unknown> {
  id: HexSha256String
  signature: null
  protocol: ProtocolName
  version: SemVerString
  protocolHash: null
  createdBy: Base58String
  createdAt: UTCSecondString
  body: TBody
}

export type RecordEnvelope<TBody = RecordItem> = SysRecord<TBody>
export type PatchEnvelope<TBody = PatchItem> = SysRecord<TBody>
