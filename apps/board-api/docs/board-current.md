# Board Current

`GET /api/v0/board/current` is the board-web main read entrypoint. It returns
the current projection produced from:

```text
base record + ordered patches + replay = current state
```

It is not a fact source, does not write to the database, does not advance the
snapshot head, and does not persist a current projection.

## Response Shape

Successful responses use `ApiResponse<BoardCurrentProjection>`.

Key fields:

- `snapshotHeadVersion` - snapshot-head/cache version observed while building the projection.
- `records` - displayable current records after replay and filtering.
- `blockedRecords` - records that could not be projected because of broken/conflicted patch chains.
- `summary` - projection counts and status.
- `diagnostics` - optional board-level projection diagnostics.

`records[].body` is the replayed current `RecordItem<RecordBody>`.
`records[].createdBy` and `records[].createdAt` come from the base record
envelope. Broken/conflicted records are not mixed into `records[]`.

## Canonical Filter Query

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

Supported query parameters:

- `tag=...` - single-tag compatibility parameter.
- `tags=...` - repeatable multi-tag parameter.
- `tagMatch=all|any` - defaults to `all`.
- `assignee=...`
- `assetId=...`
- `relationTarget=...`
- `q=...`
- `includeArchived=true`

All filters run against replayed current state.

## Filter Semantics

- `includeArchived !== true` excludes records whose current tags include `status:archived`.
- `includeArchived === true` includes archived current records.
- Missing `tagMatch` means `all`.
- `tags`, `assignee`, `assetId`, `relationTarget`, and `q` combine with AND semantics.
- `schema` is not a user filter in the current board route.
- Current Board, Current Board export, Context Pack export, and filtered Agent Draft context creation share `packages/shared/src/utils/boardFilter.ts`.

## q Search Scope

`q` searches the following current-state fields:

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

This differs from legacy `GET /api/v0/records?q=...`, which queries base
record/fact data and should not be used as the board-web current projection.

## Export / Context Pack Use

`GET /api/v0/board/current/export` builds a current projection, applies the
same shared board filter for selected/exported records, then renders Markdown.

The selected record set and reference lookup scope are intentionally separate:

- `context.records` is the selected/exported record set.
- The reference map is built from the full `projection.records`.
- This lets assets and relation targets render readable labels even when the
  referenced record is outside the selected export slice.

## Patch Edit Boundary

Board-web must not use `/api/v0/snapshot-head` for edit/status-move flows;
that HTTP route does not exist.

Canonical patch edit/status-move sequence:

```http
GET  /api/v0/records/:id/head
POST /api/v0/records/:id/patches
```

`GET /api/v0/records/:id/head` returns `parentId` and `currentVersion`.
The backend requires `currentVersion` and does not accept legacy version
aliases.
`currentVersion` is the current board patch-head version observed when
resolving the record head. It is currently the global patch-head version
(`patches.length`), not a record-local version. It advances when a patch is
appended and is used together with `parentId` for optimistic concurrency.
