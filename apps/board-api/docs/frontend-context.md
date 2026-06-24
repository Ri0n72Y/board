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
- Board-web persists Board Current filter state in the page URL query using
  the same `BoardCurrentQuery` fields: `q`, repeatable `tags`, `tagMatch`,
  `includeArchived`, `assignee`, `assetId`, and `relationTarget`.
- Default URL values are omitted: empty strings, empty `tags`, `tagMatch=all`,
  and `includeArchived=false` do not appear in canonical board-web URLs.
- `tag` is accepted by board-web as a single-tag compatibility input and is
  canonicalized back to repeatable `tags`.
- Browser back/forward restores Board Current filters from the URL and reloads
  the current board with those filters.
- The frontend URL query helper is `apps/board-web/src/utils/boardFilterUrl.ts`;
  its closure check is `boardFilterUrl.devcheck.ts`.

## Write Interface Whitelist

Board-web may call only these write routes:

```text
POST  /api/v0/records
POST  /api/v0/records/:id/patches
POST  /api/v0/snapshots
POST  /api/v0/agent/drafts
POST  /api/v0/agent/drafts/:id/responses
PATCH /api/v0/agent/drafts/:id/review
POST  /api/v0/agent/drafts/:draftId/suggestions
PATCH /api/v0/agent/suggestions/:suggestionId/review
POST  /api/v0/profiles
PATCH /api/v0/profiles/:pk
```

`PATCH /api/v0/agent/drafts/:id/review` updates review metadata only.
`POST /api/v0/agent/drafts/:id/responses` stores a human-pasted manual response artifact only.

Board-web must not call:

```text
PATCH /api/v0/records/:id
DELETE /api/v0/records/:id
DELETE /api/v0/profiles/:pk
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
- Board-web passes the same URL-restored Board Current filters into Current
  Board export, Context Pack export, and filtered Agent Draft creation.
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

## MVP 2.3 Addendum: Agent Skill Registry + AI Suggestion

### Skill Registry

- `GET /api/v0/agent/skills` returns skill summaries without full markdown.
- `GET /api/v0/agent/skills/:skillId` returns full skill markdown.
- Built-in `labourboard-advisor` skill is always enabled and ranked first.
- Skills are read-only Markdown context files. No POST/PATCH/DELETE skill routes exist.
- Path traversal is prevented for skill file reads.

### AI Suggestions

- `POST /api/v0/agent/drafts/:draftId/suggestions` generates AI suggestions from a reviewed draft's `contextMarkdown`.
- `GET /api/v0/agent/drafts/:draftId/suggestions` returns suggestion summaries without full markdown.
- `GET /api/v0/agent/suggestions/:suggestionId` returns the full suggestion markdown.
- `PATCH /api/v0/agent/suggestions/:suggestionId/review` updates suggestion review status.
- Suggestions store `skillSnapshots` for audit trail.
- Suggestions store `contextHash` (sha256 of draft contextMarkdown).
- Suggestions do NOT mutate board records.
- Suggestions do NOT apply patches.
- board-web does NOT expose any provider API keys.
- Current provider is **mock** (`MockAgentSuggestionProvider`). Real provider integration is deferred.
- No `POST /api/v0/agent/run`, `POST /api/v0/agent/apply`, or `POST /api/v0/agent/execute` routes exist.
- No `POST /api/v0/agent/suggestions/:id/apply` route exists.

## MVP 2.4 Addendum: Agent Provider Readiness

- Real provider network calls are still not implemented.
- Default suggestion provider remains `mock`.
- Provider config is backend-only. board-web must not expose provider API keys, provider key inputs, provider selectors, or `VITE_*` provider key variables.
- `openai-compatible` currently means backend disabled/stub readiness only. It returns a provider unavailable error and must not call external APIs.
- Provider unavailable errors are displayed from the backend response; board-web does not fallback to mock.
- Budget exceeded errors are displayed from the backend response and do not create a suggestion.
- Provider output validation errors are displayed from the backend response and do not create a suggestion.
- Suggestion detail may display non-sensitive audit metadata: provider kind/model, generated time, context hash, char counts, token estimates, limits, budget status, output validation status, and `realProvider`.
- Suggestion list remains compact and does not show full audit, markdown, skill markdown, diagnostics, prompt text, or context text.
- Audit metadata must not include API keys, full prompts, full `contextMarkdown`, or full skill markdown.
- No board mutation, patch apply, tools execution, CLI worker, Tauri, run/apply/execute route, or suggestion apply route is added by provider readiness work.
