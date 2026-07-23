import axios from 'axios'
import type {
  ApiResponse,
  AssetRef,
  PatchItem,
  PublicKey,
  RecordBody,
  RecordId,
  RecordItem,
  RecordResponse,
  RelationRef,
  Tag,
  TagChanges,
} from '@labour-board/shared'
import { useBoardCurrentStore } from '../stores/boardCurrentStore'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api/v0'

export class RecordPatchConflictError extends Error {
  readonly status = 409

  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'RecordPatchConflictError'
  }
}

export type NullableRecordBodyPatch = Record<string, unknown>

export interface SubmitRecordPatchPayload {
  parentId: RecordId | null
  currentVersion: number
  tagChanges?: TagChanges
  assignee?: PublicKey | null
  body?: NullableRecordBodyPatch
  assets?: AssetRef[]
  relations?: RelationRef[]
  description?: string
}

export interface SubmitRecordPatchResponse {
  patch: RecordResponse<PatchItem<NullableRecordBodyPatch>>
  newCurrentVersion: number
}

export async function submitRecordPatch(
  recordId: string,
  payload: SubmitRecordPatchPayload,
  signal?: AbortSignal
): Promise<SubmitRecordPatchResponse> {
  try {
    const response = await axios.post<ApiResponse<SubmitRecordPatchResponse>>(
      `${apiBaseUrl}/records/${encodeURIComponent(recordId)}/patches`,
      payload,
      { signal }
    )

    if (!response.data.ok) {
      throw new Error(response.data.error.message)
    }

    applySuccessfulPatchToProjection(recordId, payload)
    return response.data.data
  } catch (caught) {
    if (axios.isAxiosError<ApiResponse<SubmitRecordPatchResponse>>(caught)) {
      const data = caught.response?.data
      if (data && !data.ok) {
        const message = data.error.message
        if (caught.response?.status === 409 || data.error.code === 'CONFLICT') {
          throw new RecordPatchConflictError(message, { cause: caught })
        }
        throw new Error(message, { cause: caught })
      }
    }

    throw caught
  }
}

function applySuccessfulPatchToProjection(
  recordId: string,
  payload: SubmitRecordPatchPayload
): void {
  const state = useBoardCurrentStore.getState()
  const current = state.projection?.records.find(
    (record) => record.body.id === recordId
  )
  if (!current) return

  state.applyCommittedRecord({
    ...current,
    body: applyPatchToRecord(current.body, payload),
  })
}

function applyPatchToRecord(
  current: RecordItem<RecordBody>,
  payload: SubmitRecordPatchPayload
): RecordItem<RecordBody> {
  const next: RecordItem<RecordBody> = {
    ...current,
    tags: applyTagChanges(current.tags, payload.tagChanges),
    body: payload.body
      ? (deepMerge(current.body, payload.body) as RecordBody)
      : current.body,
    assets:
      payload.assets === undefined ? current.assets : [...payload.assets],
    relations:
      payload.relations === undefined
        ? current.relations
        : payload.relations.map((relation) => ({ ...relation })),
  }

  if ('assignee' in payload) {
    next.assignee = payload.assignee ?? undefined
  }

  return next
}

function applyTagChanges(tags: readonly Tag[], changes?: TagChanges): Tag[] {
  if (!changes) return [...tags]

  const next = new Set<Tag>(tags)
  for (const tag of changes.remove ?? []) next.delete(tag)
  for (const change of changes.change ?? []) {
    if (change.from) next.delete(change.from)
    if (change.to) next.add(change.to)
  }
  for (const tag of changes.add ?? []) next.add(tag)
  return [...next]
}

function deepMerge(current: unknown, patch: unknown): unknown {
  if (!isPlainObject(current) || !isPlainObject(patch)) return patch

  const merged: Record<string, unknown> = { ...current }
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue
    merged[key] = deepMerge(merged[key], value)
  }
  return merged
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(
    value &&
      typeof value === 'object' &&
      !Array.isArray(value)
  )
}
