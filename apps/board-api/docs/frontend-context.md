# Frontend Context

This document records the Phase 1 board-web integration contract. It describes
the existing backend capabilities that board-web may call; it does not authorize
new backend capabilities.

## Primary Read Entry

```http
GET /api/v0/board/current
```

Use `/board/current` as the current board source of truth. Do not use
`GET /api/v0/records` as the current board projection; it is a base
record/fact list.

Display current records from:

```text
response.data.records[].body
```

## Filters

Board-web may combine:

```http
GET /api/v0/board/current?tags=status:todo&tags=type:card&tagMatch=all
GET /api/v0/board/current?tag=status:todo
GET /api/v0/board/current?assignee=...
GET /api/v0/board/current?assetId=...
GET /api/v0/board/current?relationTarget=...
GET /api/v0/board/current?q=...
GET /api/v0/board/current?includeArchived=true
```

Rules:

- `tags` is repeatable; `tag` is a single-tag compatibility parameter.
- `tagMatch` defaults to `all`.
- Missing `includeArchived` excludes `status:archived`.
- Filters run on replayed current state.
- `q` searches pid, id, tags, assignee, assets, relation constraint/target,
  title, description, and content.
- `q` does not search schema, createdBy, createdAt, patch descriptions, or old body state.

## Write Interface Whitelist

Board-web Phase 1 may call only these write routes:

```text
POST  /api/v0/records
POST  /api/v0/records/:id/patches
POST  /api/v0/snapshots
POST  /api/v0/agent/drafts
POST  /api/v0/agent/drafts/:id/responses
PATCH /api/v0/agent/drafts/:id/review
```

`PATCH /api/v0/agent/drafts/:id/review` updates review metadata only.
`POST /api/v0/agent/drafts/:id/responses` stores a human-pasted manual response artifact only.

Board-web must not call:

```text
PATCH /api/v0/records/:id
POST /api/v0/patches
GET /api/v0/snapshot-head
POST /api/v0/agent/run
POST /api/v0/agent/apply
POST /api/v0/agent/execute
POST /api/v0/agent/responses/manual
```

## Patch Edit / Status Move Flow

Before submitting an edit or status move:

```http
GET /api/v0/records/:id/head
```

Use the returned `parentId` and `currentVersion` when submitting:

```http
POST /api/v0/records/:id/patches
```

Canonical payload:

```ts
{
  parentId: RecordId | null
  currentVersion: number
  tagChanges?: TagChanges
  assignee?: PublicKey | null
  body?: Record<string, unknown>
  assets?: AssetRef[]
  relations?: RelationRef[]
  description?: string
}
```

Use `tagChanges` for tag mutation. Do not submit full `tags` as the patch
tag mutation field, and do not submit unchanged null body fields.

Status move example:

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

The backend requires `currentVersion` and does not accept legacy version
aliases. Board-web must use `currentVersion` and must not read
`/api/v0/snapshot-head` for patch edit or move status; that HTTP route does
not exist.

`currentVersion` is the current board patch-head version observed when
resolving the record head. It is currently the global patch-head version
(`patches.length`), not a record-local version. It advances when a patch is
appended and is used together with `parentId` for optimistic concurrency.

## Export / Context Pack

- Current Board export and Agent Context Pack use the shared board filter.
- Exported/selected records are distinct from reference lookup scope.
- Asset and relation output may show readable labels, but stored payloads remain raw ids.
- Snapshot export uses the saved snapshot projection, not a current-board readback.
- Agent Draft `contextMarkdown` is captured at draft creation and is static.

## Agent Boundary

Phase 1 Agent workflow is manual and non-executing:

- No AI call is made by LabourBoard.
- `AGENT_API_KEY` must not appear in board-web source.
- Agent Draft is a Review Queue item, not an execution request.
- Handoff is formal Markdown for a reviewed draft, not execution authorization.
- Manual Agent Response is a pasted artifact, not proof of execution and not an applied patch.
- No board mutation passes through the Agent workflow.
