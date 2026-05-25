import type { PatchItem } from './patch.js'
import type { PublicKey, RecordItem } from './record.js'

export type TransactionStatus =
  | 'draft'
  | 'dryrun'
  | 'applied'
  | 'reverted'
  | 'cancelled'

export type TransactionItem = RecordItem | PatchItem

export interface TransactionBody {
  title: string
  description?: string
  content?: string
  participants?: PublicKey[]
  status: TransactionStatus
  items: TransactionItem[]
  extra?: Record<string, unknown>
}
