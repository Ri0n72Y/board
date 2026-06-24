# Board Web Phase 1 Closure Report

Status date: 2026-06-20

This report closes Phase 1 as an auditable implementation snapshot. It freezes
current contracts and explicitly separates Phase 2 backlog from current scope.

## A. Phase 1 Completed Capabilities

1. Current Board projection via `GET /api/v0/board/current`.
2. Record create/edit/history/head.
3. Patch submit via `POST /api/v0/records/:id/patches`.
4. `tagChanges` patch semantics.
5. Status move encoded as a `status` namespace tag change.
6. Board view columns and compact board layout.
7. `SearchSelect`.
8. Asset selector and readable reference display.
9. Relation editor and readable relation display.
10. History readable summary.
11. Snapshot create/list/detail/export.
12. Current Board export and Context Pack.
13. Shared filter semantics across board/export/context/filtered draft.
14. Agent Draft Review Queue.
15. Manual Agent Response.
16. Formal Handoff.
17. Export/context readable references for assets and relations.
18. Safety boundaries for non-executing Agent workflow.
19. Board Current filter state persisted in URL query.

## B. Frozen Contracts

### Write Routes

Board-web Phase 1 write whitelist:

```text
POST  /api/v0/records
POST  /api/v0/records/:id/patches
POST  /api/v0/snapshots
POST  /api/v0/agent/drafts
POST  /api/v0/agent/drafts/:id/responses
PATCH /api/v0/agent/drafts/:id/review
```

Routes that do not exist:

```text
PATCH /api/v0/records/:id
DELETE /api/v0/records/:id
POST /api/v0/patches
GET /api/v0/snapshot-head
POST /api/v0/agent/responses/manual
PUT *
```

### Filter Semantics

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

- `includeArchived !== true` excludes `status:archived`.
- `includeArchived === true` includes archived current records.
- Missing `tagMatch` defaults to `all`.
- `tags + assignee + assetId + relationTarget + q` combine with AND semantics.
- `q` searches pid, id, tags, assignee, assets, relation constraint/target, title, description, and content.
- `q` does not search schema, createdBy, createdAt, patch descriptions, or old body state.
- Board-web persists these filters in the Board Current URL query.
- URL query uses the same `BoardCurrentQuery` fields: `q`, repeatable `tags`,
  `tagMatch`, `includeArchived`, `assignee`, `assetId`, and `relationTarget`.
- `tag` is accepted as a single-tag compatibility input and canonicalized back
  to repeatable `tags`.
- Default values are omitted from board-web URLs.
- Browser back/forward restores filters from the URL.

### Patch Semantics

- Canonical edit/status move head source: `GET /api/v0/records/:id/head`.
- Canonical submit route: `POST /api/v0/records/:id/patches`.
- Canonical version field: `currentVersion`. It is required.
- `currentVersion` is the current board patch-head version observed when resolving the record head. It is currently the global patch-head version (`patches.length`), not a record-local version.
- `currentVersion` advances when a patch is appended and is used together with `parentId` for optimistic concurrency.
- Legacy version aliases are not accepted.
- Tag mutation uses `tagChanges`, not a full `tags` replacement field.
- Patch body should omit unchanged fields and unchanged nulls.
- `POST /api/v0/patches` is not a write entrypoint.

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

### Export Semantics

- Current Board export and Context Pack use the shared board filter.
- Board-web Current Board export, Context Pack export, and filtered Agent Draft
  creation reuse the same URL-restored Board Current filters.
- `context.records` is the selected/exported record set.
- Reference map is built from full `projection.records`.
- Assets render readable label plus raw id.
- Relations render constraint label, target readable label, and raw target id.
- Snapshot export uses the stored snapshot projection and does not read current board.
- Agent Draft `contextMarkdown` is static at draft creation.
- Draft list summary excludes `contextMarkdown`; detail includes it.
- Export Markdown does not authorize execution.

### Agent Non-execution Semantics

Agent Draft:

- Review Queue item only.
- Stores static `contextMarkdown`.
- Does not call AI, use `AGENT_API_KEY`, generate a patch, execute a patch, or mutate the board.

Review:

- `PATCH /api/v0/agent/drafts/:id/review` only changes review status/note metadata.
- It does not create records, patches, or snapshots.

Handoff:

- `GET /api/v0/agent/drafts/:id/handoff` only generates formal handoff Markdown for a reviewed draft.
- It does not call AI, execute work, or write board state.

Manual Agent Response:

- A human-pasted artifact stored through `POST /api/v0/agent/drafts/:id/responses`.
- It is not proof of AI execution, not an applied patch proposal, and not an automatic board write.

