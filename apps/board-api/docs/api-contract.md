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

## MVP 2.3 Read Routes

- `GET /api/v0/agent/skills` - list agent skills (summaries only, no full markdown).
- `GET /api/v0/agent/skills/:skillId` - read one agent skill detail (includes markdown).
- `GET /api/v0/agent/drafts/:draftId/suggestions` - list AI suggestion summaries for a draft (no full markdown).
- `GET /api/v0/agent/suggestions/:suggestionId` - read one AI suggestion detail (includes full markdown).

## MVP 2.3 Write Routes

- `POST /api/v0/agent/drafts/:draftId/suggestions` - generate an AI suggestion from a reviewed draft. Not a board mutation.
- `PATCH /api/v0/agent/suggestions/:suggestionId/review` - update suggestion review status. Not a board mutation.

## Phase 1 Write Routes

These routes exist in code. Board-web Phase 1 uses only the allowed subset
called out below.

- `POST /api/v0/records` - create a base record.
- `POST /api/v0/records/:id/patches` - append a patch to one record. This is the canonical record update/status-move route.
- `POST /api/v0/snapshots` - create a manual snapshot checkpoint.
- `POST /api/v0/agent/drafts` - create an Agent Draft review-queue item with static `contextMarkdown`.
- `PATCH /api/v0/agent/drafts/:id/review` - update draft review metadata only. It is not a board mutation.
- `POST /api/v0/agent/drafts/:id/responses` - create a manual response artifact pasted by a human. It is not a board mutation and does not apply a patch.
- `POST /api/v0/profiles` and `PATCH /api/v0/profiles/:pk` - profile CRUD routes. Board-web Phase 2 exposes profile management through these routes.

Board-web write whitelist:

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

## Routes That Do Not Exist

The following routes must remain absent unless a later PRD explicitly changes
the contract:

```text
POST /api/v0/agent/run
POST /api/v0/agent/apply
POST /api/v0/agent/execute
POST /api/v0/agent/suggestions/:id/apply
PATCH /api/v0/records/:id
DELETE /api/v0/records/:id
DELETE /api/v0/profiles/:pk
GET /api/v0/snapshot-head
POST /api/v0/patches
POST /api/v0/agent/responses/manual
POST /api/v0/agent/skills
PATCH /api/v0/agent/skills/:id
DELETE /api/v0/agent/skills/:id
PUT *
```

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
  currentVersion: number
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

The backend requires `currentVersion`. Legacy version aliases are not accepted.
`currentVersion` is the current board patch-head version observed when
resolving the record head. It is currently the global patch-head version
(`patches.length`), not a record-local version. It advances when a patch is
appended and is used together with `parentId` for optimistic concurrency.

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
- Patch edit/status-move uses the record head read response for `parentId` and `currentVersion`.
- Frontend patch edit/status-move must not use `/api/v0/snapshot-head`; that HTTP route does not exist.
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

## MVP 2.4 Addendum: Agent Provider Readiness

MVP 2.4 prepares the backend boundary for real Agent Suggestion providers. It
does not implement real provider network calls.

Provider config:

- Default provider remains `mock`.
- Supported provider kinds are `mock`, `disabled`, and `openai-compatible`.
- Provider config is backend-only and loaded from `AGENT_SUGGESTION_*` env vars.
- `AGENT_SUGGESTION_API_KEY` is read only by backend config.
- Public config/audit fields expose only `apiKeyPresent: boolean`; the key value is never returned.
- `mock` uses `AGENT_SUGGESTION_MODEL` for its reported model and defaults to `mock-suggestion-v1`.
- `openai-compatible` currently resolves to a disabled/stub provider and does not issue network requests.
- Provider fallback is never silent. If `openai-compatible` is configured, suggestion generation fails with provider unavailable instead of falling back to mock.

Budget check:

