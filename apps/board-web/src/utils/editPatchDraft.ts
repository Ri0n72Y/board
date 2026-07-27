import type {
  AssetRef,
  PublicKey,
  RecordBody,
  RecordItem,
  RelationRef,
  Tag,
  TagChanges,
} from '@labour-board/shared'
import { normalizeRelationDrafts, sameRelations } from './relationDisplay'
import { buildTagChanges } from './tagChanges'

export interface EditPatchFormState {
  title: string
  summary: string
  details: string
  statusTag: string
  priorityTag: string
  otherTags: Tag[]
  unsupportedTags: Tag[]
  assignee: string
  assets: string[]
  relations: RelationRef[]
}

export interface EditPatchDraft {
  tagChanges?: TagChanges
  assignee?: PublicKey | null
  assets?: AssetRef[]
  relations?: RelationRef[]
  body?: {
    title?: string
    description?: string | null
    content?: string | null
  }
}

export interface EditHeadState {
  lastPatchId: string | null
  currentVersion: number
}

export interface EditFieldDirtyState {
  title: boolean
  summary: boolean
  details: boolean
  statusTag: boolean
  priorityTag: boolean
  otherTags: boolean
  assignee: boolean
  assets: boolean
  relations: boolean
}

export function hasEditHeadChanged(
  base: EditHeadState,
  latest: EditHeadState
): boolean {
  return (
    base.lastPatchId !== latest.lastPatchId ||
    base.currentVersion !== latest.currentVersion
  )
}

export function buildEditFieldDirtyState(
  form: EditPatchFormState,
  current: RecordItem<RecordBody>
): EditFieldDirtyState {
  const currentBody = asEditableBody(current.body)
  const currentStatusTag =
    current.tags.find((tag) => tag.startsWith('status:')) ?? ''
  const currentPriorityTag =
    current.tags.find((tag) => tag.startsWith('priority:')) ?? ''
  const currentOtherTags = current.tags.filter(
    (tag) => !tag.startsWith('status:') && !tag.startsWith('priority:')
  )
  const nextOtherTags = uniqueValues([
    ...form.otherTags,
    ...form.unsupportedTags,
  ])
  const nextAssets = normalizeAssets(form.assets)
  const currentAssignee = current.assignee ?? null
  const nextAssignee = form.assignee.trim()
    ? (form.assignee.trim() as PublicKey)
    : null

  return {
    title: form.title.trim() !== currentBody.title,
    summary:
      nullableTrimmed(form.summary) !== nullableTrimmed(currentBody.description),
    details:
      nullableTrimmed(form.details) !== nullableTrimmed(currentBody.content),
    statusTag: form.statusTag.trim() !== currentStatusTag,
    priorityTag: form.priorityTag.trim() !== currentPriorityTag,
    otherTags: !sameStringSet(nextOtherTags, currentOtherTags),
    assignee: nextAssignee !== currentAssignee,
    assets: !sameStringList(nextAssets, current.assets ?? []),
    relations: !sameRelationDrafts(form.relations, current.relations ?? []),
  }
}

export function hasEditFieldChanges(state: EditFieldDirtyState): boolean {
  return Object.values(state).some(Boolean)
}

