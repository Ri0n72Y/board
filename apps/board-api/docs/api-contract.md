# API Contract

This document freezes the Phase 1 HTTP contract as implemented in the current
codebase. It is a developer-facing contract, not a full OpenAPI document.

All successful JSON responses use the shared envelope:

```ts
type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: ApiError }
```

## Phase 1 Read Routes

- `GET /api/v0/config` - read normalized YAML-backed board config.
- `GET /api/v0/profiles` - list profiles.
- `GET /api/v0/profiles/:profileKey` - read one profile.
- `GET /api/v0/records` - legacy/base record list. This is not the current board projection.
- `GET /api/v0/records/:id` - read one base record.
- `GET /api/v0/records/:id/head` - read the current patch head for one record. This is the canonical frontend source for `parentId` and `currentVersion` before edit/status-move patch submit.
- `GET /api/v0/records/:id/history` - read one record's replay/history.
- `GET /api/v0/patches?targetId=...` - read patch facts for debugging/history support.
- `GET /api/v0/patches/:id` - read one patch fact.
- `GET /api/v0/snapshot-head` - backend compatibility/current-head cache route. Board-web must not call this route.
- `GET /api/v0/board/current` - read the current board projection.
- `GET /api/v0/board/current/export` - export the current board as Markdown or Context Pack.
- `GET /api/v0/snapshots` - list saved snapshots.
- `GET /api/v0/snapshots/:id` - read one saved snapshot.
- `GET /api/v0/snapshots/:id/export` - export a saved snapshot from its stored projection.
- `GET /api/v0/agent/drafts` - list Agent Draft summaries. Summaries do not include `contextMarkdown`.
- `GET /api/v0/agent/drafts/:id` - read one Agent Draft detail, including `contextMarkdown`.
- `GET /api/v0/agent/drafts/:id/handoff` - generate formal handoff Markdown for a reviewed draft.
- `GET /api/v0/agent/drafts/:id/responses` - list manual response summaries for one draft.
- `GET /api/v0/agent/responses/:responseId` - read one manual response detail.

## Phase 1 Write Routes

These routes exist in code. Board-web Phase 1 uses only the allowed subset
called out below.

- `POST /api/v0/records` - create a base record.
- `POST /api/v0/records/:id/patches` - append a patch to one record. This is the canonical record update/status-move route.
- `POST /api/v0/snapshots` - create a manual snapshot checkpoint.
- `POST /api/v0/agent/drafts` - create an Agent Draft review-queue item with static `contextMarkdown`.
- `PATCH /api/v0/agent/drafts/:id/review` - update draft review metadata only. It is not a board mutation.
- `POST /api/v0/agent/drafts/:id/responses` - create a manual response artifact pasted by a human. It is not a board mutation and does not apply a patch.
- `POST /api/v0/profiles` and `PATCH /api/v0/profiles/:profileKey` - profile management routes exist, but board-web Phase 1 does not expose profile management.
- `PATCH /api/v0/records/:id` - legacy direct PATCH route exists only to return `410 Gone`; clients must not use it.
- `DELETE /api/v0/records/:id` - backend archive route exists. It is not used by board-web Phase 1 and is not part of the board-web write whitelist.

Board-web Phase 1 write whitelist:

```text
POST  /api/v0/records
POST  /api/v0/records/:id/patches
POST  /api/v0/snapshots
POST  /api/v0/agent/drafts
POST  /api/v0/agent/drafts/:id/responses
PATCH /api/v0/agent/drafts/:id/review
```

## Routes That Do Not Exist

The following routes must remain absent unless a later PRD explicitly changes
the contract:

```text
POST /api/v0/agent/run
POST /api/v0/agent/apply
POST /api/v0/agent/execute
POST /api/v0/patches
POST /api/v0/agent/responses/manual
PUT *
```

`DELETE *` cannot be documented as fully absent because
`DELETE /api/v0/records/:id` currently exists as a backend archive route.