## MVP 2.2 Member/Profile Management Addendum

Status date: 2026-06-21

This section records MVP 2.2 member management as completed on top of Phase 1.

### Profile Contract

- Profile is application-layer auxiliary data, keyed by public key.
- LabourBoard does not store private keys or implement account/password login.
- All registered profiles have equal permissions (no role/ACL).
- Profile updates are plain CRUD; they do not go through record patches.

### Profile Routes

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v0/profiles` | List all profiles (sorted by name, then pk) |
| GET | `/api/v0/profiles/:pk` | Read one profile |
| POST | `/api/v0/profiles` | Create a profile |
| PATCH | `/api/v0/profiles/:pk` | Update name / avatarUrl |

`DELETE /api/v0/profiles/:pk` does not exist.

### Assignee Integration

- Record `assignee` still stores the public key.
- Assignee UI uses profile SearchSelect (search by name or pk).
- URL filter `assignee` still uses public key.
- Unknown pk fallback shows "Unknown member" + short pk.

### Input Normalization

- `pk`, `name`, `avatarUrl` are trimmed before save.
- Empty/whitespace `avatarUrl` is saved as `null`.
- `privateKey`, `password`, `secretKey`, `seedPhrase` fields are rejected.
- Duplicate `pk` (after trim) returns 409.

### Write Whitelist (Updated)

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

### Prohibited

```text
DELETE /api/v0/profiles/:pk
private key / password / seed phrase fields
permission / role / ACL
React Router
```

## C. Known Non-blocking Debts

- Relation ordering is currently order-sensitive in `sameRelations`.
- `RelationEditor` row keys include target/constraint, so a row can remount when those values change.
- `applyExportFilters` was removed during closure because it was an unused route helper.
- Related export semantics are filter-first, then related-record selection.
- Browser smoke is a separate testing task, not a code-level closure gate.

## D. Phase 2 Backlog

These items are explicitly not implemented in this closure round:

- Saved filter data model.
- Graph view.
- Relation graph visualization.
- Asset registry.
- Permission / identity / login.
- Config editor.
- Agent real provider integration.
- Agent proposal generation.
- Dry-run transaction apply.
- Patch proposal / human approval flow.
- Long-term persistence hardening.
- Mongo smoke expansion.

## E. Closure Gates

Required validation for this closure:

```bash
pnpm --filter @labour-board/api test
pnpm --filter @labour-board/api typecheck
pnpm --filter @labour-board/web typecheck
pnpm --filter @labour-board/web build
pnpm --filter @labour-board/web lint
pnpm --filter @labour-board/api import:test-data -- --reset
pnpm --filter @labour-board/api exec tsx ../../packages/shared/src/utils/boardFilter.devcheck.ts
pnpm --filter @labour-board/api exec tsx ../../packages/shared/src/utils/exportReferenceDisplay.devcheck.ts
pnpm --filter @labour-board/api exec tsx ../board-web/src/utils/searchSelect.devcheck.ts
pnpm --filter @labour-board/api exec tsx ../board-web/src/utils/editPatchDraft.devcheck.ts
pnpm --filter @labour-board/api exec tsx ../board-web/src/utils/recordReferenceOptions.devcheck.ts
pnpm --filter @labour-board/api exec tsx ../board-web/src/utils/referenceDisplay.devcheck.ts
pnpm --filter @labour-board/api exec tsx ../board-web/src/utils/relationDisplay.devcheck.ts
pnpm --filter @labour-board/api exec tsx ../board-web/src/utils/historySummary.devcheck.ts
pnpm --filter @labour-board/api exec tsx ../board-web/src/utils/boardViewColumns.devcheck.ts
pnpm --filter @labour-board/api exec tsx ../board-web/src/utils/boardFilterUrl.devcheck.ts
pnpm --filter @labour-board/api exec tsx ../board-web/src/utils/profileDisplay.devcheck.ts
```

Browser smoke is not a closure gate for this round.

## MVP 2.3 Addendum: Agent Skill Registry + AI Suggestion Artifact

Status date: 2026-06-21

### New Capabilities

1. Agent Skill Registry (`GET /api/v0/agent/skills`, `GET /api/v0/agent/skills/:id`).
2. Built-in `labourboard-advisor` skill (always enabled, ranked first).
3. Agent Suggestion generation from reviewed Agent Drafts.
4. Suggestion list (summary only) and detail (full markdown) separation.
5. Agent Suggestion review status (generated/reviewed/discarded).
6. Skill snapshots stored immutably with each suggestion for audit.
7. Context hash (sha256) stored with each suggestion.
8. Mock provider for MVP 2.3 validation; real provider deferred.

### Frontier Boundaries (Unchanged)

- No board mutation through suggestions.
- No patch application.
- No tools execution.
- No CLI worker.
- No Tauri.
- No React Router.
- No provider API key exposure in board-web.
- No skill POST/PATCH/DELETE routes.
- No suggestion apply route.
- No `run`/`apply`/`execute` routes.

### New Routes Whitelist

```text
GET   /api/v0/agent/skills
GET   /api/v0/agent/skills/:skillId
POST  /api/v0/agent/drafts/:draftId/suggestions
GET   /api/v0/agent/drafts/:draftId/suggestions
GET   /api/v0/agent/suggestions/:suggestionId
PATCH /api/v0/agent/suggestions/:suggestionId/review
```

### New Forbidden Routes

```text
POST /api/v0/agent/skills
PATCH /api/v0/agent/skills/:id
DELETE /api/v0/agent/skills/:id
POST /api/v0/agent/suggestions/:id/apply
```

### Devcheck Gates

```text
pnpm --filter @labour-board/api exec tsx ../board-web/src/utils/agentSuggestionDisplay.devcheck.ts
```

### Provider Status

Current: **mock provider** only (`MockAgentSuggestionProvider`).
Real provider (openai-compatible) deferred to a subsequent iteration.

## MVP 2.4 Addendum: Agent Provider Readiness

Status date: 2026-06-24

### New Readiness Capabilities

1. Backend-only Agent Suggestion provider config via `AGENT_SUGGESTION_*` env vars.
2. Provider kinds: `mock`, `disabled`, `openai-compatible`.
3. Provider factory with explicit mock and disabled/stub behavior.
4. Provider unavailable, budget exceeded, output validation, timeout, and rate limit error classes.
5. Input budget check before provider generation.
6. Output quality validation before saving suggestions.
7. Suggestion detail audit metadata.
8. board-web detail display for non-sensitive audit fields.

### Provider Status

- Default provider remains `mock`.
- `openai-compatible` is a disabled/stub readiness mode only.
- No real provider network calls are implemented.
- No OpenAI, Anthropic, or DeepSeek SDK/package is introduced.
- No provider fallback happens silently. A configured unavailable provider fails the request.
- `AGENT_SUGGESTION_API_KEY` remains backend-only; public/audit metadata exposes only `apiKeyPresent`.

### Budget Check

- Input chars = draft `contextMarkdown` chars + skill markdown chars + instruction chars.
- Token estimate = `Math.ceil(charCount / 4)`.
- Defaults: `maxInputChars=200000`, `maxEstimatedInputTokens=50000`, `maxOutputChars=50000`, `maxEstimatedOutputTokens=12000`.
- Budget failure returns 413 and does not save a suggestion.
- Budget errors do not include raw context, skill markdown, prompt text, or keys.

### Output Quality Gate

- Required markdown title: `# LabourBoard AI Suggestion`.
- Required sections: `## 1. Summary`, `## 2. Board Diagnosis`, `## 3. Risks`, `## 4. Recommended Actions`, `## 5. Patch Candidate Notes`, `## 6. Questions for Human Review`, `## 7. Limits`.
- Empty markdown/title/summary/provider/model fail validation.
- Output length above configured limits fails validation.
- Execution claims such as `I applied the patch`, `I executed`, `已修改看板`, and `已应用补丁` fail validation.
- Non-string highlights fail validation; more than 5 highlights are capped.
- Validation failure returns 502 and does not save a suggestion.

### Audit Metadata

- Detail responses may include `audit`.
- Audit stores provider kind/model, generated time, context hash, context/skill/instruction char counts, estimated tokens, input limits, budget/validation status, and `realProvider`.
- Audit does not store API keys, prompt full text, draft `contextMarkdown`, or full skill markdown.
- List summaries remain compact and do not return full audit.

### Frontier Boundaries (Unchanged)

- No board mutation through suggestions.
- No patch application.
- No tools execution.
- No CLI worker.
- No Tauri.
- No React Router.
- No provider key exposure in board-web.
- No provider selector/key input UI in board-web.
- No suggestion apply route.
- No `run`/`apply`/`execute` routes.

### Error Semantics

- Provider unavailable: `503 PROVIDER_UNAVAILABLE`.
- Budget exceeded: `413 PROVIDER_BUDGET_EXCEEDED`.
- Output invalid: `502 PROVIDER_OUTPUT_INVALID`.
