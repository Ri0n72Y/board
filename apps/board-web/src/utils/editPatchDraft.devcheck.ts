import type { RecordBody, RecordItem } from '@labour-board/shared'
import {
  buildPatchDraft,
  hasEditHeadChanged,
  type EditPatchFormState,
} from './editPatchDraft'

const current: RecordItem<RecordBody> = {
  id: 'record-1',
  pid: 'CARD-1',
  schema: 'CardBody',
  tags: ['status:todo'],
  assignee: 'member-a',
  body: {
    title: 'Original title',
    description: 'Original description',
    content: 'Original content',
  },
  assets: ['asset-a'],
  relations: [{ constraint: 'blocks', target: 'record-2' }],
}

const baseForm: EditPatchFormState = {
  title: 'Original title',
  summary: 'Original description',
  details: 'Original content',
  statusTag: 'status:todo',
  priorityTag: '',
  otherTags: [],
  unsupportedTags: [],
  assignee: 'member-a',
  assets: ['asset-a'],
  relations: [{ constraint: 'blocks', target: 'record-2' }],
}

assertBodyPatch(
  'title only',
  { ...baseForm, title: 'New title' },
  { title: 'New title' }
)
assertBodyPatch(
  'description only',
  { ...baseForm, summary: 'New description' },
  { description: 'New description' }
)
assertBodyPatch(
  'content only',
  { ...baseForm, details: 'New content' },
  { content: 'New content' }
)

const noBody = buildPatchDraft({ ...baseForm, assignee: 'member-b' }, current)
assert(noBody.ok, 'assignee-only patch should be valid')
assert(!('body' in noBody.patch), 'unchanged body must not be submitted')

const unchanged = buildPatchDraft(baseForm, current)
assert(!unchanged.ok, 'unchanged form should not produce a patch')

const sameAssets = buildPatchDraft({ ...baseForm, title: 'New title' }, current)
assert(sameAssets.ok, 'title patch should be valid')
assert(
  !('assets' in sameAssets.patch),
  'unchanged assets must not be submitted'
)
assert(
  !('relations' in sameAssets.patch),
  'unchanged relations must not be submitted'
)

assert(
  !hasEditHeadChanged(
    { lastPatchId: 'patch-a', currentVersion: 1 },
    { lastPatchId: 'patch-a', currentVersion: 1 }
  ),
  'same head must not block submit'
)
assert(
  hasEditHeadChanged(
    { lastPatchId: 'patch-a', currentVersion: 1 },
    { lastPatchId: 'patch-b', currentVersion: 2 }
  ),
  'changed head must block submit before POST'
)
assert(
  hasEditHeadChanged(
    { lastPatchId: null, currentVersion: 0 },
    { lastPatchId: 'patch-a', currentVersion: 1 }
  ),
  'first-patch base must block when a newer patch appears'
)

function assertBodyPatch(
  name: string,
  form: EditPatchFormState,
  expected: NonNullable<
    ReturnType<typeof buildPatchDraft> extends infer R
      ? R extends { ok: true; patch: infer P }
        ? P extends { body?: infer B }
          ? B
          : never
        : never
      : never
  >
) {
  const result = buildPatchDraft(form, current)
  assert(result.ok, `${name} should be valid`)
  assertJsonEqual(result.patch.body, expected, name)
}

function assertJsonEqual(actual: unknown, expected: unknown, label: string) {
  const actualJson = JSON.stringify(actual)
  const expectedJson = JSON.stringify(expected)
  assert(
    actualJson === expectedJson,
    `${label}: expected ${expectedJson}, got ${actualJson}`
  )
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}