- Input chars are counted as `contextMarkdown.length + skill markdown lengths + instruction.length`.
- Token estimate is `Math.ceil(charCount / 4)`.
- Defaults: `maxInputChars=200000`, `maxEstimatedInputTokens=50000`, `maxOutputChars=50000`, `maxEstimatedOutputTokens=12000`.
- `AGENT_SUGGESTION_COST_BUDGET_CENTS` maps to reserved `costBudgetCents` in MVP 2.4. It is parsed by backend config but is not enforced while providers are mock or disabled/stub.
- Budget failure returns `413 PROVIDER_BUDGET_EXCEEDED`.
- Budget failure does not save a suggestion artifact.
- Error messages include counts/limits only, not raw context, skill markdown, prompt text, or keys.

Output quality validation:

- Provider output must include non-empty `title`, `summary`, `provider`, `model`, and `markdown`.
- Markdown must include `# LabourBoard AI Suggestion` and sections `## 1. Summary` through `## 7. Limits`.
- Markdown must not exceed configured output limits.
- Execution claims such as `I applied the patch`, `I executed`, `已修改看板`, or `已应用补丁` are rejected.
- `highlights` must be a string array and are capped at 5.
- `diagnostics`, when present, must be a string array. Each entry is capped at 500 characters and must not contain sensitive markers such as API key names, `Authorization`, `Bearer`, `prompt`, `contextMarkdown`, or `skill markdown`.
- Output validation failure returns `502 PROVIDER_OUTPUT_INVALID`.
- Output validation failure does not save a suggestion artifact.

Suggestion audit metadata:

- Suggestion detail may include `audit`.
- Audit stores `providerKind`, `providerModel`, `generatedAt`, `contextHash`, char counts, token estimates, budget/validation status, configured input/output limits, and `realProvider`.
- Audit does not store API keys, prompt full text, draft `contextMarkdown`, skill markdown, or full provider request payloads.
- Suggestion list summaries remain compact and do not return full `audit`, `markdown`, `skillSnapshots`, or `diagnostics`.
- Suggestion detail returns full markdown, skill snapshots, diagnostics, and audit.

Error semantics:

- Provider unavailable returns `503 PROVIDER_UNAVAILABLE`.
- Budget exceeded returns `413 PROVIDER_BUDGET_EXCEEDED`.
- Provider output invalid returns `502 PROVIDER_OUTPUT_INVALID`.

Unchanged boundaries:

- No board mutation through suggestions.
- No patch apply route.
- No run/apply/execute route.
- No tools execution.
- No CLI worker.
- No Tauri.
- board-web exposes no provider key and no provider config UI.

## Profile Contract (MVP 2.2)

Profile is application-layer auxiliary data, keyed by public key.

LabourBoard:
- Does not store private keys.
- Does not implement account/password login.
- All registered profiles have equal permissions (no role/ACL in MVP 2.2).
- Profile updates are plain CRUD; they do not go through record patches.

Profile shape:

```ts
interface Profile {
  pk: string           // public key — stable identity, unique
  name: string         // display name, required
  avatarUrl?: string | null  // optional http/https URL
  createdAt?: string
  updatedAt?: string
}
```

Routes:

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v0/profiles` | List all profiles (sorted by name, then pk) |
| GET | `/api/v0/profiles/:pk` | Read one profile |
| POST | `/api/v0/profiles` | Create a profile |
| PATCH | `/api/v0/profiles/:pk` | Update name / avatarUrl |

`DELETE /api/v0/profiles/:pk` does not exist.

Input rules:
- `pk` and `name` are trimmed before save.
- `name` must be non-empty after trim.
- `avatarUrl` empty/whitespace is saved as `null`.
- `avatarUrl` must be `http://` or `https://` when non-empty.
- Fields `privateKey`, `password`, `secretKey`, `seedPhrase` are rejected.
- Duplicate `pk` returns 409.
- PATCH body.pk must match path pk (both trimmed).

Assignee integration:
- Record `assignee` still stores the public key.
- Assignee UI uses profile SearchSelect (search by name or pk).
- URL filter `assignee` still uses public key.
- Unknown pk fallback shows "Unknown member" + short pk.