export function buildPatchDraft(
  form: EditPatchFormState,
  current: RecordItem<RecordBody>
): { ok: true; patch: EditPatchDraft } | { ok: false; error: string } {
  const title = form.title.trim()
  const statusTag = form.statusTag.trim() as Tag
  const priorityTag = form.priorityTag.trim() as Tag
  const tags = uniqueValues(
    [statusTag, priorityTag, ...form.otherTags, ...form.unsupportedTags].filter(
      Boolean
    ) as Tag[]
  )
  const assets = normalizeAssets(form.assets)
  const assignee = form.assignee.trim()
  const relations = normalizeRelationDrafts(form.relations)

  if (!title) return { ok: false, error: 'edit.errorTitleRequired' }

  const currentStatusTag =
    current.tags.find((tag) => tag.startsWith('status:')) ?? ''
  if (!statusTag && currentStatusTag) {
    return { ok: false, error: 'edit.errorStatusTagRequired' }
  }

  const patch: EditPatchDraft = {}
  const tagChanges = buildTagChanges(current.tags, tags)
  if (tagChanges) patch.tagChanges = tagChanges

  const currentAssignee = current.assignee ?? null
  const nextAssignee = assignee ? (assignee as PublicKey) : null
  if (nextAssignee !== currentAssignee) {
    patch.assignee = nextAssignee
  }

  if (!sameStringList(assets, current.assets ?? [])) {
    patch.assets = assets
  }

  if (!sameRelations(relations, current.relations ?? [])) {
    patch.relations = relations
  }

  const currentBody = asEditableBody(current.body)
  const bodyPatch: NonNullable<EditPatchDraft['body']> = {}
  if (title !== currentBody.title) {
    bodyPatch.title = title
  }

  const nextDescription = nullableTrimmed(form.summary)
  const currentDescription = nullableTrimmed(currentBody.description)
  if (nextDescription !== currentDescription) {
    bodyPatch.description = nextDescription
  }

  const nextContent = nullableTrimmed(form.details)
  const currentContent = nullableTrimmed(currentBody.content)
  if (nextContent !== currentContent) {
    bodyPatch.content = nextContent
  }

  if (Object.keys(bodyPatch).length > 0) {
    patch.body = bodyPatch
  }

  if (Object.keys(patch).length === 0) {
    return hasIncompleteRelationDrafts(form.relations)
      ? { ok: false, error: 'edit.errorIncompleteRelation' }
      : { ok: false, error: 'edit.errorNoChanges' }
  }

  return {
    ok: true,
    patch,
  }
}

export function asEditableBody(body: RecordBody): {
  title: string
  description: string
  content: string
} {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { title: '', description: '', content: '' }
  }
  return {
    title: stringValue(body, 'title'),
    description: stringValue(body, 'description'),
    content: stringValue(body, 'content'),
  }
}

function stringValue(source: object, key: string): string {
  const value = (source as Record<string, unknown>)[key]
  return typeof value === 'string' ? value : ''
}

function nullableTrimmed(value: string): string | null {
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function normalizeAssets(values: readonly string[]): AssetRef[] {
  return uniqueValues(
    values.map((asset) => asset.trim()).filter(Boolean)
  ) as AssetRef[]
}

function uniqueValues<T extends string>(values: readonly T[]): T[] {
  return [...new Set(values)]
}

function sameRelationDrafts(
  drafts: readonly RelationRef[],
  committed: readonly RelationRef[]
): boolean {
  const incompleteDrafts = drafts.filter((relation) => !isCompleteRelation(relation))
  const incompleteCommitted = committed.filter(
    (relation) => !isCompleteRelation(relation)
  )

  if (!sameRawRelationList(incompleteDrafts, incompleteCommitted)) return false

  return sameRelations(
    normalizeRelationDrafts(drafts),
    normalizeRelationDrafts(committed)
  )
}

function hasIncompleteRelationDrafts(relations: readonly RelationRef[]): boolean {
  return relations.some((relation) => !isCompleteRelation(relation))
}

function isCompleteRelation(relation: RelationRef): boolean {
  return Boolean(relation.constraint.trim() && relation.target.trim())
}

function sameRawRelationList(
  left: readonly RelationRef[],
  right: readonly RelationRef[]
): boolean {
  if (left.length !== right.length) return false
  return left.every((relation, index) => {
    const current = right[index]
    if (!current) return false
    return (
      relation.constraint === current.constraint &&
      relation.target === current.target &&
      (relation.description ?? '') === (current.description ?? '')
    )
  })
}

function sameStringList(left: readonly string[], right: readonly string[]) {
  if (left.length !== right.length) return false
  return left.every((value, index) => value === right[index])
}

function sameStringSet(left: readonly string[], right: readonly string[]) {
  if (left.length !== right.length) return false
  const rightSet = new Set(right)
  return left.every((value) => rightSet.has(value))
}