## Board Current Filter Contract

Canonical query shape:

```ts
type BoardCurrentQuery = {
  q?: string
  tags?: Tag[]
  tagMatch?: 'all' | 'any'
  includeArchived?: boolean
  assignee?: string
  assetId?: string
  relationTarget?: string
}
```

- `includeArchived !== true` excludes records whose current state has `status:archived`.
- `includeArchived === true` includes archived current records.
- Missing `tagMatch` defaults to `all`.
- `tags`, `assignee`, `assetId`, `relationTarget`, and `q` combine with AND semantics.
- Filters run against replayed current state, not base-record state.
- Current Board, Current Board export, Context Pack export, and filtered Agent Draft creation share the same shared board filter semantics.

`q` searches:

```text
pid
id
tags
assignee
assets
relation.constraint
relation.target
body.title
body.description
body.content
```

`q` does not search:

```text
schema
createdBy
createdAt
patch descriptions
old body state
```

## Patch Contract

Canonical patch submission:

```http
GET  /api/v0/records/:id/head
POST /api/v0/records/:id/patches
```

Canonical request body fields:

```ts
type CreateRecordPatchInput<TBodyPatch = DeepPartial<RecordBody>> = {
  parentId: RecordId | null
  currentVersion?: number
  tagChanges?: {
    add?: Tag[]
    remove?: Tag[]
    change?: {
      namespace: string
      from: Tag | null
      to: Tag | null
    }[]
  }
  assignee?: PublicKey | null
  body?: TBodyPatch
  assets?: AssetRef[]
  relations?: RelationRef[]
  description?: string
}
```

The backend still accepts `snapshotVersion` as a deprecated compatibility alias
for `currentVersion`; board-web must use `currentVersion`.

Patch semantics:

- Patch no longer uses full `tags` as the canonical tag mutation field.
- Tag mutation uses `tagChanges`.
- Move status is encoded as a namespace change:

```json
{
  "tagChanges": {
    "change": [
      {
        "namespace": "status",
        "from": "status:todo",
        "to": "status:doing"
      }
    ]
  }
}
```

- Patch body should contain only changed fields. Do not submit unchanged nulls.
- Patch edit/status-move uses `GET /api/v0/records/:id/head` for `parentId` and `currentVersion`.
- Frontend patch edit/status-move must not use `/api/v0/snapshot-head`.
- `POST /api/v0/patches` is not a write entrypoint.

## Export / Context Pack Contract

- Current Board export and Context Pack use the shared board filter.
- `context.records` is the selected/exported record set.
- The reference map is built from the full `projection.records` so readable labels can resolve outside the selected export slice.
- Asset output includes a readable label and raw id.
- Relation output includes the constraint label, target readable label, and raw target id.
- Snapshot export uses the stored snapshot projection. It does not read back the current board.
- Agent Draft `contextMarkdown` is static content captured at draft creation time.
- Agent Draft list summaries do not return `contextMarkdown`.
- Agent Draft detail returns `contextMarkdown`.
- Export Markdown and Context Pack Markdown do not authorize execution or board mutation.

## Agent Boundary Contract

Agent Draft:

- Is a Review Queue item.
- Stores static `contextMarkdown`.
- Does not call real AI.
- Does not use `AGENT_API_KEY`.
- Does not generate a patch.
- Does not execute a patch.
- Does not mutate the board.

Review:

- `PATCH /api/v0/agent/drafts/:id/review` only changes draft review status/note metadata.
- It does not create a record, patch, or snapshot.

Handoff:

- `GET /api/v0/agent/drafts/:id/handoff` only generates formal handoff Markdown for a reviewed draft.
- It does not call AI, execute work, or write board state.

Manual Agent Response:

- `POST /api/v0/agent/drafts/:id/responses` stores a human-pasted artifact.
- It does not prove an AI executed.
- It does not mean a patch proposal was applied.
- It does not automatically write board state.
