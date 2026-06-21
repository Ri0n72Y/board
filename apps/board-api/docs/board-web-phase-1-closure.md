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
```

Browser smoke is not a closure gate for this round.
